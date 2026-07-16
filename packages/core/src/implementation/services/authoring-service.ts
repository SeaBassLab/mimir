import path from "node:path";
import { parse, stringify } from "yaml";
import { buildKnowledgeGraph, createKnowledgeWorkspace } from "../knowledge/knowledge-engine";
import { DescriptorPersistencePolicy, type PersistentResourceKnowledge } from "../knowledge/persistence-policy";
import type {
  ExtractedProp,
  PublicComponentApi,
  ResourceClassification,
  SemanticResourceKind,
  ExtractedRelationship,
  ExtractedExample,
  ExtractedReactPatterns,
  ExtractionMetadata
} from "../contracts/resource";
import { discoverDescriptorFiles } from "../descriptors/descriptor-discovery";
import { deleteFile, fileExists, readJson, readText, writeText } from "../io/fs";
import { isObject } from "../io/json";
import { createResourceId } from "../resource-identity";

type PackageJson = {
  name?: unknown;
  aps?: unknown;
};

type AuthoringOptions = {
  dryRun?: boolean;
  refreshAuto?: boolean;
  deleteOrphans?: boolean;
  componentName?: string;
  resourceSelector?: string;
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
  importName: string;
  kind: SemanticResourceKind;
  id: string;
  sourceFile: string;
  props: Record<string, ExtractedProp>;
  api?: PublicComponentApi;
  classification: ResourceClassification;
  variants: string[];
  storyFiles: string[];
  relationships: ExtractedRelationship[];
  examples: ExtractedExample[];
  react: ExtractedReactPatterns;
  metadata: ExtractionMetadata;
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

function normalizeSelector(value: string): string {
  return normalizeSlashes(value).trim().toLowerCase();
}

function trimFileExtension(value: string): string {
  const extension = path.extname(value);
  if (extension === "") {
    return value;
  }

  return value.slice(0, -extension.length);
}

function sanitizePathSegment(value: string): string {
  const normalized = value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[^A-Za-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return normalized === "" ? "resource" : normalized.toLowerCase();
}

function toDescriptorPath(sourceFile: string, resourceName: string): string {
  const ext = path.extname(sourceFile);
  const base = path.basename(sourceFile, ext);
  const segment = sanitizePathSegment(resourceName);
  if (sanitizePathSegment(base) === segment) {
    return path.join(path.dirname(sourceFile), `${base}.mimir.yaml`);
  }
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

function buildPersistedAutoBlock(seed: AutoSeed): Record<string, unknown> {
  return {
    source: {
      file: seed.sourceFile,
      symbol: seed.importName,
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
    storyFiles: [...new Set(seed.storyFiles)].sort((a, b) => a.localeCompare(b)),
    relationships: seed.relationships,
    examples: seed.examples,
    react: seed.react,
    ai: seed.metadata
  };
}

function patchManagedResourceAuto(existing: DescriptorResourceDocument, seed: AutoSeed): Record<string, unknown> {
  return {
    ...existing,
    auto: buildPersistedAutoBlock(seed)
  };
}

function createManagedResource(seed: AutoSeed): Record<string, unknown> {
  return {
    kind: seed.kind,
    name: seed.name,
    id: seed.id,
    auto: buildPersistedAutoBlock(seed),
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
  knowledge: PersistentResourceKnowledge[]
): AutoSeed[] {
  const byId = new Map<string, AutoSeed>();

  for (const item of knowledge) {
    const resource = item.resource;
    const id = createResourceId(resource.packageName, resource.classification.kind, resource.name);

    byId.set(id, {
      name: resource.name,
      importName: resource.importName,
      kind: resource.classification.kind,
      id,
      sourceFile: normalizeSlashes(resource.filePath),
      props: item.props,
      api: item.api,
      classification: resource.classification,
      variants: item.variants,
      storyFiles: item.storyFiles,
      relationships: item.relationships,
      examples: item.examples,
      react: item.react,
      metadata: item.metadata
    });
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function matchesComponentName(seed: AutoSeed, componentName: string): boolean {
  const expected = normalizeSelector(componentName);
  if (expected === "") {
    return true;
  }

  return normalizeSelector(seed.name) === expected || normalizeSelector(seed.importName) === expected;
}

function matchesResourceSelector(seed: AutoSeed, selector: string): boolean {
  const expected = normalizeSelector(selector);
  if (expected === "") {
    return true;
  }

  const seedName = normalizeSelector(seed.name);
  const seedImportName = normalizeSelector(seed.importName);
  const sourceFile = normalizeSelector(seed.sourceFile);
  const sourceFileName = normalizeSelector(path.basename(sourceFile));
  const sourceBaseName = normalizeSelector(trimFileExtension(path.basename(sourceFile)));
  const expectedFileName = normalizeSelector(path.basename(expected));
  const expectedBaseName = normalizeSelector(trimFileExtension(path.basename(expected)));

  if (seedName === expected || seedImportName === expected) {
    return true;
  }

  if (sourceFile === expected || sourceFileName === expectedFileName || sourceBaseName === expectedBaseName) {
    return true;
  }

  return sourceFile.endsWith(`/${expected}`) || sourceFile.includes(`/${expected}/`) || sourceFile.includes(expected);
}

export async function runAuthoringWorkflow(
  cwd: string,
  options: AuthoringOptions = {}
): Promise<AuthoringReport> {
  const shouldRefreshAuto = options.refreshAuto !== false;
  const isIncremental = Boolean(options.componentName || options.resourceSelector);
  const shouldDeleteOrphans = options.deleteOrphans === true && !isIncremental;

  const packageMetadata = await readPackageMetadata(cwd);
  const workspace = await createKnowledgeWorkspace(cwd, packageMetadata.packageName, {
    includeKinds: packageMetadata.discovery.includeKinds,
    excludeKinds: packageMetadata.discovery.excludeKinds
  });
  const graph = await buildKnowledgeGraph(workspace);
  const discoveredSeeds = toManagedSeeds(new DescriptorPersistencePolicy().select(graph));
  const seeds = discoveredSeeds.filter((seed) => {
    if (options.componentName && !matchesComponentName(seed, options.componentName)) {
      return false;
    }

    if (options.resourceSelector && !matchesResourceSelector(seed, options.resourceSelector)) {
      return false;
    }

    return true;
  });
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
  if (isIncremental && options.deleteOrphans === true) {
    warnings.push("--delete-orphans is ignored in incremental mode to avoid deleting unrelated descriptors.");
  }
  if (isIncremental && seeds.length === 0) {
    const criteria = options.componentName
      ? `component '${options.componentName}'`
      : `selector '${options.resourceSelector}'`;
    throw new Error(`No discovered resources matched ${criteria}.`);
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

  if (!isIncremental) {
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
  }

  return {
    outputDir: ".",
    discoveredResources: seeds.length,
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
