#!/usr/bin/env node

import { generatorHandler } from "@prisma/generator-helper";
import type { DMMF } from "@prisma/generator-helper";
import { logger } from "@prisma/internals";
import { existsSync, readdirSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { convert, rewriteWhereReferencesPass } from "./convertor";

const WHERE_REQUIRED_ANNOTATION = "@where-required";
const CLIENT_GENERATOR_PROVIDER = "prisma-client";

/**
 * Parses the `requiredFields` generator config value.
 *
 * Accepts either a string (single field) or string[] (multiple fields) since
 * Prisma's generator config values can arrive as either. Trims each entry,
 * drops empty strings, and dedupes the result.
 */
function parseRequiredFieldsConfig(
  raw: string | string[] | undefined,
): string[] {
  if (raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of list) {
    if (typeof entry !== "string") continue;
    const trimmed = entry.trim();
    if (trimmed.length === 0) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
  }
  return result;
}

/**
 * Collects required fields per model by combining:
 *   - Fields annotated with `/// @where-required` in the Prisma schema
 *   - Scalar fields whose name matches an entry in `configFields`
 *
 * Returns a `Map<modelName, requiredFieldNames[]>`. Only models with at least
 * one required field are present. Field order is stable (annotation first,
 * then config-matched, deduped within each model).
 *
 * Also returns `unusedConfigFields`: entries from `configFields` that did not
 * match any scalar field on any model (useful for typo warnings).
 */
function collectRequiredFields(
  dmmf: DMMF.Document,
  configFields: string[],
): {
  requiredByModel: Map<string, string[]>;
  unusedConfigFields: string[];
} {
  const requiredByModel = new Map<string, string[]>();
  const matchedConfigFields = new Set<string>();
  const configFieldSet = new Set(configFields);

  for (const model of dmmf.datamodel.models) {
    const annotated = model.fields
      .filter((f) => f.documentation?.includes(WHERE_REQUIRED_ANNOTATION))
      .map((f) => f.name);

    // Only scalar (kind === "scalar") fields are eligible for config matching.
    // Relations and enums shouldn't be matched via the `requiredFields` option.
    const configMatched = model.fields
      .filter((f) => f.kind === "scalar" && configFieldSet.has(f.name))
      .map((f) => f.name);

    for (const name of configMatched) {
      matchedConfigFields.add(name);
    }

    const combined: string[] = [];
    const seen = new Set<string>();
    for (const name of [...annotated, ...configMatched]) {
      if (seen.has(name)) continue;
      seen.add(name);
      combined.push(name);
    }

    if (combined.length > 0) {
      requiredByModel.set(model.name, combined);
    }
  }

  const unusedConfigFields = configFields.filter(
    (f) => !matchedConfigFields.has(f),
  );

  return { requiredByModel, unusedConfigFields };
}

generatorHandler({
  onManifest: () => ({
    prettyName: "where-required",
    requiresGenerators: [CLIENT_GENERATOR_PROVIDER],
    defaultOutput: ".",
  }),
  onGenerate: async (options) => {
    const clientGenerator = options.otherGenerators.find(
      (gc) => gc.provider.value === CLIENT_GENERATOR_PROVIDER,
    );
    if (!clientGenerator) {
      logger.error(`No ${CLIENT_GENERATOR_PROVIDER} generator found.`);
      return;
    }

    const clientOutputRaw = clientGenerator.output?.value;
    if (!clientOutputRaw) {
      logger.error(
        "Prisma client generator has no `output` configured. " +
          "The `prisma-client` provider requires an explicit output path.",
      );
      return;
    }

    const schemaDir = options.schemaPath
      ? resolve(options.schemaPath, "..")
      : process.cwd();
    const clientOutput = isAbsolute(clientOutputRaw)
      ? clientOutputRaw
      : resolve(schemaDir, clientOutputRaw);

    const modelsDir = join(clientOutput, "models");
    if (!existsSync(modelsDir)) {
      logger.error(
        `Expected per-model files at ${modelsDir}, but the directory does not exist.`,
      );
      return;
    }

    const debug = options.generator.config.debug === "true";

    const configFields = parseRequiredFieldsConfig(
      options.generator.config.requiredFields,
    );
    const { requiredByModel, unusedConfigFields } = collectRequiredFields(
      options.dmmf,
      configFields,
    );

    if (unusedConfigFields.length > 0) {
      logger.warn(
        `prisma-where-required: \`requiredFields\` entries did not match any model's scalar field: ${unusedConfigFields
          .map((f) => `"${f}"`)
          .join(", ")}. Check for typos.`,
      );
    }

    // Pass 1 (per-model): emit `{Model}WhereInputStrict` next to each
    // required model's WhereInput and strip `?` from delegate method args.
    // Only models with required fields participate.
    for (const [modelName, fields] of requiredByModel.entries()) {
      const modelFile = join(modelsDir, `${modelName}.ts`);
      if (!existsSync(modelFile)) {
        logger.warn(
          `Skipping ${modelName}: expected file ${modelFile} does not exist.`,
        );
        continue;
      }
      convert({ path: modelFile, modelName, fields, debug });
    }

    // Pass 2 (global): rewrite every `where: (Prisma.)?{Model}WhereInput`
    // reference across *all* model files to point at the Strict alias
    // (and drop the `?`). Must visit every file, not just files for
    // required models — e.g. `User$postsArgs.where` lives in `User.ts`
    // but targets `Post`, and `Tag.ts` might reference a required model
    // via some future nested arg. Files whose content has no matching
    // reference are a no-op.
    const requiredSet = new Set(requiredByModel.keys());
    if (requiredSet.size > 0) {
      const modelFiles = readdirSync(modelsDir).filter((f) =>
        f.endsWith(".ts"),
      );
      const modelSet = new Set(
        modelFiles.map((f) => f.slice(0, -".ts".length)),
      );
      for (const file of modelFiles) {
        rewriteWhereReferencesPass({
          path: join(modelsDir, file),
          requiredSet,
          modelSet,
          debug,
        });
      }
    }
  },
});
