import type { DiscoveryResult } from "../dependency-discovery/discover-providers";
import type { DiscoveredProvider } from "../configuration/manifest-loader";
import { isObject } from "../io/json";

export type AgentApiProp = {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
};

export type AgentCallSignature = {
  display: string;
  requiredParameters: number;
};

export type AgentKnowledgeResource = {
  provider: string;
  kind: string;
  id?: string;
  name: string;
  packageName?: string;
  importName?: string;
  description?: string;
  whenToUse: string[];
  whenNotToUse: string[];
  props: AgentApiProp[];
  variants: string[];
  members: Array<{ path: string; type?: string; description?: string }>;
  callSignatures: AgentCallSignature[];
  patterns: string[];
  relationships: string[];
  examples: string[];
};

export type AgentKnowledgeView = {
  discovery: DiscoveryResult;
  resources: AgentKnowledgeResource[];
  rules: string[];
  examples: string[];
};

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function names(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isObject(item)) return null;
      const candidate = item.name ?? item.id;
      return typeof candidate === "string" ? candidate : null;
    })
    .filter((item): item is string => item !== null);
}

function readImport(
  item: Record<string, unknown>,
  provider: DiscoveredProvider,
  resourceName: string
): { packageName?: string; importName?: string } {
  const packageName = typeof item.package === "string" ? item.package : provider.name;
  const importValue = typeof item.import === "string" ? item.import : undefined;
  const importLocation = typeof item.importLocation === "string" ? item.importLocation : undefined;
  const importLooksLikeModule = Boolean(
    importValue && (importValue === packageName || importValue.startsWith("@") || importValue.startsWith(".") || importValue.includes("/"))
  );
  return {
    packageName: importLocation ?? (importLooksLikeModule ? importValue : packageName),
    importName: importLooksLikeModule ? resourceName : importValue
  };
}

function typeDisplay(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (!isObject(value)) return undefined;
  if (typeof value.display === "string") return value.display;
  if (typeof value.name === "string") return value.name;
  if ("value" in value && ["string", "number", "boolean"].includes(typeof value.value)) {
    return JSON.stringify(value.value);
  }
  return undefined;
}

function readProps(value: unknown): AgentApiProp[] {
  const candidates = Array.isArray(value)
    ? value
    : isObject(value)
      ? Object.values(value)
      : [];
  return candidates
    .map((item): AgentApiProp | null => {
      if (!isObject(item) || typeof item.name !== "string") return null;
      return {
        name: item.name,
        type: typeDisplay(item.type),
        required: typeof item.required === "boolean" ? item.required : undefined,
        description: typeof item.description === "string" ? item.description : undefined
      };
    })
    .filter((item): item is AgentApiProp => item !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function readMembers(value: unknown): AgentKnowledgeResource["members"] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isObject(item) || typeof item.path !== "string") return null;
      return {
        path: item.path,
        type: typeDisplay(item.type),
        description: typeof item.description === "string" ? item.description : undefined
      };
    })
    .filter((item): item is { path: string; type: string | undefined; description: string | undefined } => item !== null)
    .sort((a, b) => a.path.localeCompare(b.path));
}

function readCallSignatures(value: unknown): AgentCallSignature[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item): AgentCallSignature | null => {
      if (!isObject(item) || typeof item.display !== "string") return null;
      const parameters = Array.isArray(item.parameters) ? item.parameters : [];
      return {
        display: item.display,
        requiredParameters: parameters.filter((parameter) => isObject(parameter) && parameter.required === true).length
      };
    })
    .filter((item): item is AgentCallSignature => item !== null);
}

function readRelationships(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isObject(item)) return null;
      const target = item.name ?? item.id ?? item.target;
      if (typeof target !== "string") return null;
      const relationship = item.relationship ?? item.type;
      return typeof relationship === "string" ? `${relationship}: ${target}` : target;
    })
    .filter((item): item is string => item !== null);
}

function readExamples(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isObject(item)) return null;
      const name = item.story ?? item.name ?? item.title ?? item.id;
      const source = isObject(item.source) ? item.source.file : undefined;
      if (typeof name !== "string") return null;
      return typeof source === "string" ? `${name} (${source})` : name;
    })
    .filter((item): item is string => item !== null);
}

function namedEntries(manifest: Record<string, unknown> | null, key: string): string[] {
  const section = manifest?.[key];
  if (!Array.isArray(section)) return [];
  return section
    .map((item) => {
      if (typeof item === "string") return item;
      if (!isObject(item)) return null;
      const candidate = item.name ?? item.id ?? item.title ?? item.path;
      return typeof candidate === "string" ? candidate : null;
    })
    .filter((item): item is string => item !== null);
}

function componentResources(provider: DiscoveredProvider): AgentKnowledgeResource[] {
  const section = provider.manifest?.components;
  if (!Array.isArray(section)) return [];
  return section.flatMap((item): AgentKnowledgeResource[] => {
    if (typeof item === "string") {
      return [{
        provider: provider.name,
        kind: "component",
        name: item,
        whenToUse: [],
        whenNotToUse: [],
        props: [],
        variants: [],
        members: [],
        callSignatures: [],
        patterns: [],
        relationships: [],
        examples: []
      }];
    }
    if (!isObject(item)) return [];
    const name = item.name ?? item.id;
    if (typeof name !== "string" || name.trim() === "") return [];
    const publicImport = readImport(item, provider, name);
    return [{
      provider: provider.name,
      kind: "component",
      id: typeof item.id === "string" ? item.id : undefined,
      name,
      packageName: publicImport.packageName,
      importName: publicImport.importName,
      description: typeof item.description === "string" ? item.description : undefined,
      whenToUse: strings(item.whenToUse),
      whenNotToUse: strings(item.whenNotToUse),
      props: readProps(item.props),
      variants: names(item.variants),
      members: [],
      callSignatures: [],
      patterns: [],
      relationships: readRelationships(item.relatedResources),
      examples: readExamples(item.examples)
    }];
  });
}

function knowledgeResources(provider: DiscoveredProvider): AgentKnowledgeResource[] {
  const section = provider.manifest?.resources;
  if (!Array.isArray(section)) return [];
  return section.flatMap((item): AgentKnowledgeResource[] => {
    if (!isObject(item) || typeof item.type !== "string") return [];
    const name = item.name ?? item.id;
    if (typeof name !== "string" || name.trim() === "") return [];
    const metadata = isObject(item.metadata) ? item.metadata : {};
    const api = isObject(metadata.api) ? metadata.api : {};
    const react = isObject(metadata.react) ? metadata.react : {};
    const publicImport = readImport(item, provider, name);
    return [{
      provider: provider.name,
      kind: item.type,
      id: typeof item.id === "string" ? item.id : undefined,
      name,
      packageName: publicImport.packageName,
      importName: publicImport.importName,
      description: typeof item.description === "string" ? item.description : undefined,
      whenToUse: strings(item.whenToUse),
      whenNotToUse: strings(item.whenNotToUse),
      props: readProps(api.props),
      variants: [],
      members: readMembers(api.members),
      callSignatures: readCallSignatures(api.callSignatures),
      patterns: Object.entries(react)
        .filter(([, enabled]) => enabled === true)
        .map(([pattern]) => pattern)
        .sort((a, b) => a.localeCompare(b)),
      relationships: readRelationships(item.relatedResources),
      examples: readExamples(metadata.examples)
    }];
  });
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

export function buildAgentKnowledgeView(discovery: DiscoveryResult): AgentKnowledgeView {
  const resources = discovery.providers
    .flatMap((provider) => [...componentResources(provider), ...knowledgeResources(provider)])
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name));
  return {
    discovery,
    resources,
    rules: uniqueSorted(discovery.providers.flatMap((provider) => namedEntries(provider.manifest, "rules"))),
    examples: uniqueSorted(discovery.providers.flatMap((provider) => namedEntries(provider.manifest, "examples")))
  };
}
