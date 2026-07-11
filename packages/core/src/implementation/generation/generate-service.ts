import path from "node:path";
import { ensureDir, fileExists, readJson, writeJson } from "../io/fs";
import { validateApsManifest } from "../../protocol/compatibility";
import { validateGovernance } from "../../protocol/governance";
import { extractReadmeFacts } from "./extractors/readme-extractor";
import { extractStorybookFacts } from "./extractors/storybook-extractor";
import { extractTypeScriptComponents } from "./extractors/typescript-extractor";
import { buildComponentResource } from "./resource-builders/component-builder";
import { buildExamplesNotImplemented } from "./resource-builders/example-builder";
import type { GenerateOutput, GenerateReport, GeneratedComponentResource } from "./types";

type PackageJson = {
  name?: unknown;
};

type GenerateOptions = {
  force?: boolean;
};

function hasHumanMetadata(component: GeneratedComponentResource): boolean {
  return component.description.trim() !== "" && component.whenToUse.length > 0 && component.whenNotToUse.length > 0;
}

function toUniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

async function readPackageName(cwd: string): Promise<string> {
  const packageJsonPath = path.join(cwd, "package.json");
  const packageJson = await readJson<PackageJson>(packageJsonPath);

  if (typeof packageJson.name !== "string" || packageJson.name.trim() === "") {
    throw new Error("package.json name is required for generation");
  }

  return packageJson.name;
}

export async function generateApsFromEvidence(
  cwd: string,
  options: GenerateOptions = {}
): Promise<GenerateReport> {
  const packageName = await readPackageName(cwd);
  const outputDir = path.join(cwd, "dist", "aps");
  const manifestPath = path.join(outputDir, "manifest.json");
  const componentsPath = path.join(outputDir, "components.json");

  const alreadyExists = (await fileExists(manifestPath)) || (await fileExists(componentsPath));
  if (alreadyExists && !options.force) {
    throw new Error(
      "APS resources already exist in dist/aps. Re-run with --force to replace existing generated resources."
    );
  }

  await ensureDir(outputDir);

  const [typescriptComponents, storybookFacts, readmeFacts] = await Promise.all([
    extractTypeScriptComponents(cwd, packageName),
    extractStorybookFacts(cwd),
    extractReadmeFacts(cwd)
  ]);

  const components = typescriptComponents.map((component) =>
    buildComponentResource(component, storybookFacts, readmeFacts)
  );

  const exampleResult = buildExamplesNotImplemented();

  const output: GenerateOutput = {
    components,
    warnings: [...exampleResult.warnings],
    missingHumanMetadata: toUniqueSorted(
      components
        .filter((component) => !hasHumanMetadata(component))
        .map((component) => component.name)
    )
  };

  const manifest = {
    version: 1,
    components
  };

  await writeJson(componentsPath, {
    components
  });
  await writeJson(manifestPath, manifest);

  const validateResult = validateApsManifest(manifest);
  const governanceResult = validateGovernance(manifest);

  return {
    outputDir,
    generatedResources: output.components.length,
    warnings: output.warnings,
    missingHumanMetadata: output.missingHumanMetadata,
    validate: {
      valid: validateResult.valid,
      errors: validateResult.errors,
      warnings: validateResult.warnings
    },
    governance: {
      valid: governanceResult.valid,
      errors: governanceResult.errors,
      warnings: governanceResult.warnings
    }
  };
}
