// !!!this file is auto generated.!!! 

import type { PrismaClient, Prisma } from '../generated/prisma/client'

declare const prisma: PrismaClient

// ========== user ==========

// @ts-expect-error args are required
prisma.user.findMany()

// @ts-expect-error where is required
prisma.user.findMany({})

// @ts-expect-error organizationId is required
prisma.user.findMany({ where: {} })

prisma.user.findMany({
    where: { organizationId: 1 },
})

prisma.user.findMany({
    where: { organizationId: undefined }
})

prisma.user.findMany({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.user.findFirst()

// @ts-expect-error where is required
prisma.user.findFirst({})

// @ts-expect-error organizationId is required
prisma.user.findFirst({ where: {} })

prisma.user.findFirst({
    where: { organizationId: 1 },
})

prisma.user.findFirst({
    where: { organizationId: undefined }
})

prisma.user.findFirst({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.user.findFirstOrThrow()

// @ts-expect-error where is required
prisma.user.findFirstOrThrow({})

// @ts-expect-error organizationId is required
prisma.user.findFirstOrThrow({ where: {} })

prisma.user.findFirstOrThrow({
    where: { organizationId: 1 },
})

prisma.user.findFirstOrThrow({
    where: { organizationId: undefined }
})

prisma.user.findFirstOrThrow({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.user.deleteMany()

// @ts-expect-error where is required
prisma.user.deleteMany({})

// @ts-expect-error organizationId is required
prisma.user.deleteMany({ where: {} })

prisma.user.deleteMany({
    where: { organizationId: 1 },
})

prisma.user.deleteMany({
    where: { organizationId: undefined }
})

prisma.user.deleteMany({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.user.count()

// @ts-expect-error where is required
prisma.user.count({})

// @ts-expect-error organizationId is required
prisma.user.count({ where: {} })

prisma.user.count({
    where: { organizationId: 1 },
})

prisma.user.count({
    where: { organizationId: undefined }
})

prisma.user.count({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.user.aggregate()

// @ts-expect-error where is required
prisma.user.aggregate({})

// @ts-expect-error organizationId is required
prisma.user.aggregate({ where: {} })

prisma.user.aggregate({
    where: { organizationId: 1 },
})

prisma.user.aggregate({
    where: { organizationId: undefined }
})

prisma.user.aggregate({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error where is required
prisma.user.updateMany({ data: {} })

// @ts-expect-error organizationId is required
prisma.user.updateMany({ data: {}, where: {} })

prisma.user.updateMany({ data: {}, where: { organizationId: 1 } })

prisma.user.updateMany({ data: {}, where: { organizationId: undefined } })

prisma.user.updateMany({ data: {}, where: { organizationId: { in: [1] } } })

// @ts-expect-error where is required
prisma.user.groupBy({ by: ['id'] })

// @ts-expect-error organizationId is required
prisma.user.groupBy({ by: ['id'], where: {} })

prisma.user.groupBy({ by: ['id'], where: { organizationId: 1 } })

prisma.user.groupBy({ by: ['id'], where: { organizationId: undefined } })

prisma.user.groupBy({ by: ['id'], where: { organizationId: { in: [1] } } })
// ========== post ==========

// @ts-expect-error args are required
prisma.post.findMany()

// @ts-expect-error where is required
prisma.post.findMany({})

// @ts-expect-error organizationId is required
prisma.post.findMany({ where: {} })

prisma.post.findMany({
    where: { organizationId: 1 },
})

prisma.post.findMany({
    where: { organizationId: undefined }
})

prisma.post.findMany({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.post.findFirst()

// @ts-expect-error where is required
prisma.post.findFirst({})

// @ts-expect-error organizationId is required
prisma.post.findFirst({ where: {} })

prisma.post.findFirst({
    where: { organizationId: 1 },
})

prisma.post.findFirst({
    where: { organizationId: undefined }
})

prisma.post.findFirst({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.post.findFirstOrThrow()

// @ts-expect-error where is required
prisma.post.findFirstOrThrow({})

// @ts-expect-error organizationId is required
prisma.post.findFirstOrThrow({ where: {} })

prisma.post.findFirstOrThrow({
    where: { organizationId: 1 },
})

prisma.post.findFirstOrThrow({
    where: { organizationId: undefined }
})

prisma.post.findFirstOrThrow({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.post.deleteMany()

// @ts-expect-error where is required
prisma.post.deleteMany({})

// @ts-expect-error organizationId is required
prisma.post.deleteMany({ where: {} })

prisma.post.deleteMany({
    where: { organizationId: 1 },
})

prisma.post.deleteMany({
    where: { organizationId: undefined }
})

prisma.post.deleteMany({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.post.count()

// @ts-expect-error where is required
prisma.post.count({})

// @ts-expect-error organizationId is required
prisma.post.count({ where: {} })

prisma.post.count({
    where: { organizationId: 1 },
})

prisma.post.count({
    where: { organizationId: undefined }
})

prisma.post.count({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.post.aggregate()

// @ts-expect-error where is required
prisma.post.aggregate({})

// @ts-expect-error organizationId is required
prisma.post.aggregate({ where: {} })

prisma.post.aggregate({
    where: { organizationId: 1 },
})

prisma.post.aggregate({
    where: { organizationId: undefined }
})

prisma.post.aggregate({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error where is required
prisma.post.updateMany({ data: {} })

// @ts-expect-error organizationId is required
prisma.post.updateMany({ data: {}, where: {} })

prisma.post.updateMany({ data: {}, where: { organizationId: 1 } })

prisma.post.updateMany({ data: {}, where: { organizationId: undefined } })

prisma.post.updateMany({ data: {}, where: { organizationId: { in: [1] } } })

// @ts-expect-error where is required
prisma.post.groupBy({ by: ['id'] })

// @ts-expect-error organizationId is required
prisma.post.groupBy({ by: ['id'], where: {} })

prisma.post.groupBy({ by: ['id'], where: { organizationId: 1 } })

prisma.post.groupBy({ by: ['id'], where: { organizationId: undefined } })

prisma.post.groupBy({ by: ['id'], where: { organizationId: { in: [1] } } })
// ========== userPost ==========

// @ts-expect-error args are required
prisma.userPost.findMany()

// @ts-expect-error where is required
prisma.userPost.findMany({})

// @ts-expect-error organizationId is required
prisma.userPost.findMany({ where: {} })

prisma.userPost.findMany({
    where: { organizationId: 1 },
})

prisma.userPost.findMany({
    where: { organizationId: undefined }
})

prisma.userPost.findMany({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.userPost.findFirst()

// @ts-expect-error where is required
prisma.userPost.findFirst({})

// @ts-expect-error organizationId is required
prisma.userPost.findFirst({ where: {} })

prisma.userPost.findFirst({
    where: { organizationId: 1 },
})

prisma.userPost.findFirst({
    where: { organizationId: undefined }
})

prisma.userPost.findFirst({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.userPost.findFirstOrThrow()

// @ts-expect-error where is required
prisma.userPost.findFirstOrThrow({})

// @ts-expect-error organizationId is required
prisma.userPost.findFirstOrThrow({ where: {} })

prisma.userPost.findFirstOrThrow({
    where: { organizationId: 1 },
})

prisma.userPost.findFirstOrThrow({
    where: { organizationId: undefined }
})

prisma.userPost.findFirstOrThrow({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.userPost.deleteMany()

// @ts-expect-error where is required
prisma.userPost.deleteMany({})

// @ts-expect-error organizationId is required
prisma.userPost.deleteMany({ where: {} })

prisma.userPost.deleteMany({
    where: { organizationId: 1 },
})

prisma.userPost.deleteMany({
    where: { organizationId: undefined }
})

prisma.userPost.deleteMany({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.userPost.count()

// @ts-expect-error where is required
prisma.userPost.count({})

// @ts-expect-error organizationId is required
prisma.userPost.count({ where: {} })

prisma.userPost.count({
    where: { organizationId: 1 },
})

prisma.userPost.count({
    where: { organizationId: undefined }
})

prisma.userPost.count({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error args are required
prisma.userPost.aggregate()

// @ts-expect-error where is required
prisma.userPost.aggregate({})

// @ts-expect-error organizationId is required
prisma.userPost.aggregate({ where: {} })

prisma.userPost.aggregate({
    where: { organizationId: 1 },
})

prisma.userPost.aggregate({
    where: { organizationId: undefined }
})

prisma.userPost.aggregate({
    where: { organizationId: { in: [1] } }
})

// @ts-expect-error where is required
prisma.userPost.updateMany({ data: {} })

// @ts-expect-error organizationId is required
prisma.userPost.updateMany({ data: {}, where: {} })

prisma.userPost.updateMany({ data: {}, where: { organizationId: 1 } })

prisma.userPost.updateMany({ data: {}, where: { organizationId: undefined } })

prisma.userPost.updateMany({ data: {}, where: { organizationId: { in: [1] } } })

// @ts-expect-error where is required
prisma.userPost.groupBy({ by: ['id'] })

// @ts-expect-error organizationId is required
prisma.userPost.groupBy({ by: ['id'], where: {} })

prisma.userPost.groupBy({ by: ['id'], where: { organizationId: 1 } })

prisma.userPost.groupBy({ by: ['id'], where: { organizationId: undefined } })

prisma.userPost.groupBy({ by: ['id'], where: { organizationId: { in: [1] } } })
// ========== memo ==========

// @ts-expect-error args are required
prisma.memo.findMany()

// @ts-expect-error where is required
prisma.memo.findMany({})

// @ts-expect-error organizationId is required
prisma.memo.findMany({ where: {} })

prisma.memo.findMany({
    where: { organizationId: 1 },
})

prisma.memo.findMany({
    where: { organizationId: undefined }
})

prisma.memo.findMany({
    where: { organizationId: null }
})

// @ts-expect-error args are required
prisma.memo.findFirst()

// @ts-expect-error where is required
prisma.memo.findFirst({})

// @ts-expect-error organizationId is required
prisma.memo.findFirst({ where: {} })

prisma.memo.findFirst({
    where: { organizationId: 1 },
})

prisma.memo.findFirst({
    where: { organizationId: undefined }
})

prisma.memo.findFirst({
    where: { organizationId: null }
})

// @ts-expect-error args are required
prisma.memo.findFirstOrThrow()

// @ts-expect-error where is required
prisma.memo.findFirstOrThrow({})

// @ts-expect-error organizationId is required
prisma.memo.findFirstOrThrow({ where: {} })

prisma.memo.findFirstOrThrow({
    where: { organizationId: 1 },
})

prisma.memo.findFirstOrThrow({
    where: { organizationId: undefined }
})

prisma.memo.findFirstOrThrow({
    where: { organizationId: null }
})

// @ts-expect-error args are required
prisma.memo.deleteMany()

// @ts-expect-error where is required
prisma.memo.deleteMany({})

// @ts-expect-error organizationId is required
prisma.memo.deleteMany({ where: {} })

prisma.memo.deleteMany({
    where: { organizationId: 1 },
})

prisma.memo.deleteMany({
    where: { organizationId: undefined }
})

prisma.memo.deleteMany({
    where: { organizationId: null }
})

// @ts-expect-error args are required
prisma.memo.count()

// @ts-expect-error where is required
prisma.memo.count({})

// @ts-expect-error organizationId is required
prisma.memo.count({ where: {} })

prisma.memo.count({
    where: { organizationId: 1 },
})

prisma.memo.count({
    where: { organizationId: undefined }
})

prisma.memo.count({
    where: { organizationId: null }
})

// @ts-expect-error args are required
prisma.memo.aggregate()

// @ts-expect-error where is required
prisma.memo.aggregate({})

// @ts-expect-error organizationId is required
prisma.memo.aggregate({ where: {} })

prisma.memo.aggregate({
    where: { organizationId: 1 },
})

prisma.memo.aggregate({
    where: { organizationId: undefined }
})

prisma.memo.aggregate({
    where: { organizationId: null }
})

// @ts-expect-error where is required
prisma.memo.updateMany({ data: {} })

// @ts-expect-error organizationId is required
prisma.memo.updateMany({ data: {}, where: {} })

prisma.memo.updateMany({ data: {}, where: { organizationId: 1 } })

prisma.memo.updateMany({ data: {}, where: { organizationId: undefined } })

prisma.memo.updateMany({ data: {}, where: { organizationId: null } })

// @ts-expect-error where is required
prisma.memo.groupBy({ by: ['id'] })

// @ts-expect-error organizationId is required
prisma.memo.groupBy({ by: ['id'], where: {} })

prisma.memo.groupBy({ by: ['id'], where: { organizationId: 1 } })

prisma.memo.groupBy({ by: ['id'], where: { organizationId: undefined } })

prisma.memo.groupBy({ by: ['id'], where: { organizationId: null } })
// ========== tag ==========

// Negative control: tag.findMany must compile with no args, empty args, and empty where.
prisma.tag.findMany()
prisma.tag.findMany({})
prisma.tag.findMany({ where: {} })
prisma.tag.findMany({ where: { id: 1 } })

// Negative control: tag.findFirst must compile with no args, empty args, and empty where.
prisma.tag.findFirst()
prisma.tag.findFirst({})
prisma.tag.findFirst({ where: {} })
prisma.tag.findFirst({ where: { id: 1 } })

// Negative control: tag.findFirstOrThrow must compile with no args, empty args, and empty where.
prisma.tag.findFirstOrThrow()
prisma.tag.findFirstOrThrow({})
prisma.tag.findFirstOrThrow({ where: {} })
prisma.tag.findFirstOrThrow({ where: { id: 1 } })

// Negative control: tag.deleteMany must compile with no args, empty args, and empty where.
prisma.tag.deleteMany()
prisma.tag.deleteMany({})
prisma.tag.deleteMany({ where: {} })
prisma.tag.deleteMany({ where: { id: 1 } })

// Negative control: tag.count must compile with no args, empty args, and empty where.
prisma.tag.count()
prisma.tag.count({})
prisma.tag.count({ where: {} })
prisma.tag.count({ where: { id: 1 } })

// Negative control: tag.aggregate accepts empty where (no Strict alias).
prisma.tag.aggregate({ where: {} })
prisma.tag.aggregate({ where: { id: 1 } })

// Negative control: tag.updateMany must compile with no where.
prisma.tag.updateMany({ data: {} })
prisma.tag.updateMany({ data: {}, where: {} })

// Negative control: tag.groupBy must compile with no where.
prisma.tag.groupBy({ by: ['id'] })
prisma.tag.groupBy({ by: ['id'], where: {} })

// ========== nested include where (cross-file strict refs) ==========

// @ts-expect-error posts.where.organizationId is required
prisma.user.findMany({ where: { organizationId: 1 }, include: { posts: { where: {} } } })

prisma.user.findMany({ where: { organizationId: 1 }, include: { posts: { where: { organizationId: 1 } } } })

// @ts-expect-error memos.where.organizationId is required (nullable still required at type level)
prisma.user.findMany({ where: { organizationId: 1 }, include: { memos: { where: {} } } })

prisma.user.findMany({ where: { organizationId: 1 }, include: { memos: { where: { organizationId: 1 } } } })

prisma.user.findMany({ where: { organizationId: 1 }, include: { memos: { where: { organizationId: null } } } })

// ========== _count.select.posts.where (strict) ==========

// @ts-expect-error _count.select.posts.where.organizationId is required
prisma.user.findMany({ where: { organizationId: 1 }, select: { _count: { select: { posts: { where: {} } } } } })

prisma.user.findMany({ where: { organizationId: 1 }, select: { _count: { select: { posts: { where: { organizationId: 1 } } } } } })

// ========== list relation filters (some/every/none, strict) ==========

// @ts-expect-error posts.some.organizationId is required
prisma.user.findMany({ where: { organizationId: 1, posts: { some: {} } } })

// @ts-expect-error posts.every.organizationId is required
prisma.user.findMany({ where: { organizationId: 1, posts: { every: {} } } })

// @ts-expect-error posts.none.organizationId is required
prisma.user.findMany({ where: { organizationId: 1, posts: { none: {} } } })

prisma.user.findMany({ where: { organizationId: 1, posts: { some: { organizationId: 1 } } } })
prisma.user.findMany({ where: { organizationId: 1, posts: { every: { organizationId: 1 } } } })
prisma.user.findMany({ where: { organizationId: 1, posts: { none: { organizationId: 1 } } } })

// Also covers Memo list relation on User (inverse of Memo.owner).
// @ts-expect-error memos.some.organizationId is required
prisma.user.findMany({ where: { organizationId: 1, memos: { some: {} } } })

prisma.user.findMany({ where: { organizationId: 1, memos: { some: { organizationId: 1 } } } })

// ========== scalar relation filters (is/isNot + XOR shorthand, strict) ==========

// @ts-expect-error owner.is.organizationId is required
prisma.memo.findMany({ where: { organizationId: 1, owner: { is: {} } } })

// @ts-expect-error owner.isNot.organizationId is required
prisma.memo.findMany({ where: { organizationId: 1, owner: { isNot: {} } } })

prisma.memo.findMany({ where: { organizationId: 1, owner: { is: { organizationId: 1 } } } })
prisma.memo.findMany({ where: { organizationId: 1, owner: { isNot: { organizationId: 1 } } } })

// XOR-direct shorthand: `owner: {...}` (no is/isNot wrapper). The XOR-second
// rewrite targets this path. Passing a property unique to UserWhereInputStrict
// (not on UserScalarRelationFilter) without organizationId must fail — this
// confirms the XOR's second arg is the Strict alias, not the pristine WhereInput.
//
// Caveat: a completely empty `owner: {}` is permitted because XOR's first
// branch (UserScalarRelationFilter / UserNullableScalarRelationFilter) has
// only optional fields. Prisma's own XOR<T, U> resolves `{}` via the T
// branch, so strictness can't be enforced on a truly empty object. Use
// `is`/`isNot` for exhaustive relation-filter coverage.
// @ts-expect-error owner.{direct}.organizationId is required when naming a User scalar
prisma.memo.findMany({ where: { organizationId: 1, owner: { name: "x" } } })

prisma.memo.findMany({ where: { organizationId: 1, owner: { organizationId: 1 } } })
prisma.memo.findMany({ where: { organizationId: 1, owner: { organizationId: 1, name: "x" } } })

// Nullable relation: passing `null` is still valid (owner is optional).
prisma.memo.findMany({ where: { organizationId: 1, owner: null } })

// Post → User (non-nullable scalar relation): same matrix.
// @ts-expect-error author.is.organizationId is required
prisma.post.findMany({ where: { organizationId: 1, author: { is: {} } } })

prisma.post.findMany({ where: { organizationId: 1, author: { is: { organizationId: 1 } } } })

// @ts-expect-error author.{direct}.organizationId is required when naming a User scalar
prisma.post.findMany({ where: { organizationId: 1, author: { name: "x" } } })

prisma.post.findMany({ where: { organizationId: 1, author: { organizationId: 1 } } })

// ========== AND/OR/NOT combinator permissiveness (regression) ==========

prisma.user.findMany({ where: { organizationId: 1, OR: [{ name: "a" }, { name: "b" }] } })
prisma.user.findMany({ where: { organizationId: 1, AND: [{ name: "a" }] } })
prisma.user.findMany({ where: { organizationId: 1, NOT: { name: "a" } } })

// Same for Post/Memo — any-model combinators stay permissive.
prisma.post.findMany({ where: { organizationId: 1, OR: [{ title: "a" }] } })
prisma.memo.findMany({ where: { organizationId: 1, AND: [{ content: "a" }] } })

// Combinator + relation intersection: OR branches are permissive in the
// outer shape (no organizationId required on the branch itself), but
// relation filters nested inside a branch are still strict because the
// rewrite applies globally to `PostListRelationFilter.some`. So a branch
// can elide User.organizationId, but the nested `posts.some` still
// requires Post.organizationId.
// @ts-expect-error posts.some.organizationId is still required even inside OR
prisma.user.findMany({ where: { organizationId: 1, OR: [{ posts: { some: {} } }] } })

// Valid: nested relation filter gets its required field.
prisma.user.findMany({ where: { organizationId: 1, OR: [{ posts: { some: { organizationId: 1 } } }] } })

// Branch-only permissiveness: no User scalars required inside OR branch,
// but the outer organizationId still is (UserWhereInputStrict).
prisma.user.findMany({ where: { organizationId: 1, OR: [{ posts: { some: { organizationId: 1 } } }, { name: "a" }] } })

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
// key (not optional), and Memo's nullable case must preserve `| null` in
// the value union.
type _UserHasOrgId = 'organizationId' extends keyof Required<Prisma.UserWhereInputStrict>
    ? true
    : false
const _userHasOrgId: _UserHasOrgId = true
void _userHasOrgId

// organizationId on the Strict alias must be non-optional (no `?`). An empty
// object is assignable to `Pick<X, K>` iff K is optional on X; so if the key
// is required, `{} extends Pick<...>` is false and this resolves to `true`.
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

// ========== non-goal surfaces (must stay permissive) ==========

// findUnique / findUniqueOrThrow: primary-key-scoped.
prisma.user.findUnique({ where: { id: 1 } })
prisma.user.findUniqueOrThrow({ where: { id: 1 } })
prisma.post.findUnique({ where: { id: 1 } })
prisma.memo.findUnique({ where: { id: 1 } })

// cursor: also WhereUniqueInput-backed.
prisma.user.findMany({ where: { organizationId: 1 }, cursor: { id: 1 }, take: 10 })

// groupBy.having: ScalarWhereWithAggregatesInput, not Strict. The outer
// `where` is strict, so tenant scoping is enforced there — `having` runs
// on already-grouped aggregates.
prisma.user.groupBy({ by: ['id'], where: { organizationId: 1 }, having: {} })

// update / delete / upsert: WhereUniqueInput — no tenant required in the
// unique lookup. `data` stays permissive (it's not a filter surface).
prisma.user.update({ where: { id: 1 }, data: {} })
prisma.user.delete({ where: { id: 1 } })
prisma.user.upsert({ where: { id: 1 }, update: {}, create: { email: "a", organizationId: 1 } })
prisma.post.update({ where: { id: 1 }, data: {} })
prisma.post.delete({ where: { id: 1 } })
prisma.memo.update({ where: { id: 1 }, data: {} })

// createMany: pure data payload, no where surface.
prisma.user.createMany({ data: [{ email: "a", organizationId: 1 }] })
prisma.post.createMany({ data: [{ title: "a", organizationId: 1, authorId: 1 }] })

// ========== nested update/upsert where (strict, through relation payloads) ==========

// Nested upsert requires `where`; must reject empty.
// @ts-expect-error nested upsert.where.organizationId is required
prisma.post.update({ where: { id: 1 }, data: { author: { upsert: { where: {}, update: {}, create: { email: "a", organizationId: 1 } } } } })

// Valid: Strict alias satisfied by organizationId.
prisma.post.update({ where: { id: 1 }, data: { author: { upsert: { where: { organizationId: 1 }, update: {}, create: { email: "a", organizationId: 1 } } } } })

// Nested update-to-one-with-where path also strict.
// @ts-expect-error nested update.where.organizationId is required
prisma.post.update({ where: { id: 1 }, data: { author: { update: { where: {}, data: {} } } } })

prisma.post.update({ where: { id: 1 }, data: { author: { update: { where: { organizationId: 1 }, data: {} } } } })

// ========== nested to-one delete/disconnect (strict) ==========

// delete with empty filter: must require organizationId.
// @ts-expect-error owner.delete.organizationId is required
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { delete: { name: "x" } } } })

// disconnect with empty filter: same.
// @ts-expect-error owner.disconnect.organizationId is required
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { disconnect: { name: "x" } } } })

// Valid: filter includes organizationId.
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { delete: { organizationId: 1 } } } })
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { disconnect: { organizationId: 1 } } } })

// Valid: unconditional boolean form still compiles.
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { delete: true } } })
prisma.memo.update({ where: { id: 1, organizationId: 1 }, data: { owner: { disconnect: true } } })
