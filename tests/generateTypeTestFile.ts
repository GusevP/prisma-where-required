import fs from "fs";

/**
 * Auto-generated type-only test harness. Running this script with
 * `--level basic|relations|includes` rewrites `tests/type.<level>.test.ts`.
 * Type-checked by the project's `npm test` pipeline:
 * `prisma generate && tsc --noEmit ...`.
 *
 * The file is one big `tsc --noEmit` fixture: every `@ts-expect-error` must
 * be paired with a real type error, and every un-annotated statement must
 * compile cleanly.
 *
 * **Fixture generation is static, not client-introspecting.** Assertions are
 * emitted as pure string templates keyed off the CLI `--level` arg. This
 * script must NOT rely on TypeScript resolving its `import type { Prisma }`
 * to decide what to emit — the currently-generated client is whichever level
 * was last run, which is not necessarily the level being generated for.
 *
 * Level gating for negative (`@ts-expect-error`) cases:
 *   - `basic`: action-args strictness only. Nested include/select, relation
 *     filters, nested update/upsert `where`, and nested to-one
 *     delete/disconnect cases are omitted.
 *   - `relations`: `basic` + relation filters (some/every/none, is/isNot,
 *     XOR-direct shorthand) + nested to-one delete/disconnect.
 *   - `includes`: `relations` + nested include/select, `_count.select.*`,
 *     and nested update/upsert `where`.
 *
 * Cases below their minimum level are **omitted entirely** (not emitted
 * without their directive). Reason: a fixture tagged level X should compile
 * cleanly against a client generated at X. Emitting an includes-only
 * statement without its directive in the `basic` fixture would leave a
 * statement that DOES error when the `basic` fixture is compiled against a
 * `basic` client (the statement's error shape is level-dependent) — better
 * to omit it and let the `includes` fixture carry the assertion.
 *
 * Positive (non-error) statements are emitted at all levels unconditionally.
 */

type Level = "basic" | "relations" | "includes";
const LEVELS: ReadonlyArray<Level> = ["basic", "relations", "includes"];
const LEVEL_ORDER: Record<Level, number> = {
    basic: 0,
    relations: 1,
    includes: 2,
};

function isAtLeast(level: Level, minLevel: Level): boolean {
    return LEVEL_ORDER[level] >= LEVEL_ORDER[minLevel];
}

/**
 * Emit `body` verbatim when `level` is at or above `minLevel`, otherwise
 * return an empty string. Used inside template literals to gate paired
 * `@ts-expect-error` + statement blocks without distorting the surrounding
 * whitespace.
 */
function gate(level: Level, minLevel: Level, body: string): string {
    return isAtLeast(level, minLevel) ? body : "";
}

type ModelCase = {
    /** Prisma delegate accessor: `prisma.<delegateKey>.<action>(...)`. */
    delegateKey: string;
    /** The scalar field that must appear in `where` for required models. */
    requiredField: string;
    /**
     * Sample literal value valid for the required field's base type.
     * Used to build positive `where: { [requiredField]: <value> }` cases.
     */
    validValue: string;
    /**
     * Whether this model has NO required field (true negative control — no
     * Strict alias should exist and empty `where` must compile).
     */
    negativeControl?: boolean;
    /**
     * Whether the required field is nullable (e.g. `Int?`). Nullable
     * required fields must still compile when passed `null`.
     */
    nullable?: boolean;
};

const MODEL_CASES: ModelCase[] = [
    // Annotation-enforced: User.organizationId has `/// @where-required`.
    { delegateKey: "user", requiredField: "organizationId", validValue: "1" },
    // Config-enforced only: Post lost its annotation, requiredFields catches it.
    { delegateKey: "post", requiredField: "organizationId", validValue: "1" },
    // Config-enforced: UserPost never had annotation; requiredFields matches.
    { delegateKey: "userPost", requiredField: "organizationId", validValue: "1" },
    // Nullable required: `organizationId Int?`. `null` must compile.
    {
        delegateKey: "memo",
        requiredField: "organizationId",
        validValue: "1",
        nullable: true,
    },
    // True negative control: no scalar named organizationId, no annotation.
    {
        delegateKey: "tag",
        requiredField: "organizationId",
        validValue: "1",
        negativeControl: true,
    },
];

// Actions that take `where` as an optional-by-default property in Prisma's
// pristine output. Each action gets the full missing/valid/undefined matrix.
// `aggregate` is included — it's one of the actions whose `where` argument
// lives behind a delegate method we strictify.
const TARGET_ACTIONS = [
    "findMany",
    "findFirst",
    "findFirstOrThrow",
    "deleteMany",
    "count",
    "aggregate",
];

function buildActionMatrix(modelCase: ModelCase, action: string): string {
    const { delegateKey, requiredField, validValue, negativeControl, nullable } =
        modelCase;

    // aggregate requires `by` but we're testing where-strictness here. The
    // `aggregate` delegate signature in Prisma 7 doesn't need `by`; only
    // `groupBy` does. We still generate the same matrix for aggregate.

    if (negativeControl) {
        // Tag: no Strict alias should exist, so empty where must compile.
        // `aggregate` is special — its delegate always requires args even in
        // pristine Prisma output (no `?` on the param), so `aggregate()` and
        // `aggregate({})` both fail regardless of this generator's rewrites.
        // We only test `where: {}` and `where: { id }` paths for it.
        if (action === "aggregate") {
            return `
// Negative control: ${delegateKey}.${action} accepts empty where (no Strict alias).
prisma.${delegateKey}.${action}({ where: {} })
prisma.${delegateKey}.${action}({ where: { id: ${validValue} } })
`;
        }
        return `
// Negative control: ${delegateKey}.${action} must compile with no args, empty args, and empty where.
prisma.${delegateKey}.${action}()
prisma.${delegateKey}.${action}({})
prisma.${delegateKey}.${action}({ where: {} })
prisma.${delegateKey}.${action}({ where: { id: ${validValue} } })
`;
    }

    let block = `
// @ts-expect-error args are required
prisma.${delegateKey}.${action}()

// @ts-expect-error where is required
prisma.${delegateKey}.${action}({})

// @ts-expect-error ${requiredField} is required
prisma.${delegateKey}.${action}({ where: {} })

prisma.${delegateKey}.${action}({
    where: { ${requiredField}: ${validValue} },
})

prisma.${delegateKey}.${action}({
    where: { ${requiredField}: undefined }
})
`;

    if (!nullable) {
        // Non-nullable scalar filters (e.g. IntFilter) accept `{ in: [...] }`.
        block += `
prisma.${delegateKey}.${action}({
    where: { ${requiredField}: { in: [${validValue}] } }
})
`;
    } else {
        // Nullable required: explicit `null` must compile (and still counts as
        // "providing" the field — v0.2 Strict is `T | null | undefined`, so null
        // is never `missing`).
        block += `
prisma.${delegateKey}.${action}({
    where: { ${requiredField}: null }
})
`;
    }

    return block;
}

/**
 * Build a missing/valid/undefined/nullable matrix for an action whose Prisma
 * signature requires `where` AND some additional mandatory args (e.g.
 * `updateMany` requires `data`, `groupBy` requires `by`). `extraArgsPrefix`
 * is spliced into every shim call verbatim before `where` — e.g. `"data: {}, "`
 * for updateMany, `"by: ['id'], "` for groupBy. Pass the trailing comma +
 * space, because two of the generated calls have `where` directly following
 * the prefix and two don't have `where` at all.
 */
function buildWhereActionMatrix(
    modelCase: ModelCase,
    action: string,
    extraArgsPrefix: string,
): string {
    const { delegateKey, requiredField, validValue, negativeControl, nullable } =
        modelCase;
    // Strip trailing `, ` to form the "no where" variant (for negative control
    // + the first @ts-expect-error positive case).
    const prefixNoComma = extraArgsPrefix.replace(/,\s*$/, "");

    if (negativeControl) {
        return `
// Negative control: ${delegateKey}.${action} must compile with no where.
prisma.${delegateKey}.${action}({ ${prefixNoComma} })
prisma.${delegateKey}.${action}({ ${extraArgsPrefix}where: {} })
`;
    }

    let block = `
// @ts-expect-error where is required
prisma.${delegateKey}.${action}({ ${prefixNoComma} })

// @ts-expect-error ${requiredField} is required
prisma.${delegateKey}.${action}({ ${extraArgsPrefix}where: {} })

prisma.${delegateKey}.${action}({ ${extraArgsPrefix}where: { ${requiredField}: ${validValue} } })

prisma.${delegateKey}.${action}({ ${extraArgsPrefix}where: { ${requiredField}: undefined } })
`;

    if (nullable) {
        block += `
prisma.${delegateKey}.${action}({ ${extraArgsPrefix}where: { ${requiredField}: null } })
`;
    } else {
        block += `
prisma.${delegateKey}.${action}({ ${extraArgsPrefix}where: { ${requiredField}: { in: [${validValue}] } } })
`;
    }

    return block;
}

function generateTypeTestFile(outputPath: string, level: Level) {
    let content = `// !!!this file is auto generated.!!!\n\n`;
    // Type-only harness: the PrismaClient constructor in v7 requires an
    // adapter, which we don't need for compile-time type assertions. All
    // imports are hoisted here so the generated file opens with its full
    // dependency list, not a mid-file import block.
    content += `import type { PrismaClient, Prisma } from '../generated/prisma/client'\n\n`;
    content += `declare const prisma: PrismaClient\n\n`;

    // Per-model action matrix (top-level action args — the `basic` layer).
    // These errors fire at every level because Pass 1 strips `?` from every
    // delegate method's args parameter at every level and the action-args
    // `where` rewrite runs at `basic` and above.
    for (const modelCase of MODEL_CASES) {
        content += `// ========== ${modelCase.delegateKey} ==========\n`;
        for (const action of TARGET_ACTIONS) {
            content += buildActionMatrix(modelCase, action);
        }
        content += buildWhereActionMatrix(modelCase, "updateMany", "data: {}, ");
        content += buildWhereActionMatrix(modelCase, "groupBy", "by: ['id'], ");
    }

    // Nested include args: the cross-file rewrite is the `includes` layer —
    // `User$postsArgs.where` (lives in `User.ts`) only references
    // `PostWhereInputStrict` when strictness is `includes`. At `basic` /
    // `relations` the nested `where` stays pristine, so `include: { posts:
    // { where: {} } }` compiles and the negative cases are omitted here.
    //
    // NOTE: each call is kept on a single line so that `@ts-expect-error`
    // lands on exactly the expression that errors. Multi-line calls with
    // the error coming from a nested field would silently pass the directive.
    content += `
// ========== nested include where (cross-file strict refs) ==========
${gate(level, "includes", `
// @ts-expect-error posts.where.organizationId is required
prisma.user.findMany({ where: { organizationId: 1 }, include: { posts: { where: {} } } })
`)}
prisma.user.findMany({ where: { organizationId: 1 }, include: { posts: { where: { organizationId: 1 } } } })
${gate(level, "includes", `
// @ts-expect-error memos.where.organizationId is required (nullable still required at type level)
prisma.user.findMany({ where: { organizationId: 1 }, include: { memos: { where: {} } } })
`)}
prisma.user.findMany({ where: { organizationId: 1 }, include: { memos: { where: { organizationId: 1 } } } })

prisma.user.findMany({ where: { organizationId: 1 }, include: { memos: { where: { organizationId: null } } } })
`;

    // `_count` in `select` is the other cross-file path: picking
    // `_count: { select: { posts: { where: ... } } }` reaches
    // `UserCountOutputTypeCountPostsArgs.where` (in User.ts). The
    // `select: { _count: ... }` wrapper is required — `_count` is only
    // addressable through a `select` clause. Only strict at `includes`.
    content += `
// ========== _count.select.posts.where (strict) ==========
${gate(level, "includes", `
// @ts-expect-error _count.select.posts.where.organizationId is required
prisma.user.findMany({ where: { organizationId: 1 }, select: { _count: { select: { posts: { where: {} } } } } })
`)}
prisma.user.findMany({ where: { organizationId: 1 }, select: { _count: { select: { posts: { where: { organizationId: 1 } } } } } })
`;

    // List-relation filter scoping (`relations` layer). `posts: { some|every
    // |none: {} }` must require the inner `organizationId` because
    // `PostWhereInput` is rewritten to `PostWhereInputStrict` inside
    // `PostListRelationFilter` — at `relations` and above.
    //
    // Each expression is kept on a single line so @ts-expect-error pairs with
    // the exact failing call — multi-line nested object literals can shift
    // the error off the directive.
    content += `
// ========== list relation filters (some/every/none, strict) ==========
${gate(level, "relations", `
// @ts-expect-error posts.some.organizationId is required
prisma.user.findMany({ where: { organizationId: 1, posts: { some: {} } } })

// @ts-expect-error posts.every.organizationId is required
prisma.user.findMany({ where: { organizationId: 1, posts: { every: {} } } })

// @ts-expect-error posts.none.organizationId is required
prisma.user.findMany({ where: { organizationId: 1, posts: { none: {} } } })
`)}
prisma.user.findMany({ where: { organizationId: 1, posts: { some: { organizationId: 1 } } } })
prisma.user.findMany({ where: { organizationId: 1, posts: { every: { organizationId: 1 } } } })
prisma.user.findMany({ where: { organizationId: 1, posts: { none: { organizationId: 1 } } } })
${gate(level, "relations", `
// Also covers Memo list relation on User (inverse of Memo.owner).
// @ts-expect-error memos.some.organizationId is required
prisma.user.findMany({ where: { organizationId: 1, memos: { some: {} } } })
`)}
prisma.user.findMany({ where: { organizationId: 1, memos: { some: { organizationId: 1 } } } })
`;

    // Scalar / nullable-scalar relation filters and XOR-direct shorthand
    // (`relations` layer). From Memo's side, `owner: { is: {} }` / `owner:
    // {}` both reach `UserWhereInput` (via
    // `XOR<UserNullableScalarRelationFilter, UserWhereInput>`) — both must
    // require `User.organizationId` at `relations` and above.
    content += `
// ========== scalar relation filters (is/isNot + XOR shorthand, strict) ==========
${gate(level, "relations", `
// @ts-expect-error owner.is.organizationId is required
prisma.memo.findMany({ where: { organizationId: 1, owner: { is: {} } } })

// @ts-expect-error owner.isNot.organizationId is required
prisma.memo.findMany({ where: { organizationId: 1, owner: { isNot: {} } } })
`)}
prisma.memo.findMany({ where: { organizationId: 1, owner: { is: { organizationId: 1 } } } })
prisma.memo.findMany({ where: { organizationId: 1, owner: { isNot: { organizationId: 1 } } } })
${gate(level, "relations", `
// XOR-direct shorthand: \`owner: {...}\` (no is/isNot wrapper). The XOR-second
// rewrite targets this path. Passing a property unique to UserWhereInputStrict
// (not on UserScalarRelationFilter) without organizationId must fail — this
// confirms the XOR's second arg is the Strict alias, not the pristine WhereInput.
//
// Caveat: a completely empty \`owner: {}\` is permitted because XOR's first
// branch (UserScalarRelationFilter / UserNullableScalarRelationFilter) has
// only optional fields. Prisma's own XOR<T, U> resolves \`{}\` via the T
// branch, so strictness can't be enforced on a truly empty object. Use
// \`is\`/\`isNot\` for exhaustive relation-filter coverage.
// @ts-expect-error owner.{direct}.organizationId is required when naming a User scalar
prisma.memo.findMany({ where: { organizationId: 1, owner: { name: "x" } } })
`)}
prisma.memo.findMany({ where: { organizationId: 1, owner: { organizationId: 1 } } })
prisma.memo.findMany({ where: { organizationId: 1, owner: { organizationId: 1, name: "x" } } })

// Nullable relation: passing \`null\` is still valid (owner is optional).
prisma.memo.findMany({ where: { organizationId: 1, owner: null } })
${gate(level, "relations", `
// Post → User (non-nullable scalar relation): same matrix.
// @ts-expect-error author.is.organizationId is required
prisma.post.findMany({ where: { organizationId: 1, author: { is: {} } } })
`)}
prisma.post.findMany({ where: { organizationId: 1, author: { is: { organizationId: 1 } } } })
${gate(level, "relations", `
// @ts-expect-error author.{direct}.organizationId is required when naming a User scalar
prisma.post.findMany({ where: { organizationId: 1, author: { name: "x" } } })
`)}
prisma.post.findMany({ where: { organizationId: 1, author: { organizationId: 1 } } })
`;

    // Combinator permissiveness regression. The whole point of the
    // strict-alias refactor is that AND/OR/NOT keep pointing at the permissive
    // WhereInput — branches must NOT require organizationId. The Strict alias
    // is emitted at every level, so these positive cases compile everywhere.
    //
    // The `posts.some.organizationId is still required even inside OR` case
    // is `relations`-layer (`some` is only strict at `relations`+).
    content += `
// ========== AND/OR/NOT combinator permissiveness (regression) ==========

prisma.user.findMany({ where: { organizationId: 1, OR: [{ name: "a" }, { name: "b" }] } })
prisma.user.findMany({ where: { organizationId: 1, AND: [{ name: "a" }] } })
prisma.user.findMany({ where: { organizationId: 1, NOT: { name: "a" } } })

// Same for Post/Memo — any-model combinators stay permissive.
prisma.post.findMany({ where: { organizationId: 1, OR: [{ title: "a" }] } })
prisma.memo.findMany({ where: { organizationId: 1, AND: [{ content: "a" }] } })
${gate(level, "relations", `
// Combinator + relation intersection: OR branches are permissive in the
// outer shape (no organizationId required on the branch itself), but
// relation filters nested inside a branch are still strict because the
// rewrite applies globally to \`PostListRelationFilter.some\`. So a branch
// can elide User.organizationId, but the nested \`posts.some\` still
// requires Post.organizationId.
// @ts-expect-error posts.some.organizationId is still required even inside OR
prisma.user.findMany({ where: { organizationId: 1, OR: [{ posts: { some: {} } }] } })
`)}
// Valid: nested relation filter gets its required field.
prisma.user.findMany({ where: { organizationId: 1, OR: [{ posts: { some: { organizationId: 1 } } }] } })

// Branch-only permissiveness: no User scalars required inside OR branch,
// but the outer organizationId still is (UserWhereInputStrict).
prisma.user.findMany({ where: { organizationId: 1, OR: [{ posts: { some: { organizationId: 1 } } }, { name: "a" }] } })
`;

    // Type-level assertions: prove the architectural invariants structurally,
    // not just via happy-path compilation. These are \`type\` aliases +
    // compile-time \`true\`/\`never\` checks, so they cost nothing at runtime
    // but catch regressions where the type shape drifts (e.g. a future change
    // accidentally rewrites OR to Strict, or drops a field from the Omit).
    //
    // All assertions reference the Strict alias, which is emitted at every
    // level (Pass 1 runs unconditionally). Correct at `basic`+.
    content += `
// ========== type-level structural invariants ==========

// OR/AND/NOT on the Strict alias must stay permissive — they accept the
// pristine WhereInput (or an array of it), never the Strict alias.
// Direction matters: we assert that the *pristine* WhereInput is assignable
// to the combinator's declared type. If a regression rewrote OR to
// UserWhereInputStrict[], the pristine UserWhereInput (whose organizationId
// is optional) would NOT be assignable and this would fail to compile.
type _OrPermissive = Prisma.UserWhereInput[] extends Required<Prisma.UserWhereInputStrict>['OR']
    ? true
    : false
const _orPermissive: _OrPermissive = true
void _orPermissive

type _AndPermissive =
    Prisma.UserWhereInput | Prisma.UserWhereInput[] extends Required<Prisma.UserWhereInputStrict>['AND']
        ? true
        : false
const _andPermissive: _AndPermissive = true
void _andPermissive

type _NotPermissive =
    Prisma.UserWhereInput | Prisma.UserWhereInput[] extends Required<Prisma.UserWhereInputStrict>['NOT']
        ? true
        : false
const _notPermissive: _NotPermissive = true
void _notPermissive

// Omit-shape assertions: Strict must carry organizationId as a *required*
// key (not optional), and Memo's nullable case must preserve \`| null\` in
// the value union.
type _UserHasOrgId = 'organizationId' extends keyof Required<Prisma.UserWhereInputStrict>
    ? true
    : false
const _userHasOrgId: _UserHasOrgId = true
void _userHasOrgId

// organizationId on the Strict alias must be non-optional (no \`?\`). An empty
// object is assignable to \`Pick<X, K>\` iff K is optional on X; so if the key
// is required, \`{} extends Pick<...>\` is false and this resolves to \`true\`.
type _UserOrgIdRequired = {} extends Pick<Prisma.UserWhereInputStrict, 'organizationId'>
    ? false
    : true
const _userOrgIdRequired: _UserOrgIdRequired = true
void _userOrgIdRequired

// Memo.organizationId (nullable) must still allow null.
type _MemoOrgIdAllowsNull = null extends Prisma.MemoWhereInputStrict['organizationId']
    ? true
    : false
const _memoOrgIdAllowsNull: _MemoOrgIdAllowsNull = true
void _memoOrgIdAllowsNull

// Negative control: Tag must NOT have a Strict alias emitted.
// @ts-expect-error TagWhereInputStrict must not exist — Tag is the negative control model
type _NoTagStrict = Prisma.TagWhereInputStrict
`;

    // Non-goal surfaces (per plan's Non-goals table): WhereUniqueInput-backed
    // args (findUnique, findUniqueOrThrow, update, delete, upsert, cursor),
    // groupBy.having (ScalarWhereWithAggregates), create/update data payloads.
    // These must STAY permissive — re-requiring tenant fields here would
    // either be redundant (primary-key lookups) or wrong (data payloads are
    // not filters). All positive cases; compile at every level.
    content += `
// ========== non-goal surfaces (must stay permissive) ==========

// findUnique / findUniqueOrThrow: primary-key-scoped.
prisma.user.findUnique({ where: { id: 1 } })
prisma.user.findUniqueOrThrow({ where: { id: 1 } })
prisma.post.findUnique({ where: { id: 1 } })
prisma.memo.findUnique({ where: { id: 1 } })

// cursor: also WhereUniqueInput-backed.
prisma.user.findMany({ where: { organizationId: 1 }, cursor: { id: 1 }, take: 10 })

// groupBy.having: ScalarWhereWithAggregatesInput, not Strict. The outer
// \`where\` is strict, so tenant scoping is enforced there — \`having\` runs
// on already-grouped aggregates.
prisma.user.groupBy({ by: ['id'], where: { organizationId: 1 }, having: {} })

// update / delete / upsert: WhereUniqueInput — no tenant required in the
// unique lookup. \`data\` stays permissive (it's not a filter surface).
prisma.user.update({ where: { id: 1 }, data: {} })
prisma.user.delete({ where: { id: 1 } })
prisma.user.upsert({ where: { id: 1 }, update: {}, create: { email: "a", organizationId: 1 } })
prisma.post.update({ where: { id: 1 }, data: {} })
prisma.post.delete({ where: { id: 1 } })
prisma.memo.update({ where: { id: 1 }, data: {} })

// createMany: pure data payload, no where surface.
prisma.user.createMany({ data: [{ email: "a", organizationId: 1 }] })
prisma.post.createMany({ data: [{ title: "a", organizationId: 1, authorId: 1 }] })
`;

    // Nested update/upsert \`where\` INSIDE relation payloads — only rewritten
    // at `includes` (full alias sweep). The reachable surface is
    // \`UserUpsertWithoutPostsInput.where: UserWhereInputStrict\` (and the
    // matching \`UserUpdateToOneWithWhereWithoutPostsInput.where\`), reached
    // via \`post.update({ data: { author: { upsert: { where, update, create } } } })\`.
    content += `
// ========== nested update/upsert where (strict, through relation payloads) ==========
${gate(level, "includes", `
// Nested upsert requires \`where\`; must reject empty.
// @ts-expect-error nested upsert.where.organizationId is required
prisma.post.update({ where: { id: 1 }, data: { author: { upsert: { where: {}, update: {}, create: { email: "a", organizationId: 1 } } } } })
`)}
// Valid: Strict alias satisfied by organizationId.
prisma.post.update({ where: { id: 1 }, data: { author: { upsert: { where: { organizationId: 1 }, update: {}, create: { email: "a", organizationId: 1 } } } } })
${gate(level, "includes", `
// Nested update-to-one-with-where path also strict.
// @ts-expect-error nested update.where.organizationId is required
prisma.post.update({ where: { id: 1 }, data: { author: { update: { where: {}, data: {} } } } })
`)}
prisma.post.update({ where: { id: 1 }, data: { author: { update: { where: { organizationId: 1 }, data: {} } } } })
`;

    // Nested to-one delete/disconnect — Prisma emits these as
    // \`delete?: UserWhereInput | boolean\` / \`disconnect?: UserWhereInput | boolean\`
    // inside \`UserUpdateOneWithoutMemosNestedInput\`. Reached via
    // \`memo.update({ data: { owner: { delete: {...} } } })\`. An under-filtered
    // WhereInput here is a cross-tenant delete — same leak surface as
    // top-level \`where\`, so the rewriter swaps WhereInput → WhereInputStrict
    // at `relations`+.
    content += `
// ========== nested to-one delete/disconnect (strict) ==========
${gate(level, "relations", `
// delete with empty filter: must require organizationId.
// @ts-expect-error owner.delete.organizationId is required
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { delete: { name: "x" } } } })

// disconnect with empty filter: same.
// @ts-expect-error owner.disconnect.organizationId is required
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { disconnect: { name: "x" } } } })
`)}
// Valid: filter includes organizationId.
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { delete: { organizationId: 1 } } } })
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { disconnect: { organizationId: 1 } } } })

// Valid: unconditional boolean form still compiles.
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { delete: true } } })
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { disconnect: true } } })
`;

    fs.writeFileSync(outputPath, content, { encoding: "utf-8", flag: "w" });
}

function parseLevelArg(argv: ReadonlyArray<string>): Level {
    const idx = argv.indexOf("--level");
    if (idx === -1) {
        console.error(
            `--level flag is required (basic|relations|includes).`,
        );
        process.exit(1);
    }
    const raw = argv[idx + 1];
    if (!raw) {
        console.error(
            `--level flag requires a value (basic|relations|includes).`,
        );
        process.exit(1);
    }
    if (!(LEVELS as ReadonlyArray<string>).includes(raw)) {
        console.error(
            `Unknown --level: "${raw}". Expected basic|relations|includes.`,
        );
        process.exit(1);
    }
    return raw as Level;
}

if (require.main === module) {
    const level = parseLevelArg(process.argv.slice(2));
    generateTypeTestFile(`./tests/type.${level}.test.ts`, level);
}
