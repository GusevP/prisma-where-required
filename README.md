# prisma-where-required (Prisma 7 fork)

Fork of [@kz-d/prisma-where-required](https://github.com/kz-d/prisma-where-required)
adapted to Prisma 7's new `prisma-client` generator. Original design and
implementation by kz-d; this fork updates the generator to target the
per-model file layout produced by the Rust-free Prisma client.

## What changed vs the original
- `requiresGenerators` switched from `prisma-client-js` to `prisma-client`.
- The generator now reads the client's custom `output` path from
  `options.otherGenerators` instead of `node_modules/.prisma/client`.
- The convertor patches `{output}/models/{ModelName}.ts` per model instead
  of a single `index.d.ts`, since Prisma 7 emits one file per model.
- Type references to `WhereInput` inside the same file are matched both as
  `ModelWhereInput` and the namespace-qualified `Prisma.ModelWhereInput`.

No schema-side API changes — `/// @where-required` and the
`where: { organizations: undefined }` escape hatch work identically.

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

3. Add /// @where-required to the columns you want to make mandatory:

```
model User {
  id    Int     @id @default(autoincrement())
  name String
  organizationId Int  /// @where-required
}
```

4. `npx prisma generate`

After these steps, your code will display the following behaviour:

```
// @ts-expect-error args are required
prisma.user.findMany()

// @ts-expect-error where is required
prisma.user.findMany({})

// @ts-expect-error organizationId is required
prisma.user.findMany({where: {}})

// compile ok
prisma.user.findMany({where: {organizationId: 1}})
```

If you want to perform a search across all records for the mandatory field, you need to **explicitly specify undefined**:

```
prisma.user.findMany({
    where: { organizationId: undefined } // You can fetch all records by bypassing the organizationId.
})
```

## Caution
This implementation is somewhat forceful and the compatibility with future versions of Prisma is uncertain. In particular, using OR, AND, NOT or nested where clauses requires a very verbose and awkward writing style.  
Please exercise careful judgement when applying this to a production environment.

However, it's worth noting that this tool only impacts types, making it easy to opt-out if necessary.

