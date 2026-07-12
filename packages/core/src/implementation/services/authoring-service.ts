import path from "node:path";
import { parse, stringify } from "yaml";
import { extractStorybookFacts } from "../resource-discovery/storybook-extractor";
import { discoverTypeScriptResources } from "../resource-discovery/typescript-extractor";
import {
  extractTypeScriptPublicApi,
  getComponentPublicApiKey
} from "../resource-discovery/typescript-public-api-extractor";
import type {
  DiscoveredResourceFact,
  ExtractedComponentFact,
  ExtractedProp,
  PublicComponentApi,
  ResourceClassification,
  SemanticResourceKind
} from "../contracts/resource";
import { discoverDescriptorFiles } from "../descriptors/descriptor-discovery";
import { deleteFile, fileExists, readJson, readText, writeText } from "../io/fs";
import { isObject } from "../io/json";
import { createComponentResourceId } from "../resource-identity";

type PackageJson = {
  name?: unknown;
  aps?: unknown;
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
  api?: PublicComponentApi;
  classification: ResourceClassification;
  variants: string[];
  storyFiles: string[];
};

type AuthoringPackageMetadata = {
  packageName: string;
  discovery: {
    includeKinds?: SemanticResourceKind[];
    excludeKinds?: SemanticResourceKind[];
  };
};

const KNOWN_RESOURCE_KINDS: ReadonlySet<SemanticResourceKind> = new Set([
  "component",
  "hook",
  "context",
  "provider",
  "template",
  "icon",
  "page",
  "utility",
  "theme",
  "token",
  "configuration",
  "story",
  "internal",
  "unknown"
]);

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

type ExistingDescriptorResource = {
  schemaVersion: 1 | 2;
  resourcesInFile: number;
  sourceRef: string;
  filePath: string;
  resource: DescriptorResourceDocument;
  identity: string | null;
};

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

function sanitizePathSegment(value: string): string {
  const normalized = value.trim().replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized === "" ? "resource" : normalized.toLowerCase();
}

function toDescriptorPath(sourceFile: string, resourceName: string): string {
  const ext = path.extname(sourceFile);
  const base = path.basename(sourceFile, ext);
  const segment = sanitizePathSegment(resourceName);
  return path.join(path.dirname(sourceFile), `${base}.${segment}.mimir.yaml`);
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
    api:
      seed.api ??
      {
        props: [],
        events: [],
        slots: [],
        methods: [],
        refs: []
      },
    classification: seed.classification,
    variants: [...new Set(seed.variants)].sort((a, b) => a.localeCompare(b)),
    storyFiles: [...new Set(seed.storyFiles)].sort((a, b) => a.localeCompare(b))
  };
}

function patchManagedResourceAuto(existing: DescriptorResourceDocument, seed: AutoSeed): Record<string, unknown> {
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

function buildSchemaV2Document(resource: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaVersion: 2,
    ...resource
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

function serializeDescriptorDocument(doc: Record<string, unknown>): string {
  return stringify(doc, { lineWidth: 120 });
}

function readDiscoveryKinds(value: unknown): SemanticResourceKind[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const aliasToKind: Record<string, SemanticResourceKind> = {
    styled: "internal",
    private: "internal"
  };

  const resolved = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().toLowerCase())
    .map((item) => aliasToKind[item] ?? item)
    .filter((item): item is SemanticResourceKind => KNOWN_RESOURCE_KINDS.has(item as SemanticResourceKind));

  if (resolved.length === 0) {
    return undefined;
  }

  return [...new Set(resolved)];
}

async function readPackageMetadata(cwd: string): Promise<AuthoringPackageMetadata> {
  const packageJson = await readJson<PackageJson>(path.join(cwd, "package.json"));

  if (typeof packageJson.name !== "string" || packageJson.name.trim() === "") {
    throw new Error("package.json name is required for authoring");
  }

  const aps = isObject(packageJson.aps) ? packageJson.aps : {};
  const discovery = isObject(aps.discovery) ? aps.discovery : {};

  return {
    packageName: packageJson.name,
    discovery: {
      includeKinds: readDiscoveryKinds(discovery.include),
      excludeKinds: readDiscoveryKinds(discovery.exclude)
    }
  };
}

function parseDescriptorEntries(raw: unknown, sourceRef: string, filePath: string): ExistingDescriptorResource[] {
  if (!isObject(raw)) {
    throw new Error(`${sourceRef}: descriptor must be a YAML object`);
  }

  const schemaVersion = raw.schemaVersion;
  if (schemaVersion === 2) {
    const resource = raw as DescriptorResourceDocument;
    return [
      {
        schemaVersion: 2,
        resourcesInFile: 1,
        sourceRef,
        filePath,
        resource,
        identity: resourceIdentity(resource)
      }
    ];
  }

  if (schemaVersion === 1) {
    if (!Array.isArray(raw.resources)) {
      throw new Error(`${sourceRef}: resources must be an array for schemaVersion 1`);
    }

    const resources = raw.resources.filter((item): item is DescriptorResourceDocument => isObject(item));
    return resources.map((resource) => ({
      schemaVersion: 1,
      resourcesInFile: resources.length,
      sourceRef,
      filePath,
      resource,
      identity: resourceIdentity(resource)
    }));
  }

  throw new Error(`${sourceRef}: schemaVersion must be 1 or 2`);
}

async function loadExistingDescriptorEntries(cwd: string, relativePath: string): Promise<ExistingDescriptorResource[]> {
  const filePath = path.join(cwd, relativePath);
  const parsed = parse(await readText(filePath));
  return parseDescriptorEntries(parsed, relativePath, filePath);
}

function toManagedSeeds(
  resources: DiscoveredResourceFact[],
  storybookFacts: Awaited<ReturnType<typeof extractStorybookFacts>>,
  publicApis: Awaited<ReturnType<typeof extractTypeScriptPublicApi>>
): AutoSeed[] {
  const byId = new Map<string, AutoSeed>();

  for (const resource of resources) {
    const publicApi = publicApis.get(getComponentPublicApiKey(resource));
    const id = createComponentResourceId(resource.packageName, resource.name);

    byId.set(id, {
      name: resource.name,
      id,
      sourceFile: normalizeSlashes(resource.filePath),
      props: publicApi?.props ?? {},
      api: publicApi?.api,
      classification: resource.classification,
      variants: storybookFacts.variantsByComponent[resource.name] ?? [],
      storyFiles: storybookFacts.storyFilesByComponent[resource.name] ?? []
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export async function runAuthoringWorkflow(
  cwd: string,
  options: AuthoringOptions = {}
): Promise<AuthoringReport> {
  const shouldRefreshAuto = options.refreshAuto !== false;
  const shouldDeleteOrphans = options.deleteOrphans === true;

  const packageMetadata = await readPackageMetadata(cwd);
  const discoveredResources = await discoverTypeScriptResources(cwd, packageMetadata.packageName, {
    includeKinds: packageMetadata.discovery.includeKinds,
    excludeKinds: packageMetadata.discovery.excludeKinds
  });
  const resourcesForAuthoring = discoveredResources.filter((resource) => resource.classification.generateDescriptor);
  const authoringResourceFacts: ExtractedComponentFact[] = resourcesForAuthoring.map((resource) => ({
    name: resource.name,
    filePath: resource.filePath,
    importName: resource.importName,
    packageName: resource.packageName,
    props: {}
  }));

  const [storybookFacts, publicApis] = await Promise.all([
    extractStorybookFacts(cwd),
    extractTypeScriptPublicApi(cwd, authoringResourceFacts)
  ]);

  const seeds = toManagedSeeds(resourcesForAuthoring, storybookFacts, publicApis);
  const existingDescriptorFiles = await discoverDescriptorFiles(cwd);
  const existingEntries: ExistingDescriptorResource[] = [];

  for (const relativePath of existingDescriptorFiles) {
    try {
      existingEntries.push(...(await loadExistingDescriptorEntries(cwd, relativePath)));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Invalid descriptor\n\n${relativePath}\n\nYAML parse error.\n${message}\n\nFix the descriptor before running author again.`
      );
    }
  }

  const existingByIdentity = new Map<string, ExistingDescriptorResource>();
  for (const entry of existingEntries) {
    if (!entry.identity) {
      continue;
    }

    const current = existingByIdentity.get(entry.identity);
    if (!current) {
      existingByIdentity.set(entry.identity, entry);
      continue;
    }

    if (current.schemaVersion === 1 && entry.schemaVersion === 2) {
      existingByIdentity.set(entry.identity, entry);
    }
  }

  const createdFiles: string[] = [];
  const updatedFiles: string[] = [];
  const existingFiles: string[] = [];
  const plannedFiles: string[] = [];
  const orphanedResources: string[] = [];
  const deletedOrphans: string[] = [];
  const warnings: string[] = [];
  const pendingHumanResources: string[] = [];
  const consumedIdentities = new Set<string>();

  if (options.interactive) {
    warnings.push("--interactive is not implemented yet. Running sync-only mode.");
  }
  if (options.ai) {
    warnings.push("--ai is not implemented yet. Running sync-only mode.");
  }

  for (const seed of seeds) {
    const legacyIdentity = `component:${seed.name}`;
    const existingEntry = existingByIdentity.get(seed.id) ?? existingByIdentity.get(legacyIdentity);

    if (
      existingEntry &&
      existingEntry.schemaVersion === 1 &&
      existingEntry.resourcesInFile > 1 &&
      shouldRefreshAuto
    ) {
      warnings.push(
        `${existingEntry.sourceRef}: schemaVersion 1 descriptor contains multiple resources and cannot be auto-updated to v2 in-place. Keep using it as-is or split manually.`
      );
      consumedIdentities.add(seed.id);
      consumedIdentities.add(legacyIdentity);
      existingFiles.push(existingEntry.sourceRef);
      pendingHumanResources.push(`${existingEntry.sourceRef}#${seed.id}`);
      continue;
    }

    const descriptorRelativePath = existingEntry
      ? existingEntry.sourceRef
      : normalizeSlashes(toDescriptorPath(seed.sourceFile, seed.name));
    const descriptorPath = path.join(cwd, descriptorRelativePath);

    const baseResource = existingEntry?.resource ?? createManagedResource(seed);
    const nextResource = shouldRefreshAuto
      ? patchManagedResourceAuto(baseResource, seed)
      : baseResource;

    const nextDoc = buildSchemaV2Document(nextResource);
    const after = serializeDescriptorDocument(nextDoc).trim();
    const existed = await fileExists(descriptorPath);

    if (!existed) {
      if (options.dryRun) {
        plannedFiles.push(descriptorRelativePath);
      } else {
        await writeText(descriptorPath, `${after}\n`);
        createdFiles.push(descriptorRelativePath);
      }
    } else {
      let beforeDoc: Record<string, unknown>;
      try {
        const parsed = parse(await readText(descriptorPath));
        if (!isObject(parsed)) {
          throw new Error(`${descriptorRelativePath}: descriptor must be a YAML object`);
        }
        beforeDoc = parsed;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Invalid descriptor\n\n${descriptorRelativePath}\n\nYAML parse error.\n${message}\n\nFix the descriptor before running author again.`
        );
      }

      const before = serializeDescriptorDocument(beforeDoc).trim();
      if (before === after) {
        existingFiles.push(descriptorRelativePath);
      } else if (options.dryRun) {
        plannedFiles.push(descriptorRelativePath);
      } else {
        await writeText(descriptorPath, `${after}\n`);
        updatedFiles.push(descriptorRelativePath);
      }
    }

    consumedIdentities.add(seed.id);
    consumedIdentities.add(legacyIdentity);
    pendingHumanResources.push(`${descriptorRelativePath}#${seed.id}`);
  }

  for (const entry of existingEntries) {
    const identity = entry.identity;
    if (!identity || consumedIdentities.has(identity) || !isComponentResource(entry.resource)) {
      continue;
    }

    const id = typeof entry.resource.id === "string" ? entry.resource.id : identity;
    orphanedResources.push(`${entry.sourceRef}#${id}`);

    if (!shouldDeleteOrphans) {
      continue;
    }

    if (entry.schemaVersion === 1 && entry.resourcesInFile > 1) {
      warnings.push(`${entry.sourceRef}: cannot delete orphan from schemaVersion 1 multi-resource descriptor automatically.`);
      continue;
    }

    if (options.dryRun) {
      plannedFiles.push(entry.sourceRef);
      deletedOrphans.push(`${entry.sourceRef}#${id}`);
      continue;
    }

    await deleteFile(entry.filePath);
    deletedOrphans.push(`${entry.sourceRef}#${id}`);
  }

  return {
    outputDir: ".",
    discoveredResources: resourcesForAuthoring.length,
    createdFiles: [...new Set(createdFiles)].sort((a, b) => a.localeCompare(b)),
    updatedFiles: [...new Set(updatedFiles)].sort((a, b) => a.localeCompare(b)),
    existingFiles: [...new Set(existingFiles)].sort((a, b) => a.localeCompare(b)),
    plannedFiles: [...new Set(plannedFiles)].sort((a, b) => a.localeCompare(b)),
    orphanedResources: [...new Set(orphanedResources)].sort((a, b) => a.localeCompare(b)),
    deletedOrphans: [...new Set(deletedOrphans)].sort((a, b) => a.localeCompare(b)),
    pendingHumanResources: [...new Set(pendingHumanResources)].sort((a, b) => a.localeCompare(b)),
    warnings: [...new Set(warnings)],
    dryRun: Boolean(options.dryRun)
  };
}
