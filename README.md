# prisma-where-required

[![npm version](https://img.shields.io/npm/v/@gusevp/prisma-where-required?logo=npm&color=CB3837)](https://www.npmjs.com/package/@gusevp/prisma-where-required)
[![npm downloads](https://img.shields.io/npm/dm/@gusevp/prisma-where-required?logo=npm&color=CB3837)](https://www.npmjs.com/package/@gusevp/prisma-where-required)
[![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![license](https://img.shields.io/npm/l/@gusevp/prisma-where-required?color=blue)](./LICENSE)

**Turn a forgotten tenant filter into a compile error.**

A Prisma 7 generator that makes chosen fields — `organizationId`,
`tenantId`, `deletedAt`, whatever you pick — **mandatory in every `where`
clause**. If a query can read across tenants, it doesn't build.

```ts
// ❌ Type error: Property 'organizationId' is missing
prisma.user.findMany({ where: { name: "alice" } })

// ✅ Compiles
prisma.user.findMany({ where: { organizationId: 1, name: "alice" } })
```

No runtime layer, no query middleware, no wrapper client — the generator
emits extra TypeScript types next to Prisma's own and points `where:` at
them. Zero runtime cost, zero behavior change. Delete the generator and
everything goes back to normal.

## Why

Multi-tenancy and soft deletes are enforced by convention in most Prisma
codebases: *"remember to always filter by `organizationId`"*. Convention
fails silently — one missing filter in one query is a data leak that no
test catches, because the query is perfectly valid SQL.

This generator moves that convention into the type system, where forgetting
it is loud and immediate.

## Requirements

- **Prisma 7** with the `prisma-client` generator provider
- TypeScript (the enforcement is types-only)

## Install

```bash
npm i -D @gusevp/prisma-where-required
```

## Setup

**1. Register the generator** in `schema.prisma`:

```prisma
generator whereRequired {
  provider = "prisma-where-required"
}
```

The client output path is auto-discovered — no `nodeModulePath` needed.

**2. Mark the required fields.** Two ways, freely mixable:

*Per field* — annotate the column:

```prisma
model User {
  id             Int    @id @default(autoincrement())
  name           String
  organizationId Int    /// @where-required
}
```

*Schema-wide* — name the fields once; every model with a scalar of that
name is enforced:

```prisma
generator whereRequired {
  provider       = "prisma-where-required"
  requiredFields = ["organizationId"]
}
```

A name in `requiredFields` that matches no scalar anywhere emits a warning —
handy for catching typos like `"organisationId"`.

**3. Generate:**

```bash
npx prisma generate
```

## What you get

```ts
// @ts-expect-error — args are required
prisma.user.findMany()

// @ts-expect-error — where is required
prisma.user.findMany({})

// @ts-expect-error — organizationId is required
prisma.user.findMany({ where: {} })

// compiles
prisma.user.findMany({ where: { organizationId: 1 } })
```

### The escape hatch

Querying across all tenants is still possible — you just have to say so
out loud:

```ts
prisma.user.findMany({
  where: { organizationId: undefined }, // deliberate: no tenant filter
})
```

That single explicit `undefined` is greppable in review, which is the whole
point.

### `OR` / `AND` / `NOT` stay permissive

Combinator branches reference Prisma's original permissive input type, so
they read naturally — only the outer `where` is strict:

```ts
prisma.user.findMany({
  where: {
    organizationId: 1,
    OR: [{ name: "alice" }, { name: "bob" }], // no per-branch boilerplate
  },
})
```

## Strictness levels

`strictness` controls how many `where` surfaces get the strict treatment:

```prisma
generator whereRequired {
  provider   = "prisma-where-required"
  strictness = "relations" // "basic" | "relations" | "includes"
}
```

| Level | What it enforces |
|---|---|
| `basic` | Top-level action args only — `findMany`, `findFirst`, `count`, `aggregate`, `groupBy`, `updateMany`, `deleteMany`. |
| **`relations`** *(default)* | `basic` + relation filters (`some` / `every` / `none` / `is` / `isNot`, plus the XOR-direct relation shorthand) + nested to-one `delete` / `disconnect`. |
| `includes` | `relations` + every remaining `where` position — nested `include.*.where`, `select.*.where`, `_count.select.*.where`, nested relation payload `upsert.where` and to-one `update.where`. |

One example per level:

```ts
// basic and above:
// @ts-expect-error — organizationId is required
prisma.user.findMany({ where: {} })

// relations and above — blocks cross-tenant traversal:
// @ts-expect-error — Post.organizationId is required on the related filter
prisma.user.findMany({
  where: { organizationId: 1, posts: { some: {} } },
})

// includes only:
// @ts-expect-error — nested include.where must carry organizationId
prisma.user.findMany({
  where: { organizationId: 1 },
  include: { posts: { where: {} } },
})
```

An unrecognized value warns and falls back to the default.

### Relation filters (`relations` and above)

`some`, `every`, `none`, `is`, `isNot` and the direct relation shorthand all
route through the strict type of the *target* model:

```ts
// ✅
prisma.user.findMany({
  where: { organizationId: 1, posts: { some: { organizationId: 1 } } },
})
```

### Nested `delete` / `disconnect` (`relations` and above)

On to-one nested update payloads, Prisma accepts `delete` / `disconnect` as
`true` or as a filter object. The filter branch is strict, so you can't
detach a related row on an under-scoped match:

```ts
// @ts-expect-error — owner is a User, organizationId required
prisma.memo.update({
  where: { id: 1, organizationId: 1 },
  data: { owner: { delete: { name: "x" } } },
})

// ✅ explicit filter
prisma.memo.update({
  where: { id: 1, organizationId: 1 },
  data: { owner: { delete: { organizationId: 1, name: "x" } } },
})

// ✅ boolean shorthand — already scoped by the outer strict `where`
prisma.memo.update({
  where: { id: 1, organizationId: 1 },
  data: { owner: { delete: true } },
})
```

## How it works

Prisma's `{Model}WhereInput` is left **completely untouched**. For each model
with required fields the generator emits a sibling type:

```ts
export type UserWhereInputStrict =
  Omit<Prisma.UserWhereInput, 'organizationId'> & {
    organizationId: Prisma.IntFilter<"User"> | number | undefined
  }
```

…then rewrites the `where:` positions selected by `strictness` to point at
it. Anything referencing `UserWhereInput` directly — including Prisma's own
internals and your existing helper types — keeps working unchanged.

Practical consequence: TypeScript errors mention `UserWhereInputStrict`.
That's the enforced variant, not a broken import.

## Surfaces left permissive by design

| Surface | Why |
|---|---|
| `{Model}WhereUniqueInput` | Unique lookups are primary-key-scoped already; requiring the tenant field would be redundant. |
| `groupBy.having` (`ScalarWhereWithAggregatesInput`) | Operates on already-grouped rows — the outer `where` was strict. |
| `{Model}ScalarWhereInput` (nested `updateMany`) | Not a common leak path. |
| `cursor` | Uses `WhereUniqueInput`. |
| `data` (create/update payloads) | Not a filter surface. |
| Boolean relation reads — `include: { posts: true }`, `select: { posts: true }`, `_count: { select: { posts: true } }`, fluent `user.posts()` | Scoped through the parent's strict `where`. Assumes a related row's tenant column matches its parent's. If yours can diverge, filter explicitly: `include: { posts: { where: { organizationId: 1 } } }`. |
| Nested `include.*.where`, `select.*.where`, `_count.select.*.where`, nested `upsert.where` / to-one `update.where` | Permissive at `basic` / `relations`; opt in with `strictness = "includes"`. |

Found a case where one of these leaks for your setup? Open an issue.

## Caveat: `exactOptionalPropertyTypes: true`

The strict type declares `field: T | undefined`, not `field?: T` — the
property must be *present*, only its value may be `undefined`. Under
`exactOptionalPropertyTypes`, that means passing it explicitly:

```ts
// ✗ property must be present
prisma.user.findMany({ where: {} })

// ✓
prisma.user.findMany({ where: { organizationId: undefined } })
```

Applies wherever the strict type is in effect for your `strictness` level.

## Upgrading from v1.1 to v2.0

**Breaking:** the default strictness dropped from v1.1.0's `includes`
behavior to `relations`. Nested `include.*.where`, `select.*.where`,
`_count.select.*.where`, nested `upsert.where` and to-one `update.where`
are no longer enforced unless you ask for them. Upgrading without setting
`strictness` makes those compile errors quietly disappear.

Restore the old behavior explicitly:

```prisma
generator whereRequired {
  provider   = "prisma-where-required"
  strictness = "includes"
}
```

Top-level action args and relation filters are unchanged.

<details>
<summary>Earlier releases</summary>

**v1.1.0** — introduced the `{Model}WhereInputStrict` sibling-type
architecture (v0.1 mutated `WhereInput` in place, which made required-ness
viral through `OR` / `AND` / `NOT` and forced a
`{ organizationId: undefined }` in every branch). It also closed a tenant
leak: relation filters and nested to-one `delete` / `disconnect` silently
bypassed the check in v0.1. Added the schema-wide `requiredFields` option.

</details>

## Caution

This is type surgery on generated Prisma output. It's additive — nothing of
Prisma's is overwritten — but compatibility with future Prisma versions
isn't guaranteed without updates. Only types are affected, so opting out is
just removing the generator block and re-running `prisma generate`.

## Credits

Based on [@kz-d/prisma-where-required](https://github.com/kz-d/prisma-where-required)
— the core idea of patching Prisma's generated types to force a field into
`where` is kz-d's. This package has since been rewritten for Prisma 7's
`prisma-client` generator, re-architected around the strict sibling type,
and extended with strictness levels.

## License

[MIT](./LICENSE)
