# Strictness Levels (`basic` / `relations` / `includes`)

## Overview

Add a `strictness` generator config option letting consumers opt into how
aggressively the generator rewrites Prisma types. Three ordered levels:

- **`basic`** — top-level action args `where` only (matches v0.1 intent,
  plus the v1.1 alias architecture).
- **`relations`** *(default)* — `basic` + relation filters
  (`some`/`every`/`none`/`is`/`isNot`) + nested to-one `delete`/`disconnect`.
- **`includes`** — `relations` + nested `include.*.where`,
  `select.*.where`, and `_count.select.*.where` (current v1.1.0 behavior).

Motivation: the nested-include rewrite is correct in spirit but adds
friction on every admin/list page that does legitimate relation
traversal. For most consumers, the top-level + relation-filter layers
catch the real tenant leaks; the `includes` layer is for security-critical
apps that want to plug every cross-tenant read.

This is a behavior change for existing users (default drops from
`includes` to `relations`). Documented in README upgrade notes.

## Context (from discovery)

- `src/generator.ts` — parses generator config, orchestrates the two passes
  (`convert` per-model, `rewriteWhereReferencesPass` across all model files).
- `src/convertor.ts`:
  - `emitStrictAlias` — emits `{Model}WhereInputStrict` alias.
  - `removeQuestionTokenFromActionFuncProperty` — strips `?` from delegate
    method args.
  - `rewriteWhereReferences` — walks every type-alias member and rewrites
    any `where` PropertySignature whose type matches `{Model}WhereInput`.
    This is the function that needs to be split by alias-name allowlist.
  - `rewriteRelationFilterReferences` — rewrites `some`/`every`/`none`/
    `is`/`isNot` + `delete`/`disconnect` + XOR-embedded WhereInput.
- `tests/type.test.ts` + `tests/generateTypeTestFile.ts` — auto-generated
  type-level assertions. Regenerated via `npm run generate:typeTestFile`.
- `prisma/schema.prisma` — fixture schema used by tests.
- Prisma 7 generator emits per-model files at `{output}/models/{Model}.ts`.
  Top-level action-args aliases have fixed name shapes (`{Model}FindManyArgs`
  etc.); nested include args are `{Model}${Rel}Args` and
  `{Model}CountOutputType…Args`.

## Development Approach

- **testing approach**: Regular (implementation first, then tests).
- Complete each task fully before moving to the next.
- Small, focused changes. Run `npm test` after each change.
- Every task that touches logic must add/update tests.
- All tests must pass before starting the next task.
- Update this plan file when scope changes during implementation.
- Maintain backward compatibility for the `includes` level — opting in
  with `strictness = "includes"` must reproduce v1.1.0 behavior exactly.

## Testing Strategy

- **Unit tests**: this project has no pure unit-test harness; the test
  suite is type-level assertions compiled with `tsc --noEmit`. Treat these
  with the same rigor.
- **Type-assertion tests**: every strictness level needs a generated
  fixture set. The plan adds strictness-aware generation to
  `tests/generateTypeTestFile.ts` and produces three fixtures:
  - `tests/type.basic.test.ts`
  - `tests/type.relations.test.ts`
  - `tests/type.includes.test.ts` (same content as today's `type.test.ts`)
- `npm test` must compile all three fixtures. The `test` script needs a
  companion that regenerates the schema/prisma client with each
  `strictness` value before compiling the matching fixture.
- No UI/e2e tests — this is a build-time library.

## Progress Tracking

- Mark completed items with `[x]` immediately when done.
- Add newly discovered tasks with ➕ prefix.
- Document issues/blockers with ⚠️ prefix.
- Keep the plan in sync with actual work done.

## Solution Overview

1. Parse a new `strictness` option in `generator.ts`
   (`parseStrictnessConfig`). Accepts `"basic" | "relations" | "includes"`;
   invalid values warn and fall back to default `"relations"`.
2. Pass the resolved level into `convert` and `rewriteWhereReferencesPass`.
3. **Pass 1 (`convert`)** runs at every level. The alias must always exist
   so that Pass 2 has a rewrite target, and `removeQuestionTokenFromActionFuncProperty`
   drops `?` from **every** delegate method's first parameter regardless
   of level — including methods whose args alias is never strict-rewritten
   (`findUnique`, `update`, `delete`, `upsert`, `create`, `createMany`).
   **Accepted trade-off**: at every level (including `basic`), callers
   must pass `{ where: { id: 1 } }` explicitly to `delete`/`update`/
   `findUnique` etc. — there's no more `prisma.user.delete()`. This
   matches v1.1.0 behavior; it's not a regression. Documented in README.
4. **Pass 2 (`rewriteWhereReferencesPass`)** gates each sub-pass:
   - `basic`: rewrite `where` **only** on aliases matching the
     action-args name allowlist.
   - `relations`: `basic` + `rewriteRelationFilterReferences`.
   - `includes`: `relations` + rewrite `where` on **all** aliases (today's
     `rewriteWhereReferences` behavior unchanged).
5. Action-args name allowlist (to be finalized in Task 2 by surveying
   `generated/prisma/models/*.ts`):
   ```
   {Model}FindManyArgs
   {Model}FindFirstArgs
   {Model}FindFirstOrThrowArgs
   {Model}CountArgs
   {Model}AggregateArgs
   {Model}GroupByArgs
   {Model}UpdateManyArgs
   {Model}UpdateManyAndReturnArgs
   {Model}DeleteManyArgs
   ```
   (`FindUnique*Args` + `cursor` use `WhereUniqueInput` — non-goal, no
   WhereInput `where` to rewrite.)
6. README updated with the new option, default, and migration note for
   v1.1 → v1.2 users.

## Technical Details

### Config parsing

```ts
type Strictness = "basic" | "relations" | "includes";
const STRICTNESS_LEVELS: ReadonlyArray<Strictness> = ["basic", "relations", "includes"];
const DEFAULT_STRICTNESS: Strictness = "relations";

function parseStrictnessConfig(raw: string | string[] | undefined): Strictness
```

- `undefined` → `DEFAULT_STRICTNESS`.
- String array → take first entry (Prisma can hand us either; mirror
  `parseRequiredFieldsConfig`).
- Unknown string → `logger.warn` once, return `DEFAULT_STRICTNESS`.

### Gating in `rewriteWhereReferencesPass`

Signature gains `strictness: Strictness`:

```ts
export function rewriteWhereReferencesPass(args: {
  path: string;
  requiredSet: Set<string>;
  modelSet: Set<string>;
  strictness: Strictness;
  debug: boolean;
});
```

Inside:
- Always run the new `rewriteActionArgsWhereReferences` (basic layer).
- If `strictness !== "basic"`: also run `rewriteRelationFilterReferences`.
- If `strictness === "includes"`: also run the full
  `rewriteWhereReferences` (unchanged — walks every alias).

### Splitting `rewriteWhereReferences`

Extract the current function into two:
- `rewriteActionArgsWhereReferences(sourceFile, requiredSet, debug)` —
  adds an alias-name gate: only proceed if the enclosing
  `sourceFile.getTypeAliases()` alias name matches the allowlist regex.
- `rewriteWhereReferences(sourceFile, requiredSet, debug)` — unchanged
  (visits all aliases). Used at `includes` level only.

Both share the same inner per-property logic; factor it into a helper.

## What Goes Where

- **Implementation Steps** (`[ ]` checkboxes): config parsing, convertor
  split, test-fixture generator, fixtures, docs.
- **Post-Completion** (no checkboxes): publish decision, v1.2 release
  notes, downstream ctsim consumer update.

## Implementation Steps

### Task 1: Add `strictness` config parsing and plumb it through the orchestrator

**Files:**
- Modify: `src/generator.ts`
- Modify: `src/convertor.ts`

- [ ] Add `Strictness` type and `DEFAULT_STRICTNESS = "relations"` constant
      in `src/generator.ts`.
- [ ] Add `parseStrictnessConfig(raw)` with the same input-shape handling
      as `parseRequiredFieldsConfig` (string | string[] | undefined);
      unknown values emit `logger.warn` and fall back to default.
- [ ] In `onGenerate`, parse `options.generator.config.strictness`, log
      the resolved level when `debug` is on, and pass it into the pass-2
      loop call site.
- [ ] Extend `rewriteWhereReferencesPass` in `src/convertor.ts` to accept
      `strictness`. Keep the body unchanged for now (wire-through only).
- [ ] Re-run `npm test` — behavior must be identical. Task 1 is
      **wire-through only**: no splitting of `rewriteWhereReferences`
      yet, so regardless of resolved level the full sweep still runs
      unchanged. The behavior split lands in Task 3.
- [ ] Add a minimal regression: run `npm run generate:prisma` with
      `strictness = "relations"` and verify no diff in
      `generated/prisma/models/*.ts` vs current output. This check is
      valid only at Task 1 (wire-through); after Task 3 the diff is
      expected to change by level.

### Task 2: Survey generated output and finalize the action-args allowlist

**Files:**
- Modify: `src/convertor.ts` (add regex + comment block)

- [ ] Run `grep -oE '^(export )?type [A-Z][A-Za-z0-9_]+Args\b' generated/prisma/models/*.ts | sort -u`
      and list every args-alias shape the schema fixture produces.
- [ ] Cross-reference with Prisma 7 generator docs / source to identify
      which args aliases correspond to top-level delegate calls.
- [ ] Record the allowlist + rejected shapes as a classification comment
      block next to the regex — same style as the existing XOR
      classification comment in `convertor.ts`. Enumerate explicitly
      (no "etc."):
      - **Accepted** (action-args with WhereInput-typed `where`):
        `FindMany`, `FindFirst`, `FindFirstOrThrow`, `Count`, `Aggregate`,
        `GroupBy`, `UpdateMany`, `UpdateManyAndReturn`, `DeleteMany`.
      - **Rejected — WhereUniqueInput-typed `where`** (non-goal, no
        rewrite at any level): `FindUnique`, `FindUniqueOrThrow`,
        `Update`, `Upsert`, `Delete`.
      - **Rejected — no `where` property**: `Create`, `CreateMany`,
        `CreateManyAndReturn`.
      - **Rejected — nested shapes** (handled by the full sweep at
        `includes` only): `{M}${Rel}Args` (nested include args),
        `{M}CountOutputTypeCount*Args`, `{M}GroupByOutputType…`.
      Task 2's `grep` step must confirm no Prisma 7 alias lands outside
      these three buckets — any new shape needs classification before
      this task is marked done.
- [ ] Add `ACTION_ARGS_NAME_RE` regex in `src/convertor.ts`:
      `/^([A-Za-z0-9_]+)(FindMany|FindFirst|FindFirstOrThrow|Count|Aggregate|GroupBy|UpdateMany|UpdateManyAndReturn|DeleteMany)Args$/`
      — gate with `modelSet.has(match[1])` to exclude arbitrary user types.
- [ ] No tests in this task — it's a discovery + constant. Verified in
      Task 3.

### Task 3: Split `rewriteWhereReferences` into action-args-only and full variants

**Files:**
- Modify: `src/convertor.ts`

- [ ] Extract the per-property rewrite body from `rewriteWhereReferences`
      into a helper `rewriteWhereOnAlias(alias, requiredSet, debug)`.
- [ ] Keep `rewriteWhereReferences(sourceFile, requiredSet, debug)` as a
      thin loop over every alias that calls `rewriteWhereOnAlias`.
- [ ] Add `rewriteActionArgsWhereReferences(sourceFile, requiredSet,
      modelSet, debug)` that iterates aliases, gates by
      `ACTION_ARGS_NAME_RE` + `modelSet`, and delegates to
      `rewriteWhereOnAlias`.
- [ ] Update `rewriteWhereReferencesPass` to switch on `strictness`:
      - `basic`: call `rewriteActionArgsWhereReferences` only.
      - `relations`: + `rewriteRelationFilterReferences`.
      - `includes`: + `rewriteWhereReferences` (the full alias sweep);
        skip the action-args-only call at this level — it's a subset of
        the full sweep, so running it is dead work (a second pass over
        an already-`…Strict`-typed property is a no-op because
        `WHERE_INPUT_RE` matches only `…WhereInput$`, but doing the work
        twice still wastes ts-morph traversal time).
- [ ] Write a minimal shell-level assertion: run
      `npm run generate:prisma` three times with `strictness` set to
      `basic`, `relations`, `includes` respectively; for each, spot-check
      one representative file (`User.ts`, `Post.ts`) with `diff` against
      a recorded golden to confirm the expected subset of rewrites.
- [ ] Run `npm test` with default (`relations`) — must pass; with
      `strictness = "includes"` — must pass (behavior matches pre-split).

### Task 4: Audit the schema fixture for coverage across all three layers

**Files:**
- Modify: `prisma/schema.prisma` (only if gaps found)
- Modify: `tests/generateTypeTestFile.ts` (only if new fixture models
  need test coverage)

- [ ] Audit the current schema — confirm it has at least one to-one
      relation with `delete`/`disconnect` surface, at least one list
      relation with `some`/`every`/`none`, and at least one to-one
      `include`/`select` path for the `includes`-only cases. The current
      User/Post/Memo set appears sufficient (see
      `generateTypeTestFile.ts` nested include/select + nested
      delete/disconnect sections) — expect this to be a no-op.
- [ ] If any of the three surfaces isn't covered, add a minimal model
      pair (e.g. `Memo` + `User.owner` if not already present) with a
      required field annotation.
- [ ] Placing this before Task 5 so the fixture generator's per-case
      tagging lands with a stable schema.

### Task 5: Add strictness support to the test-fixture generator

**Files:**
- Modify: `tests/generateTypeTestFile.ts`

- [ ] Read `tests/generateTypeTestFile.ts` and identify the cases that
      exercise nested include/select (`includes`-only), relation filters
      (`relations` and above), and top-level action args (`basic` and
      above).
- [ ] Add per-case tags indicating the minimum strictness level at which
      each `@ts-expect-error` case becomes an error (e.g. a nested
      `include.posts.where: {}` expect-error case is only valid at
      `includes`; at `basic`/`relations` the same call should compile).
- [ ] **Directive management (critical)**: tagging must control BOTH
      whether the statement appears AND whether a preceding
      `@ts-expect-error` directive is emitted. `tsc --noEmit` treats an
      *unused* `@ts-expect-error` as a compile error, so a level-
      `includes` case left in a level-`basic` fixture with its directive
      intact will fail the suite. Rules:
      - Level below the case's tag: either **omit the statement entirely**
        (cleanest) or emit the statement **without** the
        `@ts-expect-error` directive (if the non-erroring form is itself
        worth asserting compiles).
      - Level at or above the tag: emit both statement + directive.
- [ ] **Fixture generation is static, not client-introspecting**:
      `generateTypeTestFile.ts` must emit assertions as pure string
      templates keyed off the CLI `--level` arg. It must NOT rely on
      TypeScript resolving its own `import type { Prisma } from
      '../generated/prisma/client'` to decide what to emit — the
      currently-generated client is whichever level was last run, which
      is not necessarily the level being generated for.
- [ ] Drive the generator from a CLI arg (`--level basic|relations|includes`)
      and emit to `tests/type.<level>.test.ts`. Keep the old output path
      as a default for backward compat with existing scripts.
- [ ] Regenerate all three fixtures in one shot (no `prisma generate`
      between generations — fixtures are static strings):
      ```
      ts-node tests/generateTypeTestFile.ts --level basic
      ts-node tests/generateTypeTestFile.ts --level relations
      ts-node tests/generateTypeTestFile.ts --level includes
      ```
      Commit all three.

### Task 6: Extend `npm test` to compile all three strictness fixtures

**Files:**
- Modify: `package.json`

- [ ] Current `test` script generates the client once then compiles
      `tests/*.test.ts`. Split into three sub-scripts, one per level,
      each of shape: `prisma generate (with strictness=X) && tsc
      --noEmit tests/type.X.test.ts …`. The client MUST be regenerated
      between levels — fixtures at level X are static, but the client
      types they import (`import type { PrismaClient, Prisma } from
      '../generated/prisma/client'`) differ per level and must match the
      fixture being compiled.
- [ ] Passing `strictness` to `prisma generate` requires setting it in
      `prisma/schema.prisma` for each run. Options: (a) keep a single
      schema and mutate the `strictness` line in-place via a tiny
      script; (b) keep three sibling schemas (`schema.basic.prisma`
      etc.) and point `prisma generate --schema=…` at the right one.
      Option (b) is simpler and avoids in-place edits; choose (b)
      unless an explicit reason not to surfaces at implementation time.
- [ ] Three sub-scripts: `test:basic`, `test:relations`, `test:includes`.
      `test` runs all three sequentially.
- [ ] Run `npm test` from a clean checkout — all three levels must pass.
- [ ] No new test file here; the task itself is the test harness.

### Task 7: Update README with the new option and migration note

**Files:**
- Modify: `README.md`

- [ ] Add a "Strictness levels" section near the existing "What's new in
      v1.1.0" block documenting each level with a one-liner + one code
      example per level.
- [ ] State the default (`relations`) and what that means for v1.1.0
      users (the nested-include layer now requires explicit opt-in via
      `strictness = "includes"`).
- [ ] Add a "Migrating from v1.1" subsection with a copy-paste config
      block for users who want to preserve current behavior:
      ```
      generator whereRequired {
        provider   = "prisma-where-required"
        strictness = "includes"
      }
      ```
- [ ] Update the "Relation filters enforce required fields" and "Nested
      include/select" paragraphs to note which level they belong to.

### Task 8: Verify acceptance criteria

- [ ] Verify every requirement from Overview is implemented:
  - `strictness` option parsed, validated, defaults to `relations`.
  - Each level rewrites exactly its documented subset of surfaces.
  - Unknown values warn and fall back.
- [ ] Run `npm test` (all three levels) — must pass.
- [ ] Run `npm run lint` — must pass.
- [ ] `tsc --noEmit` on each generated `tests/type.<level>.test.ts`
      against a client generated at that level — must pass.
- [ ] Spot-check `generated/prisma/models/User.ts` at each level and
      confirm by eye: `basic` has strict `where` only in action args,
      `relations` adds XOR/relation-filter strictness, `includes`
      matches v1.1.0 output.

### Task 9: [Final] Update documentation and housekeeping

- [ ] Update README (done in Task 7 — re-verify after Task 8).
- [ ] Update `CLAUDE.md` if the two-pass convention changes enough to
      warrant documenting (likely not — the pass structure is the same,
      just gated).
- [ ] Bump `package.json` version. Recommend `2.0.0` — dropping the
      nested-include layer from the default is a visible behavior change
      for existing v1.1.0 users who relied on it. If the user prefers
      to treat the default change as non-breaking because it's strictly
      *more permissive* (fewer compile errors), `1.2.0` is defensible.
      Decision + reasoning captured in Post-Completion.
- [ ] Move this plan to `docs/plans/completed/`.

## Post-Completion

*Items requiring manual intervention or external systems.*

**Version & release:**
- Decide between `1.2.0` (minor, treat `relations` as a permissive
  default expansion) and `2.0.0` (major, treat the nested-include
  behavior change as breaking). Recommend `2.0.0` — existing v1.1.0 users
  relying on nested-include enforcement silently lose it on upgrade.
- Write release notes including the migration snippet.
- Tag and publish to npm (`npm publish` is out of scope for the agent —
  user's call).

**Downstream consumer update:**
- User's ctsim project: after upgrade, decide per-project whether to set
  `strictness = "includes"` or leave default `"relations"` and accept
  the ergonomic win.

**Docs sync:**
- If the project has a CHANGELOG, append a 1.2.0 / 2.0.0 entry with the
  migration link.
