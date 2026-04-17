# prisma-where-required

A Prisma 7 generator that makes selected fields required in `where`
clauses — primarily for multi-tenant scoping and soft-delete enforcement
at the type level.

Originally based on [@kz-d/prisma-where-required](https://github.com/kz-d/prisma-where-required).
The core idea (patching Prisma's generated types to force a field into
`where`) comes from kz-d's original work. This package has since been
rewritten for Prisma 7's new `prisma-client` generator, re-architected
around a `{Model}WhereInputStrict` sibling type (v1.1.0), and extended
with configurable strictness levels (v2.0.0).

## What's new in v2.0.0
- **`strictness` generator option.** New `basic` | `relations` | `includes`
  knob gates how many `where` surfaces get rewritten. See Strictness levels
  below.
- **Breaking default change.** The default dropped from the v1.1.0
  `includes` baseline to `relations`. Nested `include.*.where`,
  `select.*.where`, and `_count.select.*.where` are no longer enforced by
  default — opt back in with `strictness = "includes"`. See Migrating from
  v1.1 to v2.0 below.

## What's new in v1.1.0
- **Strict alias architecture.** Prisma's `{Model}WhereInput` is left pristine.
  The generator emits a sibling `{Model}WhereInputStrict` that carries the
  required-field constraint, and rewrites `where:` references to point at it.
  In v2.0 the set of rewritten surfaces is controlled by `strictness` — see
  the table below.
- **Fixes a tenant leak.** Relation filters (`some / every / none / is /
  isNot`), and nested `delete` / `disconnect` on to-one updates now enforce
  required fields (at `strictness = "relations"` and above, the v2.0
  default). Nested relation args (`include: { posts: { where: {} } }`,
  `_count.select.posts.where`) also enforce required fields at
  `strictness = "includes"`. In v0.1 they bypassed the check silently.
- **OR / AND / NOT are permissive again.** Combinators continue to reference
  the permissive `{Model}WhereInput`, so the `{ organizationId: undefined }`
  workaround is no longer needed inside combinator branches.
- **Schema-wide `requiredFields` config.** A new generator option applies a
  required-field name to every model that has it as a scalar, additive with
  `/// @where-required`.

## Strictness levels

In v2.0, the generator accepts a `strictness` option that controls how
aggressively `where` surfaces are rewritten to `{Model}WhereInputStrict`:

```
generator whereRequired {
  provider   = "prisma-where-required"
  strictness = "relations" // "basic" | "relations" | "includes"
}
```

| Level | What it enforces |
|---|---|
| `basic` | Top-level action args only (`findMany`, `findFirst`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany`). |
| `relations` *(default)* | `basic` + relation filters (`some` / `every` / `none` / `is` / `isNot` and the XOR-direct relation shorthand) + nested to-one `delete` / `disconnect`. |
| `includes` | `relations` + every remaining `where: {Model}WhereInput` position — nested `include.*.where`, `select.*.where`, `_count.select.*.where`, and nested relation payload `upsert.where` / to-one `update.where`. Matches v1.1.0 behavior exactly. |

One example per level:

```ts
// Enforced at every level (basic / relations / includes):
// @ts-expect-error — organizationId is required
prisma.user.findMany({ where: {} })

// Enforced at `relations` and above:
// @ts-expect-error — Post.organizationId is required on the related filter
prisma.user.findMany({
  where: { organizationId: 1, posts: { some: {} } },
})

// Enforced at `includes` only:
// @ts-expect-error — nested include.where must carry organizationId
prisma.user.findMany({
  where: { organizationId: 1 },
  include: { posts: { where: {} } },
})
```

Unknown values emit a warning and fall back to the default.

### Migrating from v1.1 to v2.0

**Breaking change in v2.0:** the default `strictness` dropped from the
v1.1.0 `includes` baseline to `relations`. Consumers that rely on
enforcement of any nested `where` surface that was strict in v1.1.0 —
`include.*.where`, `select.*.where`, `_count.select.*.where`, nested
relation payload `upsert.where`, and to-one `update.where` — silently lose
it on upgrade. Opt back in explicitly:

```
generator whereRequired {
  provider   = "prisma-where-required"
  strictness = "includes"
}
```

Existing v1.1.0 consumers that upgrade without setting `strictness` will see
their nested-include compile errors disappear. The top-level action-args and
relation-filter layers continue to fire unchanged.

## Overview
prisma-where-required is a utility that enforces certain fields to be mandatory in the 'where' clause when using Prisma.
This tool was primarily created with multi-tenant systems or to perform a soft delete in mind.

Requires **Prisma 7** and the `prisma-client` generator provider.

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

*Applies at `strictness = "relations"` and above (the default).*

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
**when you pass an object** — but only at `strictness = "includes"`:

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

*Applies at `strictness = "relations"` and above (the default).*

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
`exactOptionalPropertyTypes: true`, you must pass the property explicitly.
Applies wherever the Strict alias is in effect: action-args `where` at every
level; relation filters and nested `delete` / `disconnect` at `relations`
and above; nested `include` / `select` / `_count` `where` plus nested
relation payload `upsert.where` / to-one `update.where` at `includes`.

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
| Nested `include.*.where`, `select.*.where`, `_count.select.*.where` (object form), plus nested relation payload `upsert.where` and to-one `update.where` — at `strictness = "basic"` or `"relations"` | Left permissive by default in v2.0. Opt in with `strictness = "includes"` to restore v1.1.0 enforcement. |

If you hit a case where one of these surfaces enables a tenant leak for
your system, please open an issue.

## Caution

This is type surgery on generated Prisma output. It's additive — the
package emits types alongside Prisma's own — but compatibility with
future Prisma versions is not guaranteed without updates. Only types are
affected, so opting out is as simple as removing the generator and
re-running `prisma generate`.
