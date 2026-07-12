import path from "node:path";
import { ensureDir, fileExists, readJson, writeJson } from "../io/fs";
import { validateApsManifest } from "../../protocol/compatibility";
import { validateGovernance } from "../../protocol/governance";
import { buildExamplesNotImplemented } from "./resource-builders/example-builder";
import type {
  GenerateOutput,
  GenerateReport,
  GeneratedComponentResource,
  GeneratedKnowledgeResource
} from "./types";
import { loadMimirDescriptors } from "../descriptors/descriptor-repository";
import type { MimirResourceDescriptor } from "../contracts/descriptor";
import { createComponentResourceId, createResourceId } from "../resource-identity";
import type { ApsResourceType } from "../../protocol/manifest";
import {
  fromHumanKnowledge,
  fromPackageJson,
  fromStorybook,
  fromTypeScript,
  missingHumanSource
} from "./provenance/provenance-builder";

type PackageJson = {
  name?: unknown;
};

type GenerateOptions = {
  force?: boolean;
};

export class NoDescriptorsFoundError extends Error {
  readonly code = "NO_DESCRIPTORS_FOUND";

  constructor() {
    super("No descriptors found");
    this.name = "NoDescriptorsFoundError";
  }
}

function hasHumanMetadata(
  resource: Pick<GeneratedComponentResource | GeneratedKnowledgeResource, "description" | "whenToUse" | "whenNotToUse">
): boolean {
  return resource.description.trim() !== "" && resource.whenToUse.length > 0 && resource.whenNotToUse.length > 0;
}

function toUniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function buildComponentFromDescriptor(
  packageName: string,
  descriptor: MimirResourceDescriptor
): GeneratedComponentResource {
  const sourceFile = descriptor.auto.source.file ?? descriptor.sourceRef;
  const storyFiles = descriptor.auto.storyFiles;
  const variants = descriptor.auto.variants;
  const authoredDescription = descriptor.human.description.trim();
  const evidenceByField = {
    id: { evidence: [fromPackageJson()] },
    name: { evidence: [fromTypeScript(sourceFile)] },
    package: { evidence: [fromPackageJson()] },
    import: { evidence: [fromTypeScript(sourceFile)] },
    description: {
      evidence: authoredDescription !== "" ? [fromHumanKnowledge(descriptor.sourceRef)] : [missingHumanSource("description")]
    },
    props: { evidence: [fromTypeScript(sourceFile)] },
    variants: {
      evidence:
        variants.length > 0
          ? storyFiles.length > 0
            ? storyFiles.map((file) => fromStorybook(file))
            : [fromTypeScript(sourceFile)]
          : [fromTypeScript(sourceFile)]
    },
    whenToUse: {
      evidence:
        descriptor.human.whenToUse.length > 0
          ? [fromHumanKnowledge(descriptor.sourceRef)]
          : [missingHumanSource("whenToUse")]
    },
    whenNotToUse: {
      evidence:
        descriptor.human.whenNotToUse.length > 0
          ? [fromHumanKnowledge(descriptor.sourceRef)]
          : [missingHumanSource("whenNotToUse")]
    }
  };

  return {
    type: "component",
    id: descriptor.id ?? createComponentResourceId(packageName, descriptor.name),
    name: descriptor.name,
    package: packageName,
    import: descriptor.auto.source.symbol ?? descriptor.name,
    description: authoredDescription,
    props: descriptor.auto.props,
    variants,
    whenToUse: descriptor.human.whenToUse,
    whenNotToUse: descriptor.human.whenNotToUse,
    governance: {
      fields: evidenceByField
    }
  };
}

function buildKnowledgeResourceFromDescriptor(
  packageName: string,
  descriptor: MimirResourceDescriptor
): GeneratedKnowledgeResource {
  const sourceFile = descriptor.auto.source.file ?? descriptor.sourceRef;
  const authoredDescription = descriptor.human.description.trim();
  const evidenceByField = {
    id: { evidence: [fromPackageJson()] },
    name: { evidence: [fromTypeScript(sourceFile)] },
    package: { evidence: [fromPackageJson()] },
    import: { evidence: [fromTypeScript(sourceFile)] },
    description: {
      evidence: authoredDescription !== "" ? [fromHumanKnowledge(descriptor.sourceRef)] : [missingHumanSource("description")]
    },
    whenToUse: {
      evidence: descriptor.human.whenToUse.length > 0
        ? [fromHumanKnowledge(descriptor.sourceRef)]
        : [missingHumanSource("whenToUse")]
    },
    whenNotToUse: {
      evidence: descriptor.human.whenNotToUse.length > 0
        ? [fromHumanKnowledge(descriptor.sourceRef)]
        : [missingHumanSource("whenNotToUse")]
    }
  };

  return {
    type: descriptor.kind as ApsResourceType,
    id: descriptor.id ?? createResourceId(packageName, descriptor.kind, descriptor.name),
    name: descriptor.name,
    package: packageName,
    import: descriptor.auto.source.symbol ?? descriptor.name,
    description: authoredDescription,
    whenToUse: descriptor.human.whenToUse,
    whenNotToUse: descriptor.human.whenNotToUse,
    relatedResources: (descriptor.auto.relationships ?? []).map((relationship) => ({
      id: relationship.target,
      relationship: relationship.type
    })),
    metadata: {
      api: descriptor.auto.api,
      examples: descriptor.auto.examples,
      react: descriptor.auto.react
    },
    governance: { fields: evidenceByField }
  };
}

async function readPackageName(cwd: string): Promise<string> {
  const packageJsonPath = path.join(cwd, "package.json");
  const packageJson = await readJson<PackageJson>(packageJsonPath);

  if (typeof packageJson.name !== "string" || packageJson.name.trim() === "") {
    throw new Error("package.json name is required for generation");
  }

  return packageJson.name;
}

export async function compileApsFromDescriptors(
  cwd: string,
  options: GenerateOptions = {}
): Promise<GenerateReport> {
  const packageName = await readPackageName(cwd);
  const descriptorResult = await loadMimirDescriptors(cwd);
  if (descriptorResult.descriptorFiles.length === 0) {
    throw new NoDescriptorsFoundError();
  }

  const outputDir = path.join(cwd, "dist", "aps");
  const manifestPath = path.join(outputDir, "manifest.json");
  const componentsPath = path.join(outputDir, "components.json");
  const resourcesPath = path.join(outputDir, "resources.json");

  const alreadyExists =
    (await fileExists(manifestPath)) ||
    (await fileExists(componentsPath)) ||
    (await fileExists(resourcesPath));
  if (alreadyExists && !options.force) {
    throw new Error(
      "APS resources already exist in dist/aps. Re-run with --force to replace existing generated resources."
    );
  }

  await ensureDir(outputDir);
  const componentDescriptors = descriptorResult.resources.filter(
    (resource): resource is MimirResourceDescriptor => resource.kind === "component"
  );

  const components = await Promise.all(
    componentDescriptors.map(async (descriptor) => buildComponentFromDescriptor(packageName, descriptor))
  );
  const resources = descriptorResult.resources
    .filter((resource) => resource.kind !== "component")
    .map((descriptor) => buildKnowledgeResourceFromDescriptor(packageName, descriptor));

  const exampleResult = buildExamplesNotImplemented();
  const descriptorWarnings = [...descriptorResult.warnings];

  const output: GenerateOutput = {
    components,
    resources,
    warnings: [...exampleResult.warnings, ...descriptorWarnings],
    missingHumanMetadata: toUniqueSorted(
      [...components, ...resources]
        .filter((resource) => !hasHumanMetadata(resource))
        .map((resource) => resource.name)
    )
  };

  const manifest = {
    version: 1,
    components,
    resources
  };

  await writeJson(componentsPath, {
    components
  });
  await writeJson(resourcesPath, {
    resources
  });
  await writeJson(manifestPath, manifest);

  const validateResult = validateApsManifest(manifest);
  const governanceResult = validateGovernance(manifest);

  return {
    outputDir,
    descriptorsCompiled: descriptorResult.descriptorFiles.length,
    generatedResources: output.components.length + output.resources.length,
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

export async function generateApsFromEvidence(
  cwd: string,
  options: GenerateOptions = {}
): Promise<GenerateReport> {
  return compileApsFromDescriptors(cwd, options);
}
