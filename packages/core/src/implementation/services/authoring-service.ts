import path from "node:path";
import { parse, stringify } from "yaml";
import { extractStorybookFacts } from "../resource-discovery/storybook-extractor";
import { extractTypeScriptComponents } from "../resource-discovery/typescript-extractor";
import type { ExtractedProp } from "../contracts/resource";
import { discoverDescriptorFiles } from "../descriptors/descriptor-discovery";
import { fileExists, readJson, readText, writeText } from "../io/fs";
import { isObject } from "../io/json";
import { createComponentResourceId } from "../resource-identity";

type PackageJson = {
  name?: unknown;
};

type AuthoringOptions = {
  dryRun?: boolean;
  refreshAuto?: boolean;
  deleteOrphans?: boolean;
  interactive?: boolean;
  ai?: boolean;
};

export type AuthoringReport = {
  outputDir: string;
  discoveredResources: number;
  createdFiles: string[];
  updatedFiles: string[];
  existingFiles: string[];
  plannedFiles: string[];
  orphanedResources: string[];
  deletedOrphans: string[];
  pendingHumanResources: string[];
  warnings: string[];
  dryRun: boolean;
};

type AutoSeed = {
  name: string;
  id: string;
  sourceFile: string;
  props: Record<string, ExtractedProp>;
  variants: string[];
  storyFiles: string[];
};

type DescriptorResourceDocument = {
  kind?: unknown;
  name?: unknown;
  id?: unknown;
  auto?: unknown;
  human?: unknown;
  source?: unknown;
  props?: unknown;
  variants?: unknown;
  storyFiles?: unknown;
  description?: unknown;
  whenToUse?: unknown;
  whenNotToUse?: unknown;
  [key: string]: unknown;
};

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

function toDescriptorPath(filePath: string): string {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  return path.join(path.dirname(filePath), `${base}.mimir.yaml`);
}

function toPropsArray(props: Record<string, ExtractedProp>): Array<{ name: string; type: string; required: boolean }> {
  return Object.values(props)
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((prop) => ({
      name: prop.name,
      type: prop.type ?? "unknown",
      required: prop.required !== false
    }));
}

function buildManagedAutoBlock(seed: AutoSeed): Record<string, unknown> {
  return {
    source: {
      file: seed.sourceFile,
      symbol: seed.name,
      public: true
    },
    props: toPropsArray(seed.props),
    variants: [...new Set(seed.variants)].sort((a, b) => a.localeCompare(b)),
    storyFiles: [...new Set(seed.storyFiles)].sort((a, b) => a.localeCompare(b))
  };
}

function patchManagedResourceAuto(existing: DescriptorResourceDocument, seed: AutoSeed): Record<string, unknown> {
  // Hard boundary: preserve every field as-is and update only descriptor.auto.
  return {
    ...existing,
    auto: buildManagedAutoBlock(seed)
  };
}

function createManagedResource(seed: AutoSeed): Record<string, unknown> {
  return {
    kind: "component",
    name: seed.name,
    id: seed.id,
    auto: buildManagedAutoBlock(seed),
    human: {
      description: "",
      whenToUse: [],
      whenNotToUse: []
    }
  };
}

function resourceIdentity(resource: DescriptorResourceDocument): string | null {
  const id = typeof resource.id === "string" ? resource.id : null;
  if (id && id.trim() !== "") {
    return id;
  }

  const kind = typeof resource.kind === "string" ? resource.kind.trim().toLowerCase() : "";
  const name = typeof resource.name === "string" ? resource.name.trim() : "";
  if (kind && name) {
    return `${kind}:${name}`;
  }

  return null;
}

function isComponentResource(resource: DescriptorResourceDocument): boolean {
  return typeof resource.kind === "string" && resource.kind.trim().toLowerCase() === "component";
}

function toManagedSeeds(
  components: Awaited<ReturnType<typeof extractTypeScriptComponents>>,
  storybookFacts: Awaited<ReturnType<typeof extractStorybookFacts>>
): Map<string, AutoSeed[]> {
  const grouped = new Map<string, AutoSeed[]>();

  for (const component of components) {
    const resourceId = createComponentResourceId(component.packageName, component.name);
    const descriptorRelativePath = normalizeSlashes(toDescriptorPath(component.filePath));

    const seeds = grouped.get(descriptorRelativePath) ?? [];
    seeds.push({
      name: component.name,
      id: resourceId,
      sourceFile: normalizeSlashes(component.filePath),
      props: component.props,
      variants: storybookFacts.variantsByComponent[component.name] ?? [],
      storyFiles: storybookFacts.storyFilesByComponent[component.name] ?? []
    });
    grouped.set(descriptorRelativePath, seeds);
  }

  return grouped;
}

function serializeDescriptorDocument(doc: Record<string, unknown>): string {
  return stringify(doc, { lineWidth: 120 });
}

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
  const shouldRefreshAuto = options.refreshAuto !== false;
  const shouldDeleteOrphans = options.deleteOrphans === true;

  const packageName = await readPackageName(cwd);
  const [components, storybookFacts] = await Promise.all([
    extractTypeScriptComponents(cwd, packageName),
    extractStorybookFacts(cwd)
  ]);
  const outputDir = cwd;
  const createdFiles: string[] = [];
  const updatedFiles: string[] = [];
  const existingFiles: string[] = [];
  const plannedFiles: string[] = [];
  const orphanedResources: string[] = [];
  const deletedOrphans: string[] = [];
  const warnings: string[] = [];

  if (options.interactive) {
    warnings.push("--interactive is not implemented yet. Running sync-only mode.");
  }
  if (options.ai) {
    warnings.push("--ai is not implemented yet. Running sync-only mode.");
  }

  const groupedDescriptors = toManagedSeeds(components, storybookFacts);
  const existingDescriptorFiles = await discoverDescriptorFiles(cwd);
  const expectedDescriptorPaths = new Set(groupedDescriptors.keys());
  const allDescriptorPaths = new Set<string>([
    ...existingDescriptorFiles,
    ...expectedDescriptorPaths
  ]);

  for (const relativePath of [...allDescriptorPaths].sort((a, b) => a.localeCompare(b))) {
    const filePath = path.join(cwd, relativePath);
    const uniqueSeeds = new Map<string, AutoSeed>(
      (groupedDescriptors.get(relativePath) ?? []).map((item): [string, AutoSeed] => [item.id, item])
    );
    const seeds = [...uniqueSeeds.values()].sort(
      (a, b) => a.name.localeCompare(b.name)
    );
    const seedByIdentityEntries: Array<[string, AutoSeed]> = [
      ...seeds.map((seed): [string, AutoSeed] => [seed.id, seed]),
      ...seeds.map((seed): [string, AutoSeed] => [`component:${seed.name}`, seed])
    ];
    const seedByIdentity = new Map<string, AutoSeed>(seedByIdentityEntries);

    let existingDoc: Record<string, unknown> = {
      schemaVersion: 1,
      resources: []
    };

    const fileAlreadyExists = await fileExists(filePath);
    if (fileAlreadyExists) {
      try {
        const parsed = parse(await readText(filePath));
        if (isObject(parsed)) {
          existingDoc = {
            ...parsed
          };
        } else {
          throw new Error(`${relativePath}: descriptor must be a YAML object`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Invalid descriptor\n\n${relativePath}\n\nYAML parse error.\n${message}\n\nFix the descriptor before running author again.`
        );
      }
    }

    const existingResourcesRaw = Array.isArray(existingDoc.resources) ? existingDoc.resources : [];
    const existingResources: DescriptorResourceDocument[] = existingResourcesRaw.filter((item): item is DescriptorResourceDocument =>
      isObject(item)
    );
    const nextResources: Record<string, unknown>[] = [];
    const consumedIdentities = new Set<string>();

    for (const existingResource of existingResources) {
      const identity = resourceIdentity(existingResource);
      if (!identity) {
        nextResources.push(existingResource);
        continue;
      }

      const seed = seedByIdentity.get(identity);
      if (seed) {
        const updated = shouldRefreshAuto ? patchManagedResourceAuto(existingResource, seed) : existingResource;
        nextResources.push(updated);
        consumedIdentities.add(identity);
        if (identity === `component:${seed.name}`) {
          consumedIdentities.add(seed.id);
        }
        continue;
      }

      if (isComponentResource(existingResource) && typeof existingResource.id === "string") {
        orphanedResources.push(`${relativePath}#${existingResource.id}`);
        if (shouldDeleteOrphans) {
          deletedOrphans.push(`${relativePath}#${existingResource.id}`);
          continue;
        }
      }

      nextResources.push(existingResource);
    }

    for (const seed of seeds) {
      if (consumedIdentities.has(seed.id) || consumedIdentities.has(`component:${seed.name}`)) {
        continue;
      }
      nextResources.push(createManagedResource(seed));
    }

    if (!fileAlreadyExists) {
      if (options.dryRun) {
        plannedFiles.push(relativePath);
      } else {
        const doc = {
          schemaVersion: 1,
          resources: nextResources
        };
        await writeText(filePath, serializeDescriptorDocument(doc));
        createdFiles.push(relativePath);
      }
      continue;
    }

    const nextDoc = {
      ...existingDoc,
      resources: nextResources
    };

    const before = serializeDescriptorDocument(existingDoc).trim();
    const after = serializeDescriptorDocument(nextDoc).trim();

    if (before === after) {
      existingFiles.push(relativePath);
      continue;
    }

    if (options.dryRun) {
      plannedFiles.push(relativePath);
    } else {
      await writeText(filePath, `${after}\n`);
      updatedFiles.push(relativePath);
    }
  }

  const pendingHumanResources = [...allDescriptorPaths]
    .sort((a, b) => a.localeCompare(b))
    .flatMap((relativePath) => {
      const seeds = groupedDescriptors.get(relativePath) ?? [];
      return seeds.map((seed) => `${relativePath}#${seed.id}`);
    });

  return {
    outputDir: ".",
    discoveredResources: components.length,
    createdFiles,
    updatedFiles,
    existingFiles,
    plannedFiles,
    orphanedResources,
    deletedOrphans,
    pendingHumanResources,
    warnings,
    dryRun: Boolean(options.dryRun)
  };
}
