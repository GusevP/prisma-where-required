import { Project, Node, PropertySignature, SourceFile } from "ts-morph";

// In Prisma 7's `prisma-client` provider, types are top-level exports of
// per-model files (`{output}/models/{ModelName}.ts`) — there is no
// `module "Prisma"` wrapper like the legacy `prisma-client-js` produced.
// References to the WhereInput inside the same file are qualified as
// `Prisma.<Model>WhereInput`; we match both the qualified and unqualified
// spellings to stay forward-compatible.

/**
 * Append an exported `{Model}WhereInputStrict` alias to the source file.
 *
 * The alias reuses `Omit<{Model}WhereInput, 'f1'|...>` to keep the original
 * permissive type in sync, then intersects with an object type that promotes
 * each required field back to *non-optional* (no `?`) with its original type
 * union widened by `| undefined`. This preserves the `{ field: undefined }`
 * escape hatch while forcing callers to spell the field out.
 *
 * No-ops silently if the base WhereInput is missing or has no matching
 * required fields — shouldn't happen for real Prisma output, but keeps the
 * caller from crashing on malformed fixtures.
 */
function emitStrictAlias(
  sourceFile: SourceFile,
  modelName: string,
  fields: string[],
  debug: boolean,
): void {
  const whereInput = sourceFile.getTypeAlias(`${modelName}WhereInput`);
  if (!whereInput) return;

  const typeNode = whereInput.getTypeNodeOrThrow();
  if (!Node.isTypeLiteral(typeNode)) return;

  // Look up each required field's *original* type text directly from the
  // pristine `{Model}WhereInput`. This works because we no longer mutate
  // the base WhereInput — Task 2 removed `removeQuestionTokenFromTargetFieldProperty`.
  // We iterate `fields` in caller order so the generated alias reads
  // deterministically (annotation-first, then config-matched).
  const ordered: Array<{ name: string; typeText: string }> = [];
  const propertiesByName = new Map<string, PropertySignature>();
  for (const property of typeNode.getProperties()) {
    if (!Node.isPropertySignature(property)) continue;
    propertiesByName.set(property.getName(), property);
  }
  for (const name of fields) {
    const property = propertiesByName.get(name);
    if (!property) continue;
    const typeText = property.getTypeNode()?.getText();
    if (!typeText) continue;
    ordered.push({ name, typeText });
  }
  if (ordered.length === 0) return;

  const omitKeys = ordered.map(({ name }) => `'${name}'`).join(" | ");
  const overrides = ordered
    .map(({ name, typeText }) => `  ${name}: ${typeText} | undefined`)
    .join(";\n");

  const aliasText =
    `\nexport type ${modelName}WhereInputStrict = ` +
    `Omit<${modelName}WhereInput, ${omitKeys}> & {\n${overrides};\n}\n`;

  if (debug) {
    console.debug(
      `emit ${modelName}WhereInputStrict for fields: ${ordered
        .map((f) => f.name)
        .join(", ")}`,
    );
  }

  sourceFile.addStatements(aliasText);
}

/**
 * Walk every type alias in the file and rewrite any `where` PropertySignature
 * whose type resolves to `(Prisma.)?{Model}WhereInput` where `Model` is in
 * `requiredSet`. The property gets its `?` dropped and its type switched to
 * the `...Strict` sibling.
 *
 * No `${Model}$...` exclusion — nested args like `User$postsArgs` *must* be
 * rewritten too (that's the cross-file tenant-leak fix this refactor
 * enables).
 */
function rewriteWhereReferences(
  sourceFile: SourceFile,
  requiredSet: Set<string>,
  debug: boolean,
) {
  if (requiredSet.size === 0) return;

  for (const alias of sourceFile.getTypeAliases()) {
    const typeNode = alias.getTypeNodeOrThrow();
    if (!Node.isTypeLiteral(typeNode)) continue;

    for (const property of typeNode.getMembers()) {
      if (!Node.isPropertySignature(property)) continue;
      if (property.getName() !== "where") continue;

      const propertyTypeNode = property.getTypeNode();
      if (!propertyTypeNode) continue;
      const typeText = propertyTypeNode.getText();

      // Match `{Model}WhereInput` or `Prisma.{Model}WhereInput` exactly —
      // no tolerance for surrounding unions/generics or a trailing `| null`
      // (nested args' `where` is never nullable). Capture the optional
      // `Prisma.` prefix so we can mirror it on the rewrite.
      const match = WHERE_INPUT_RE.exec(typeText);
      if (!match) continue;
      const prefix = match[1] ?? "";
      const targetModel = match[2];
      if (!requiredSet.has(targetModel)) continue;

      const newText = `${prefix}${targetModel}WhereInputStrict`;

      if (debug) {
        console.debug(
          `rewrite ${alias.getName()}.where: ${typeText} -> ${newText}` +
            (property.hasQuestionToken() ? " (drop ?)" : ""),
        );
      }

      propertyTypeNode.replaceWithText(newText);
      if (property.hasQuestionToken()) {
        property.setHasQuestionToken(false);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// XOR occurrence classification (audit — see Task 3 pre-work in
// docs/plans/20260417-strict-alias-refactor.md).
//
// Surveyed `generated/prisma/models/*.ts`. XOR<_, _> positions fall into
// three buckets:
//
//   (a) Relation filter inside {Model}WhereInput — **TARGET** for rewrite.
//       - `PostWhereInput.author?: Prisma.XOR<Prisma.UserScalarRelationFilter,
//          Prisma.UserWhereInput>`
//       - `MemoWhereInput.owner?: Prisma.XOR<Prisma.UserNullableScalarRelationFilter,
//          Prisma.UserWhereInput> | null`  (note trailing `| null` on nullable
//          relations — the matcher allows an optional ` | null` tail)
//
//   (b) Inside {Model}WhereUniqueInput — **NON-TARGET** (per plan Non-goals:
//       unique lookups are primary-key-scoped; re-requiring tenant field
//       would force redundant filtering). The `{Model}WhereUniqueInput =
//       Prisma.AtLeast<{ ... }, "id">` wrapper uses a type literal, not a
//       named type alias matching `{Model}WhereInput`, so the "enclosing
//       alias name" gate excludes these automatically.
//
//   (c) Nested create/update/upsert/data payloads — **NON-TARGET**. These
//       live inside type aliases named e.g. `PostCreateNestedManyWithoutAuthorInput`,
//       `PostCreateOrConnectWithoutAuthorInput`, `{Model}UpsertArgs`, etc.
//       The property names there are `create`, `update`, `data` — never
//       `where`/`is`/`isNot`/`some`/`every`/`none`. The enclosing-alias-name
//       gate (`{Model}WhereInput` exactly) excludes them.
//
// Future Prisma upgrades: re-run `grep -rn "XOR<" generated/prisma/models`
// and reconfirm every occurrence still falls into (a), (b), or (c).
// ---------------------------------------------------------------------------
//
// `delete` / `disconnect` on to-one nested update payloads — **TARGET** for
// rewrite. Prisma emits these inside `{Model}UpdateOne…NestedInput` aliases
// (e.g. `UserUpdateOneWithoutMemosNestedInput`) as:
//
//   disconnect?: Prisma.UserWhereInput | boolean
//   delete?:     Prisma.UserWhereInput | boolean
//
// This is a real tenant-leak surface: `memo.update({ data: { owner: { delete:
// { name: "x" } } } })` would otherwise let a caller unconditionally delete a
// User row across tenants. The rewrite mirrors the relation-filter treatment
// — swap the WhereInput reference to its `...Strict` sibling, keep the `?`
// (the property itself is naturally optional — opting out of delete/disconnect
// is valid; what we want to prevent is passing an under-filtered WhereInput).
// List-relation variants use `WhereUniqueInput` (non-goal per the table), so
// only the to-one `WhereInput | boolean` shape matches here. The matcher
// tolerates an optional trailing `| null` for defensive future-proofing.
// ---------------------------------------------------------------------------

const RELATION_FILTER_PROPERTY_NAMES = new Set([
  "is",
  "isNot",
  "some",
  "every",
  "none",
]);

/**
 * Property names on nested to-one update payloads that accept a
 * `{Model}WhereInput | boolean` value. These are the filter surfaces where
 * Prisma lets callers "delete/disconnect the related row if it matches this
 * filter, or unconditionally if `true`". An under-filtered WhereInput here
 * is a tenant-leak, so we rewrite to the Strict alias.
 */
const TO_ONE_UPDATE_PROPERTY_NAMES = new Set(["delete", "disconnect"]);

/**
 * Match `(Prisma.)?{Model}WhereInput` exactly — no trailing `| null`. Used
 * by the nested-args `where`-reference rewrite in `rewriteWhereReferences`,
 * where nullable tails never appear. Captures:
 *   - group 1: the `Prisma.` prefix (or empty)
 *   - group 2: the model name
 */
const WHERE_INPUT_RE = /^(Prisma\.)?([A-Za-z0-9_]+)WhereInput$/;

/**
 * Match `(Prisma.)?{Model}WhereInput` optionally followed by ` | null` (for
 * nullable relation filters like `owner?: XOR<…> | null`). Captures:
 *   - group 1: the `Prisma.` prefix (or empty)
 *   - group 2: the model name
 *   - group 3: the trailing `| null` (or empty)
 *
 * Sibling of `WHERE_INPUT_RE` — differs only in the optional `| null` tail,
 * which relation-filter positions require but nested-args `where` does not.
 */
const BARE_WHERE_INPUT_RE =
  /^(Prisma\.)?([A-Za-z0-9_]+)WhereInput(\s*\|\s*null)?$/;

/**
 * Match a type-alias name that looks like a `{Model}WhereInput` and capture
 * the `{Model}` prefix. Used to gate the XOR-relation-filter rewrite to
 * WhereInput-typed aliases only (see `rewriteRelationFilterReferences` rule 2).
 *
 * Whether the alias is a *real* `{Model}WhereInput` vs a generated helper like
 * `{Model}ScalarWhereInput` (Prisma's per-field scalar filter used inside
 * `updateMany` nested payloads — a documented non-goal) is decided by looking
 * the captured prefix up in the model-name set passed into the rewrite. A
 * name-only check (e.g. `(?<!Scalar)`) would false-positive any user model
 * whose name ends with `Scalar` (its own `FooScalarWhereInput` would be
 * misclassified as the helper and skipped).
 */
const WHERE_INPUT_ALIAS_NAME_RE = /^([A-Za-z0-9_]+)WhereInput$/;

/**
 * Match `(Prisma.)?{Model}WhereInput | boolean` optionally followed by
 * ` | null`. Used by the `delete`/`disconnect` rewrite on to-one nested update
 * payloads (e.g. `UserUpdateOneWithoutMemosNestedInput`). Captures:
 *   - group 1: the `Prisma.` prefix (or empty)
 *   - group 2: the model name
 *   - group 3: the trailing `| null` (or empty)
 *
 * The ` | boolean` segment is required (fixed text) — that's how we
 * distinguish this to-one surface from the list-relation variants that use
 * `WhereUniqueInput` (and which are deliberate non-goals).
 */
const WHERE_INPUT_OR_BOOLEAN_RE =
  /^(Prisma\.)?([A-Za-z0-9_]+)WhereInput\s*\|\s*boolean(\s*\|\s*null)?$/;

/**
 * Match `(Prisma.)?XOR<FIRST, (Prisma.)?{Model}WhereInput>` optionally
 * followed by ` | null`. We capture:
 *   - group 1: the `Prisma.` prefix on the XOR itself (or empty)
 *   - group 2: the first XOR argument verbatim (e.g. `Prisma.UserScalarRelationFilter`)
 *   - group 3: the `Prisma.` prefix on the second argument (or empty)
 *   - group 4: the model name (e.g. `User`)
 *   - group 5: the trailing `| null` (or empty)
 *
 * The first-argument capture uses `[^<>]*` — safe because the relation-filter
 * types Prisma emits (`UserScalarRelationFilter`, `UserNullableScalarRelationFilter`)
 * have no generic parameters. If a future Prisma version introduces nested
 * generics here, this regex would need tightening.
 */
const RELATION_XOR_RE =
  /^(Prisma\.)?XOR<([^<>]+),\s*(Prisma\.)?([A-Za-z0-9_]+)WhereInput>(\s*\|\s*null)?$/;

/**
 * Rewrite relation-filter positions in a single source file:
 *   1. `is`/`isNot`/`some`/`every`/`none` PropertySignature whose type is
 *      `(Prisma.)?{M}WhereInput` with M ∈ requiredSet → swap to `…Strict`,
 *      keep `?` (these are naturally optional and dropping `?` would force
 *      callers to spell them out, which we don't want).
 *   2. PropertySignature inside a `{Model}WhereInput` alias — where `Model`
 *      is a real model (any model — even ones without required fields,
 *      because relation filters cross models) — whose type matches
 *      `XOR<…, (Prisma.)?{T}WhereInput>` with T ∈ requiredSet → swap the
 *      second XOR argument to `…Strict`, keep `?`. The model-name gate
 *      excludes generated helpers like `{Model}ScalarWhereInput`.
 *   3. `delete`/`disconnect` PropertySignature whose type is
 *      `(Prisma.)?{M}WhereInput | boolean` (with optional `| null` tail) and
 *      M ∈ requiredSet → swap the WhereInput reference to `…Strict`, keep `?`.
 *      Covers to-one nested update payloads like
 *      `UserUpdateOneWithoutMemosNestedInput` — see classification comment
 *      above for why this is a tenant-leak surface.
 *
 * The enclosing-alias-name gate on rule 2 is critical: it restricts XOR
 * rewrites to relation-filter positions, leaving WhereUniqueInput and nested
 * update/upsert payloads alone (see classification comment above). Rule 3
 * doesn't need that gate because the `| boolean` suffix + property-name gate
 * together are specific enough — list-relation `delete`/`disconnect` use
 * `WhereUniqueInput | WhereUniqueInput[]` (no `| boolean`), and arbitrary
 * user-named scalar fields don't carry a `WhereInput | boolean` type.
 */
function rewriteRelationFilterReferences(
  sourceFile: SourceFile,
  requiredSet: Set<string>,
  modelSet: Set<string>,
  debug: boolean,
) {
  if (requiredSet.size === 0) return;

  for (const alias of sourceFile.getTypeAliases()) {
    const typeNode = alias.getTypeNodeOrThrow();
    if (!Node.isTypeLiteral(typeNode)) continue;

    const aliasName = alias.getName();
    const aliasWhereInputMatch = WHERE_INPUT_ALIAS_NAME_RE.exec(aliasName);
    const aliasIsWhereInput =
      aliasWhereInputMatch !== null && modelSet.has(aliasWhereInputMatch[1]);

    for (const property of typeNode.getMembers()) {
      if (!Node.isPropertySignature(property)) continue;
      const propertyTypeNode = property.getTypeNode();
      if (!propertyTypeNode) continue;
      const typeText = propertyTypeNode.getText();
      const propertyName = property.getName();

      // Rule 1: is/isNot/some/every/none — bare WhereInput type reference.
      if (RELATION_FILTER_PROPERTY_NAMES.has(propertyName)) {
        const match = BARE_WHERE_INPUT_RE.exec(typeText);
        if (match) {
          const prefix = match[1] ?? "";
          const targetModel = match[2];
          const nullTail = match[3] ?? "";
          if (!requiredSet.has(targetModel)) continue;

          const newText = `${prefix}${targetModel}WhereInputStrict${nullTail}`;

          if (debug) {
            console.debug(
              `rewrite ${aliasName}.${propertyName}: ${typeText} -> ${newText}`,
            );
          }
          propertyTypeNode.replaceWithText(newText);
          continue;
        }
      }

      // Rule 3: delete/disconnect on to-one nested update payloads. Runs
      // before the XOR rule so its enclosing-alias gate doesn't filter these
      // out (the alias here is `{Model}UpdateOne…NestedInput`, never a
      // `{Model}WhereInput`).
      if (TO_ONE_UPDATE_PROPERTY_NAMES.has(propertyName)) {
        const match = WHERE_INPUT_OR_BOOLEAN_RE.exec(typeText);
        if (match) {
          const prefix = match[1] ?? "";
          const targetModel = match[2];
          const nullTail = match[3] ?? "";
          if (!requiredSet.has(targetModel)) continue;

          const newText = `${prefix}${targetModel}WhereInputStrict | boolean${nullTail}`;

          if (debug) {
            console.debug(
              `rewrite ${aliasName}.${propertyName}: ${typeText} -> ${newText}`,
            );
          }
          propertyTypeNode.replaceWithText(newText);
          continue;
        }
      }

      // Rule 2: XOR-embedded WhereInput inside a {Model}WhereInput alias.
      if (!aliasIsWhereInput) continue;

      const xorMatch = RELATION_XOR_RE.exec(typeText);
      if (!xorMatch) continue;

      const xorPrefix = xorMatch[1] ?? "";
      const firstArg = xorMatch[2].trim();
      const secondPrefix = xorMatch[3] ?? "";
      const targetModel = xorMatch[4];
      const nullTail = xorMatch[5] ?? "";
      if (!requiredSet.has(targetModel)) continue;

      const newText = `${xorPrefix}XOR<${firstArg}, ${secondPrefix}${targetModel}WhereInputStrict>${nullTail}`;

      if (debug) {
        console.debug(
          `rewrite ${aliasName}.${propertyName}: ${typeText} -> ${newText}`,
        );
      }
      propertyTypeNode.replaceWithText(newText);
    }
  }
}

/**
 * Drop `?` from the args parameter on every method of `{Model}Delegate`.
 * The delegate's generated signature is e.g. `findMany(args?: UserFindManyArgs)`;
 * the underlying arg type is already strictified via `rewriteWhereReferences`,
 * so we just have to stop TS from letting callers pass nothing at all.
 *
 * Unchanged from v0.1 — kept verbatim so the delegate-call site tests still
 * cover it.
 */
function removeQuestionTokenFromActionFuncProperty(
  sourceFile: SourceFile,
  modelName: string,
  debug: boolean,
) {
  const delegate = sourceFile.getInterface(`${modelName}Delegate`);
  if (!delegate) return;

  for (const method of delegate.getMethods()) {
    const parameter = method.getParameters()[0];
    if (!parameter) continue;
    if (!parameter.hasQuestionToken()) continue;

    if (debug) {
      console.debug(
        `remove question token from ${modelName}Delegate.${method.getName()}.args`,
      );
    }
    parameter.setHasQuestionToken(false);
  }
}

/**
 * Per-model pass: open the model file, emit the `...Strict` alias, and drop
 * `?` from every delegate method's args parameter.
 *
 * The global `where`-reference rewrite happens in `rewriteWhereReferencesPass`
 * so it can see the full `requiredSet` across all model files (cross-file
 * references like `User$postsArgs.where: Prisma.PostWhereInput` need the set,
 * not just the current model).
 */
export function convert(args: {
  path: string;
  modelName: string;
  fields: Array<string>;
  debug: boolean;
}) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(args.path);

  emitStrictAlias(sourceFile, args.modelName, args.fields, args.debug);
  removeQuestionTokenFromActionFuncProperty(
    sourceFile,
    args.modelName,
    args.debug,
  );

  sourceFile.saveSync();
}

/**
 * Global pass: walk every `where` PropertySignature in the given file and
 * rewrite it to reference `{Model}WhereInputStrict` (with `?` dropped) when
 * the target model is in `requiredSet`.
 *
 * Exported as a separate function from `convert` because the orchestrator
 * (`generator.ts`) needs to run this over *every* model file — even files
 * for models that themselves have no required fields — since a model's file
 * can contain nested args referencing another model's where.
 */
export function rewriteWhereReferencesPass(args: {
  path: string;
  requiredSet: Set<string>;
  modelSet: Set<string>;
  debug: boolean;
}) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(args.path);

  rewriteWhereReferences(sourceFile, args.requiredSet, args.debug);
  rewriteRelationFilterReferences(
    sourceFile,
    args.requiredSet,
    args.modelSet,
    args.debug,
  );

  sourceFile.saveSync();
}
