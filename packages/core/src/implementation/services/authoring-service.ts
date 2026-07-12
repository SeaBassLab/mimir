import path from "node:path";
import { extractTypeScriptComponents } from "../generation/extractors/typescript-extractor";
import { fileExists, readJson, writeTextIfMissing } from "../io/fs";
import { createComponentResourceId } from "../resource-identity";

type PackageJson = {
  name?: unknown;
};

type AuthoringOptions = {
  dryRun?: boolean;
};

export type AuthoringReport = {
  outputDir: string;
  discoveredResources: number;
  createdFiles: string[];
  existingFiles: string[];
  plannedFiles: string[];
  dryRun: boolean;
};

const AUTHORING_TEMPLATE = `description: ""
# Describe brevemente qué hace este recurso.

whenToUse: []
# ¿Cuándo recomendarías utilizar este recurso?

whenNotToUse: []
# ¿En qué casos elegirías otra alternativa?
`;

async function readPackageName(cwd: string): Promise<string> {
  const packageJson = await readJson<PackageJson>(path.join(cwd, "package.json"));

  if (typeof packageJson.name !== "string" || packageJson.name.trim() === "") {
    throw new Error("package.json name is required for authoring");
  }

  return packageJson.name;
}

export async function runAuthoringWorkflow(
  cwd: string,
  options: AuthoringOptions = {}
): Promise<AuthoringReport> {
  const packageName = await readPackageName(cwd);
  const components = await extractTypeScriptComponents(cwd, packageName);
  const outputDir = path.join(cwd, "aps", "knowledge", "components");
  const createdFiles: string[] = [];
  const existingFiles: string[] = [];
  const plannedFiles: string[] = [];

  for (const component of components) {
    const resourceId = createComponentResourceId(component.packageName, component.name);
    const filePath = path.join(outputDir, `${resourceId}.yaml`);
    const relativePath = path.relative(cwd, filePath);

    if (await fileExists(filePath)) {
      existingFiles.push(relativePath);
      continue;
    }

    if (options.dryRun) {
      plannedFiles.push(relativePath);
      continue;
    }

    if (await writeTextIfMissing(filePath, AUTHORING_TEMPLATE)) {
      createdFiles.push(relativePath);
    } else {
      existingFiles.push(relativePath);
    }
  }

  return {
    outputDir: path.relative(cwd, outputDir),
    discoveredResources: components.length,
    createdFiles,
    existingFiles,
    plannedFiles,
    dryRun: Boolean(options.dryRun)
  };
}
