# prisma-where-required (Prisma 7 fork)

Fork of [@kz-d/prisma-where-required](https://github.com/kz-d/prisma-where-required)
adapted to Prisma 7's new `prisma-client` generator. Original design and
implementation by kz-d; this fork updates the generator to target the
per-model file layout produced by the Rust-free Prisma client, and — as of
v1.1.0 — re-architects how the required-field constraint is applied.

## What changed vs the original
- `requiresGenerators` switched from `prisma-client-js` to `prisma-client`.
- The generator now reads the client's custom `output` path from
  `options.otherGenerators` instead of `node_modules/.prisma/client`.
- The convertor patches `{output}/models/{ModelName}.ts` per model instead
  of a single `index.d.ts`, since Prisma 7 emits one file per model.
- Type references to `WhereInput` inside the same file are matched both as
  `ModelWhereInput` and the namespace-qualified `Prisma.ModelWhereInput`.

## What's new in v1.1.0
- **Strict alias architecture.** Prisma's `{Model}WhereInput` is left pristine.
  The generator emits a sibling `{Model}WhereInputStrict` that carries the
  required-field constraint, and rewrites every `where:` reference in action
  args, nested include args, and `_count` args to point at it.
- **Fixes a tenant leak.** Nested relation args
  (`include: { posts: { where: {} } }`, `_count.select.posts.where`),
  relation filters (`some / every / none / is / isNot`), and nested
  `delete` / `disconnect` on to-one updates now enforce required fields.
  In v0.1 they bypassed the check silently.
- **OR / AND / NOT are permissive again.** Combinators continue to reference
  the permissive `{Model}WhereInput`, so the `{ organizationId: undefined }`
  workaround is no longer needed inside combinator branches.
- **Schema-wide `requiredFields` config.** A new generator option applies a
  required-field name to every model that has it as a scalar, additive with
  `/// @where-required`.

## Overview
prisma-where-required is a utility that enforces certain fields to be mandatory in the 'where' clause when using Prisma.
This tool was primarily created with multi-tenant systems or to perform a soft delete in mind.

This fork requires **Prisma 7** and the `prisma-client` generator provider.

## Usage
1. `npm i @gusevp/prisma-where-required -D`

2. Add the following to your schema.prisma file:

```
generator whereRequired {
  provider = "prisma-where-required"
}
```

The generator auto-discovers the client's output path — no `nodeModulePath`
is required (it was a v4/v5 artifact).

3. Mark required fields. There are two ways; they are additive.

**Per-field annotation** — add `/// @where-required` above the column:

```
model User {
  id             Int    @id @default(autoincrement())
  name           String
  organizationId Int    /// @where-required
}
```

**Schema-wide config** — declare one or more field names on the generator
block. Every model that has a scalar with that exact name becomes enforced:

```
generator whereRequired {
  provider       = "prisma-where-required"
  requiredFields = ["organizationId"]
}
```

If a name listed in `requiredFields` does not match any scalar in the
schema, the generator emits a warning (useful for catching typos like
`"organisationId"`). You can mix annotations and config freely.

4. `npx prisma generate`

After these steps, your code will display the following behaviour:

```ts
// @ts-expect-error args are required
prisma.user.findMany()

// @ts-expect-error where is required
prisma.user.findMany({})

// @ts-expect-error organizationId is required
prisma.user.findMany({ where: {} })

// compile ok
prisma.user.findMany({ where: { organizationId: 1 } })
```

If you want to perform a search across all records for the mandatory field,
**explicitly specify `undefined`**:

```ts
prisma.user.findMany({
    where: { organizationId: undefined } // bypass the organizationId filter
})
```

## The `{Model}WhereInputStrict` type

The constraint lives on a generated sibling type. For each model with
required fields, you get:

```ts
export type UserWhereInputStrict =
  Omit<Prisma.UserWhereInput, 'organizationId'> & {
    organizationId: Prisma.IntFilter<"User"> | number | undefined
  }
```

Prisma's own `{Model}WhereInput` is untouched, so any code that references
it directly (including Prisma's internal definitions) stays permissive.
TypeScript error messages on `findMany`, `findFirst`, `count`, etc. will
mention `UserWhereInputStrict` rather than `UserWhereInput` — this is the
tenant-enforced variant.

## OR / AND / NOT work naturally

In v0.1.x, mutating `UserWhereInput` in place made required-ness viral
across combinator branches, forcing a `{ organizationId: undefined }` in
every `OR` / `AND` / `NOT` entry. In v1.1.0, combinators continue to
reference the permissive `UserWhereInput`, so branches are free-form:

```ts
// v0.1 (ugly workaround required):
prisma.user.findMany({
  where: {
    organizationId: 1,
    OR: [
      { organizationId: undefined, name: "alice" },
      { organizationId: undefined, name: "bob" },
    ],
  },
})

// v1.1 (combinators are permissive):
prisma.user.findMany({
  where: {
    organizationId: 1,
    OR: [
      { name: "alice" },
      { name: "bob" },
    ],
  },
})
```

The outer `where` is still strict — you can't drop `organizationId` from
it. Only the combinator branches relax.

## Relation filters enforce required fields

`some`, `every`, `none`, `is`, `isNot`, and the XOR-direct relation
shorthand (`{ author: {…} }` on a `…WhereInput`) all route through the
`Strict` alias of the target model, so cross-tenant traversal is blocked:

```ts
// @ts-expect-error — Post.organizationId is required on the related filter
prisma.user.findMany({
  where: { organizationId: 1, posts: { some: {} } },
})

// compile ok
prisma.user.findMany({
  where: {
    organizationId: 1,
    posts: { some: { organizationId: 1 } },
  },
})
```

The same applies to nested `include` args and `_count.select.*.where`
**when you pass an object**:

```ts
// @ts-expect-error
prisma.user.findMany({
  where: { organizationId: 1 },
  include: { posts: { where: {} } },
})

// compile ok
prisma.user.findMany({
  where: { organizationId: 1 },
  include: { posts: { where: { organizationId: 1 } } },
})
```

The boolean shorthand (`include: { posts: true }`, `select: { posts: true }`,
`_count: { select: { posts: true } }`) and the fluent accessor
(`user.posts()`) are deliberately left permissive — see Non-goals below.

## Nested `delete` / `disconnect` enforce required fields

On to-one nested update payloads (e.g. `UserUpdateOneWithoutMemosNestedInput`),
Prisma accepts `delete` and `disconnect` as either `true` or a `WhereInput`.
The `WhereInput` branch routes through the `Strict` alias, so you can't
delete or disconnect a related row with an under-filtered match:

```ts
// @ts-expect-error — owner is a User, organizationId required
prisma.memo.update({
  where: { id: 1, organizationId: 1 },
  data: { owner: { delete: { name: "x" } } },
})

// compile ok
prisma.memo.update({
  where: { id: 1, organizationId: 1 },
  data: { owner: { delete: { organizationId: 1, name: "x" } } },
})

// compile ok — the boolean shorthand is scoped by the outer tenant-filtered `where`
prisma.memo.update({
  where: { id: 1, organizationId: 1 },
  data: { owner: { delete: true } },
})
```

List-relation `delete` / `disconnect` (which use `WhereUniqueInput`) remain
permissive for the same reason as other `WhereUniqueInput` surfaces — see
Non-goals below.

## `exactOptionalPropertyTypes: true` caveat

`{Model}WhereInputStrict` uses `field: T | undefined` rather than
`field?: T` — the field is required at the type level and only its value
can be `undefined`. If your downstream tsconfig enables
`exactOptionalPropertyTypes: true`, you must pass the property explicitly:

```ts
// Won't compile under exactOptionalPropertyTypes with strict alias —
// the property must be present.
prisma.user.findMany({ where: {} })

// Works — explicit undefined bypasses the filter.
prisma.user.findMany({ where: { organizationId: undefined } })
```

This matches the v0.1 escape-hatch behavior, just with a slightly stricter
property-presence requirement under the tsconfig flag.

## Non-goals (surfaces deliberately NOT rewritten)

The `Strict` alias is applied to filter surfaces only. A few Prisma input
types are intentionally left permissive:

| Surface | Reason |
|---|---|
| `{Model}WhereUniqueInput` | Unique lookups are primary-key-scoped by definition; requiring the tenant field would force redundant filtering. |
| `{Model}ScalarWhereWithAggregatesInput` (`groupBy.having`) | Operates on already-grouped aggregates; the outer `where` is strict, so tenant scoping has already been enforced. |
| `{Model}ScalarWhereInput` (nested update payloads) | Used inside `updateMany` nested updates — not a common multi-tenant leak path. |
| `cursor` (uses `WhereUniqueInput`) | Same as `WhereUniqueInput`. |
| `data` (create/update payloads) | Not a filter surface. |
| FK-scoped relation reads (`include: { posts: true }`, `select: { posts: true }`, `_count: { select: { posts: true } }`, fluent `user.posts()`) | These are scoped through the parent's tenant-filtered `where`. Assumes the data-integrity invariant that a related row's tenant column matches the parent's (e.g. `Post.organizationId` equals its `author.organizationId`). If your schema can have divergent tenant columns across related rows, pass an explicit filter: `include: { posts: { where: { organizationId: 1 } } }`. |

If you hit a case where one of these surfaces enables a tenant leak for
your system, please open an issue.

## Caution

This is type surgery on generated Prisma output. It's additive — the
package emits types alongside Prisma's own — but compatibility with
future Prisma versions is not guaranteed without updates. Only types are
affected, so opting out is as simple as removing the generator and
re-running `prisma generate`.
