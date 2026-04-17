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

- [x] Add `Strictness` type and `DEFAULT_STRICTNESS = "relations"` constant
      in `src/generator.ts`.
- [x] Add `parseStrictnessConfig(raw)` with the same input-shape handling
      as `parseRequiredFieldsConfig` (string | string[] | undefined);
      unknown values emit `logger.warn` and fall back to default.
- [x] In `onGenerate`, parse `options.generator.config.strictness`, log
      the resolved level when `debug` is on, and pass it into the pass-2
      loop call site.
- [x] Extend `rewriteWhereReferencesPass` in `src/convertor.ts` to accept
      `strictness`. Keep the body unchanged for now (wire-through only).
- [x] Re-run `npm test` — behavior must be identical. Task 1 is
      **wire-through only**: no splitting of `rewriteWhereReferences`
      yet, so regardless of resolved level the full sweep still runs
      unchanged. The behavior split lands in Task 3.
- [x] Add a minimal regression: run `npm run generate:prisma` with
      `strictness = "relations"` and verify no diff in
      `generated/prisma/models/*.ts` vs current output. This check is
      valid only at Task 1 (wire-through); after Task 3 the diff is
      expected to change by level.

### Task 2: Survey generated output and finalize the action-args allowlist

**Files:**
- Modify: `src/convertor.ts` (add regex + comment block)

- [x] Run `grep -oE '^(export )?type [A-Z][A-Za-z0-9_]+Args\b' generated/prisma/models/*.ts | sort -u`
      and list every args-alias shape the schema fixture produces.
- [x] Cross-reference with Prisma 7 generator docs / source to identify
      which args aliases correspond to top-level delegate calls.
- [x] Record the allowlist + rejected shapes as a classification comment
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
      this task is marked done. Survey finding: two additional shapes
      (`{M}DefaultArgs`, `{M}CountOutputTypeDefaultArgs`) fall into the
      "no `where`" / nested-helper bucket (generic select/include helpers
      with no rewrite surface) — classified in the convertor comment.
- [x] Add `ACTION_ARGS_NAME_RE` regex in `src/convertor.ts`:
      `/^([A-Za-z0-9_]+)(FindMany|FindFirst|FindFirstOrThrow|Count|Aggregate|GroupBy|UpdateMany|UpdateManyAndReturn|DeleteMany)Args$/`
      — gate with `modelSet.has(match[1])` to exclude arbitrary user types.
- [x] No tests in this task — it's a discovery + constant. Verified in
      Task 3.

### Task 3: Split `rewriteWhereReferences` into action-args-only and full variants

**Files:**
- Modify: `src/convertor.ts`

- [x] Extract the per-property rewrite body from `rewriteWhereReferences`
      into a helper `rewriteWhereOnAlias(alias, requiredSet, debug)`.
- [x] Keep `rewriteWhereReferences(sourceFile, requiredSet, debug)` as a
      thin loop over every alias that calls `rewriteWhereOnAlias`.
- [x] Add `rewriteActionArgsWhereReferences(sourceFile, requiredSet,
      modelSet, debug)` that iterates aliases, gates by
      `ACTION_ARGS_NAME_RE` + `modelSet`, and delegates to
      `rewriteWhereOnAlias`.
- [x] Update `rewriteWhereReferencesPass` to switch on `strictness`:
      - `basic`: call `rewriteActionArgsWhereReferences` only.
      - `relations`: + `rewriteRelationFilterReferences`.
      - `includes`: + `rewriteWhereReferences` (the full alias sweep);
        skip the action-args-only call at this level — it's a subset of
        the full sweep, so running it is dead work (a second pass over
        an already-`…Strict`-typed property is a no-op because
        `WHERE_INPUT_RE` matches only `…WhereInput$`, but doing the work
        twice still wastes ts-morph traversal time).
- [x] Write a minimal shell-level assertion: run
      `npm run generate:prisma` three times with `strictness` set to
      `basic`, `relations`, `includes` respectively; for each, spot-check
      one representative file (`User.ts`, `Post.ts`) with `diff` against
      a recorded golden to confirm the expected subset of rewrites.
      Verified: basic→relations diff on User.ts shows only `is`/`isNot`
      on `UserScalarRelationFilter` + `UserNullableScalarRelationFilter`
      and `delete`/`disconnect` on `UserUpdateOneWithoutMemosNestedInput`
      flip to Strict; on Post.ts shows `author` XOR second-arg +
      `every`/`some`/`none` on `PostListRelationFilter` flip to Strict.
      relations→includes diff on User.ts shows nested include/count/
      upsert `where` positions (`User$postsArgs`, `User$memosArgs`,
      `UserCountOutputTypeCount{Posts,Memos}Args`,
      `UserUpsertWithoutPostsInput`,
      `UserUpdateToOneWithWhereWithoutPostsInput`, plus Memos variants)
      flip to Strict. Matches plan's expected subset exactly.
- [x] Run `npm test` with `strictness = "includes"` — passes (behavior
      matches pre-split v1.1.0). Default `relations` produces the
      expected `TS2578` unused-`@ts-expect-error` failures on the
      `includes`-only fixture cases (nested include/select/`_count`) —
      Task 5/6 split the fixture per level to make all three pass. The
      schema fixture is left at `strictness = "includes"` through
      Task 4 so existing tests keep passing during the transition.

### Task 4: Audit the schema fixture for coverage across all three layers

**Files:**
- Modify: `prisma/schema.prisma` (only if gaps found)
- Modify: `tests/generateTypeTestFile.ts` (only if new fixture models
  need test coverage)

- [x] Audit the current schema — confirm it has at least one to-one
      relation with `delete`/`disconnect` surface, at least one list
      relation with `some`/`every`/`none`, and at least one to-one
      `include`/`select` path for the `includes`-only cases. The current
      User/Post/Memo set appears sufficient (see
      `generateTypeTestFile.ts` nested include/select + nested
      delete/disconnect sections) — expect this to be a no-op.
      Audit findings (no-op confirmed):
      - To-one `delete`/`disconnect`: `UserUpdateOneWithoutMemosNestedInput`
        (User.ts:393-401) carries `delete`/`disconnect: UserWhereInputStrict |
        boolean`, reached via `Memo.owner` (nullable to-one).
      - List relation filters: `User.posts` and `User.memos` both produce
        `{Post,Memo}ListRelationFilter` with `some`/`every`/`none`.
      - To-one nested `include`/`select`: `Memo$ownerArgs.where`
        (Memo.ts:1369) is typed `UserWhereInputStrict`; Post.author reaches
        `UserUpsertWithoutPostsInput.where` and
        `UserUpdateToOneWithWhereWithoutPostsInput.where` through nested
        update/upsert payloads.
- [x] If any of the three surfaces isn't covered, add a minimal model
      pair (e.g. `Memo` + `User.owner` if not already present) with a
      required field annotation. (Not needed — all three covered.)
- [x] Placing this before Task 5 so the fixture generator's per-case
      tagging lands with a stable schema.

### Task 5: Add strictness support to the test-fixture generator

**Files:**
- Modify: `tests/generateTypeTestFile.ts`

- [x] Read `tests/generateTypeTestFile.ts` and identify the cases that
      exercise nested include/select (`includes`-only), relation filters
      (`relations` and above), and top-level action args (`basic` and
      above).
- [x] Add per-case tags indicating the minimum strictness level at which
      each `@ts-expect-error` case becomes an error (e.g. a nested
      `include.posts.where: {}` expect-error case is only valid at
      `includes`; at `basic`/`relations` the same call should compile).
- [x] **Directive management (critical)**: tagging must control BOTH
      whether the statement appears AND whether a preceding
      `@ts-expect-error` directive is emitted. `tsc --noEmit` treats an
      *unused* `@ts-expect-error` as a compile error, so a level-
      `includes` case left in a level-`basic` fixture with its directive
      intact will fail the suite. Decision: use the **omit-entirely**
      variant for cases below their minimum level. Reason: a statement
      like `findMany({ where: { organizationId: 1, posts: { some: {} } } })`
      compiles at `basic` (permissive `some`) but errors at `relations`+
      (strict `some`); emitting it without a directive in the `basic`
      fixture would then error when the `basic` fixture is compiled
      against a `basic` client (the statement itself is level-dependent).
      Omitting keeps each fixture compilable against its matching client.
- [x] **Fixture generation is static, not client-introspecting**:
      `generateTypeTestFile.ts` must emit assertions as pure string
      templates keyed off the CLI `--level` arg. It must NOT rely on
      TypeScript resolving its own `import type { Prisma } from
      '../generated/prisma/client'` to decide what to emit — the
      currently-generated client is whichever level was last run, which
      is not necessarily the level being generated for. Verified: the
      generator never imports from `../generated`; all output is string
      templates keyed off the `level` arg and the static `MODEL_CASES`
      table. Docstring at the top of the file documents this invariant.
- [x] Drive the generator from a CLI arg (`--level basic|relations|includes`)
      and emit to `tests/type.<level>.test.ts`. Keep the old output path
      as a default for backward compat with existing scripts (no flag →
      emit to `tests/type.test.ts` at `DEFAULT_LEVEL = "includes"`;
      byte-identical to pre-refactor output).
- [x] Regenerate all three fixtures in one shot (no `prisma generate`
      between generations — fixtures are static strings):
      ```
      ts-node tests/generateTypeTestFile.ts --level basic
      ts-node tests/generateTypeTestFile.ts --level relations
      ts-node tests/generateTypeTestFile.ts --level includes
      ```
      Committed all three. Verified: `tests/type.includes.test.ts` is
      byte-identical to the current `tests/type.test.ts`; `npm test`
      continues to pass at `strictness = "includes"` with all four
      fixtures present (basic/relations fixtures' directives all pair
      with errors that also fire at `includes`, so no unused-directive
      failures).

### Task 6: Extend `npm test` to compile all three strictness fixtures

**Files:**
- Modify: `package.json`

- [x] Current `test` script generates the client once then compiles
      `tests/*.test.ts`. Split into three sub-scripts, one per level,
      each of shape: `prisma generate (with strictness=X) && tsc
      --noEmit tests/type.X.test.ts …`. The client MUST be regenerated
      between levels — fixtures at level X are static, but the client
      types they import (`import type { PrismaClient, Prisma } from
      '../generated/prisma/client'`) differ per level and must match the
      fixture being compiled.
- [x] Passing `strictness` to `prisma generate` requires setting it in
      `prisma/schema.prisma` for each run. Options: (a) keep a single
      schema and mutate the `strictness` line in-place via a tiny
      script; (b) keep three sibling schemas (`schema.basic.prisma`
      etc.) and point `prisma generate --schema=…` at the right one.
      Chose option (b). To minimize duplication: `schema.prisma` itself
      serves as the `relations` schema (matching the new default; also
      what `npm run generate:prisma` and `prisma.config.ts` use for dev),
      with sibling files `schema.basic.prisma` and
      `schema.includes.prisma` differing only in the `strictness` value.
- [x] Three sub-scripts: `test:basic`, `test:relations`, `test:includes`.
      `test` runs all three sequentially.
- [x] Run `npm test` from a clean checkout — all three levels must pass.
- [x] No new test file here; the task itself is the test harness.

### Task 7: Update README with the new option and migration note

**Files:**
- Modify: `README.md`

- [x] Add a "Strictness levels" section near the existing "What's new in
      v1.1.0" block documenting each level with a one-liner + one code
      example per level.
- [x] State the default (`relations`) and what that means for v1.1.0
      users (the nested-include layer now requires explicit opt-in via
      `strictness = "includes"`).
- [x] Add a "Migrating from v1.1" subsection with a copy-paste config
      block for users who want to preserve current behavior:
      ```
      generator whereRequired {
        provider   = "prisma-where-required"
        strictness = "includes"
      }
      ```
- [x] Update the "Relation filters enforce required fields" and "Nested
      include/select" paragraphs to note which level they belong to.

### Task 8: Verify acceptance criteria

- [x] Verify every requirement from Overview is implemented:
  - `strictness` option parsed, validated, defaults to `relations`
    (`parseStrictnessConfig` at `src/generator.ts:40` — STRICTNESS_LEVELS
    membership gate, `DEFAULT_STRICTNESS = "relations"`).
  - Each level rewrites exactly its documented subset of surfaces
    (spot-check below).
  - Unknown values warn (`logger.warn` at `src/generator.ts:52-55`) and
    fall back to default.
- [x] Run `npm test` (all three levels) — passes (`test:basic` →
      `test:relations` → `test:includes`, exit 0).
- [x] Run `npm run lint` — passes (no output).
- [x] `tsc --noEmit` on each generated `tests/type.<level>.test.ts`
      against a client generated at that level — handled by the per-level
      sub-scripts in `package.json` which regenerate the client with the
      matching schema before compiling its fixture.
- [x] Spot-check `generated/prisma/models/User.ts` at each level — confirmed:
      - `basic`: 9 `WhereInputStrict` references, all on action-args
        aliases (Aggregate/GroupBy/FindFirst/FindFirstOrThrow/FindMany/
        UpdateMany/UpdateManyAndReturn/DeleteMany) + the alias definition.
      - `relations`: 15 — adds `is`/`isNot` on
        `UserScalarRelationFilter` + `UserNullableScalarRelationFilter`
        and `delete`/`disconnect` on
        `UserUpdateOneWithoutMemosNestedInput`.
      - `includes`: 23 — adds nested `User$postsArgs.where`,
        `User$memosArgs.where`,
        `UserCountOutputTypeCount{Posts,Memos}Args.where`,
        `UserUpsertWithout{Posts,Memos}Input.where`, and
        `UserUpdateToOneWithWhereWithout{Posts,Memos}Input.where`.

### Task 9: [Final] Update documentation and housekeeping

- [x] Update README (done in Task 7 — re-verified after Task 8: the
      `Strictness levels` section at README.md:35 and the
      `Migrating from v1.1` subsection at README.md:76 both match the
      final implementation; relation-filter and nested-include paragraphs
      are tagged with their minimum level).
- [x] Update `CLAUDE.md` if the two-pass convention changes enough to
      warrant documenting — skipped: no `CLAUDE.md` exists in the repo,
      and the pass structure is the same, just gated per level, so
      introducing one for this alone would be premature.
- [x] Bump `package.json` version to `2.0.0`. Rationale: existing v1.1.0
      consumers that relied on nested-include enforcement silently lose
      it on upgrade when the default drops to `relations`; a major bump
      signals that an explicit `strictness = "includes"` opt-in is
      required to preserve prior behavior (recorded in the
      `Migrating from v1.1` README section and Post-Completion below).
- [x] Move this plan to `docs/plans/completed/`.

## Post-Completion

*Items requiring manual intervention or external systems.*

**Version & release:**
- Decision: bumped to `2.0.0` in Task 9. Rationale: existing v1.1.0
  consumers relying on nested-include enforcement silently lose it on
  upgrade when the default drops to `relations`. A major bump signals
  the opt-in requirement (`strictness = "includes"`) and matches the
  README `Migrating from v1.1` section.
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
