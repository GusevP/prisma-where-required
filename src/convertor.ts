import { Project, Node, SourceFile, TypeAliasDeclaration } from "ts-morph";

// In Prisma 7's `prisma-client` provider, types are top-level exports of
// per-model files (`{output}/models/{ModelName}.ts`) — there is no
// `module "Prisma"` wrapper like the legacy `prisma-client-js` produced.
// References to the WhereInput inside the same file are qualified as
// `Prisma.<Model>WhereInput`; we match both the qualified and unqualified
// spellings to stay forward-compatible.

function removeQuestionTokenFromTargetFieldProperty(
  sourceFile: SourceFile,
  modelName: string,
  fields: string[],
  debug: boolean,
) {
  const whereInput = sourceFile.getTypeAlias(`${modelName}WhereInput`);
  if (!whereInput) return;

  const typeNode = whereInput.getTypeNodeOrThrow();
  if (!Node.isTypeLiteral(typeNode)) return;

  for (const property of typeNode.getProperties()) {
    if (!Node.isPropertySignature(property)) continue;
    const propertyName = property.getName();
    if (!fields.includes(propertyName)) continue;

    const currentType = property.getTypeNode()!.getText();
    if (debug) {
      console.debug(
        `remove question token from ${modelName}.${propertyName}`,
      );
      console.debug(`add undefined type to ${modelName}.${propertyName}`);
    }
    property.replaceWithText(
      `${propertyName}: ${currentType} | undefined;`,
    );
  }
}

function removeQuestionTokenFromWhereFieldProperty(
  sourceFile: SourceFile,
  modelName: string,
  debug: boolean,
) {
  const whereInputName = `${modelName}WhereInput`;
  const acceptableTypeTexts = new Set([
    whereInputName,
    `Prisma.${whereInputName}`,
  ]);

  const candidates: TypeAliasDeclaration[] = sourceFile
    .getTypeAliases()
    .filter((t) => {
      const name = t.getName();
      // `${Model}$...` are variadic/extension types — match the original
      // generator's exclusion.
      return name.startsWith(modelName) && !name.startsWith(`${modelName}$`);
    });

  for (const candidate of candidates) {
    const typeNode = candidate.getTypeNodeOrThrow();
    if (!Node.isTypeLiteral(typeNode)) continue;

    for (const property of typeNode.getMembers()) {
      if (!Node.isPropertySignature(property)) continue;
      if (property.getName() !== "where") continue;
      if (!property.hasQuestionToken()) continue;

      const propertyTypeNode = property.getTypeNode();
      if (!propertyTypeNode) continue;
      if (!acceptableTypeTexts.has(propertyTypeNode.getText())) continue;

      if (debug) {
        console.debug(
          `remove question token from ${candidate.getName()}.where`,
        );
      }
      property.setHasQuestionToken(false);
    }
  }
}

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

export function convert(args: {
  path: string;
  modelName: string;
  fields: Array<string>;
  debug: boolean;
}) {
  const project = new Project();
  const sourceFile = project.addSourceFileAtPath(args.path);

  removeQuestionTokenFromTargetFieldProperty(
    sourceFile,
    args.modelName,
    args.fields,
    args.debug,
  );
  removeQuestionTokenFromWhereFieldProperty(
    sourceFile,
    args.modelName,
    args.debug,
  );
  removeQuestionTokenFromActionFuncProperty(
    sourceFile,
    args.modelName,
    args.debug,
  );

  sourceFile.saveSync();
}
