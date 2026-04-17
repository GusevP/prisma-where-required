#!/usr/bin/env node

import { generatorHandler } from "@prisma/generator-helper";
import { logger } from "@prisma/internals";
import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";

import { convert } from "./convertor";

const WHERE_REQUIRED_ANNOTATION = "@where-required";
const CLIENT_GENERATOR_PROVIDER = "prisma-client";

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

    const requiredModelAndFields = new Map<string, string[]>();
    for (const model of options.dmmf.datamodel.models) {
      const fields = model.fields
        .filter((f) => f.documentation?.includes(WHERE_REQUIRED_ANNOTATION))
        .map((f) => f.name);
      if (fields.length > 0) {
        requiredModelAndFields.set(model.name, fields);
      }
    }

    for (const [modelName, fields] of requiredModelAndFields.entries()) {
      const modelFile = join(modelsDir, `${modelName}.ts`);
      if (!existsSync(modelFile)) {
        logger.warn(
          `Skipping ${modelName}: expected file ${modelFile} does not exist.`,
        );
        continue;
      }
      convert({ path: modelFile, modelName, fields, debug });
    }
  },
});
