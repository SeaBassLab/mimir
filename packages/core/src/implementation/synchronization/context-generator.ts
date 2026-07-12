import path from "node:path";
import type { DiscoveryResult } from "../dependency-discovery/discover-providers";
import type { DiscoveredProvider } from "../configuration/manifest-loader";
import { ensureDir, writeText } from "../io/fs";
import { isObject } from "../io/json";

type ContextOutput = {
  outputDir: string;
  files: string[];
};

type ComponentContext = {
  provider: string;
  id?: string;
  name: string;
  description?: string;
  whenToUse: string[];
  whenNotToUse: string[];
};

type ResourceContext = ComponentContext & {
  type: string;
  importName?: string;
  relatedResources: string[];
  apiProps: string[];
  apiMembers: string[];
  patterns: string[];
};

function formatCounts(provider: DiscoveredProvider): string {
  if (provider.resourceCounts.length === 0) {
    return "none";
  }

  return provider.resourceCounts.map((item) => `${item.key}: ${item.count}`).join(", ");
}

function extractNamedEntries(manifest: Record<string, unknown> | null, key: string): string[] {
  if (!manifest) {
    return [];
  }

  const section = manifest[key];

  if (!Array.isArray(section)) {
    return [];
  }

  const entries = section
    .map((item) => {
      if (typeof item === "string") {
        return item;
      }

      if (isObject(item)) {
        const candidate = item.name ?? item.id ?? item.title ?? item.path;
        return typeof candidate === "string" ? candidate : null;
      }

      return null;
    })
    .filter((item): item is string => Boolean(item))
    .sort((a, b) => a.localeCompare(b));

  return entries;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function extractComponents(provider: DiscoveredProvider): ComponentContext[] {
  const section = provider.manifest?.components;
  if (!Array.isArray(section)) {
    return [];
  }

  return section
    .map((item): ComponentContext | null => {
      if (typeof item === "string") {
        return {
          provider: provider.name,
          name: item,
          whenToUse: [],
          whenNotToUse: []
        };
      }

      if (!isObject(item)) {
        return null;
      }

      const nameCandidate = item.name ?? item.id;
      if (typeof nameCandidate !== "string" || nameCandidate.trim() === "") {
        return null;
      }

      return {
        provider: provider.name,
        id: typeof item.id === "string" ? item.id : undefined,
        name: nameCandidate,
        description: typeof item.description === "string" ? item.description : undefined,
        whenToUse: readStringArray(item.whenToUse),
        whenNotToUse: readStringArray(item.whenNotToUse)
      };
    })
    .filter((item): item is ComponentContext => item !== null)
    .sort((a, b) =>
      a.provider.localeCompare(b.provider) || a.name.localeCompare(b.name)
    );
}

function readNamedObjects(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => isObject(item) ? item.name ?? item.id ?? item.path : undefined)
    .filter((item): item is string => typeof item === "string");
}

function readApiMembers(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!isObject(item) || typeof item.path !== "string") return null;
      const type = isObject(item.type) ? item.type : {};
      const typeName = type.display ?? type.name;
      return typeof typeName === "string" ? `${item.path}: ${typeName}` : item.path;
    })
    .filter((item): item is string => item !== null);
}

function extractResources(provider: DiscoveredProvider): ResourceContext[] {
  const section = provider.manifest?.resources;
  if (!Array.isArray(section)) {
    return [];
  }

  return section
    .map((item): ResourceContext | null => {
      if (!isObject(item) || typeof item.type !== "string") {
        return null;
      }
      const nameCandidate = item.name ?? item.id;
      if (typeof nameCandidate !== "string" || nameCandidate.trim() === "") {
        return null;
      }
      const metadata = isObject(item.metadata) ? item.metadata : {};
      const api = isObject(metadata.api) ? metadata.api : {};
      const react = isObject(metadata.react) ? metadata.react : {};
      const relatedResources = Array.isArray(item.relatedResources)
        ? item.relatedResources
            .map((related) => {
              if (!isObject(related)) return null;
              const target = related.name ?? related.id;
              if (typeof target !== "string") return null;
              return typeof related.relationship === "string"
                ? `${related.relationship}: ${target}`
                : target;
            })
            .filter((related): related is string => related !== null)
        : [];

      return {
        provider: provider.name,
        type: item.type,
        id: typeof item.id === "string" ? item.id : undefined,
        name: nameCandidate,
        importName: typeof item.import === "string" ? item.import : undefined,
        description: typeof item.description === "string" ? item.description : undefined,
        whenToUse: readStringArray(item.whenToUse),
        whenNotToUse: readStringArray(item.whenNotToUse),
        relatedResources,
        apiProps: readNamedObjects(api.props),
        apiMembers: readApiMembers(api.members),
        patterns: Object.entries(react)
          .filter(([, enabled]) => enabled === true)
          .map(([pattern]) => pattern)
          .sort((a, b) => a.localeCompare(b))
      };
    })
    .filter((item): item is ResourceContext => item !== null)
    .sort(
      (a, b) =>
        a.type.localeCompare(b.type) ||
        a.provider.localeCompare(b.provider) ||
        a.name.localeCompare(b.name)
    );
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function buildProvidersMd(discovery: DiscoveryResult): string {
  const lines: string[] = ["# APS Providers", "", "Discovered APS-enabled packages:", ""];

  if (discovery.providers.length === 0) {
    lines.push("No APS providers found.");
    lines.push("");
    return lines.join("\n");
  }

  for (const provider of discovery.providers) {
    lines.push(`- ${provider.name}`);
    lines.push(`  - manifest: ${provider.manifestPath}`);
    lines.push(`  - resources: ${formatCounts(provider)}`);
    if (provider.warnings.length > 0) {
      lines.push(`  - warnings: ${provider.warnings.join(" | ")}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

function buildSimpleList(title: string, items: string[]): string {
  const lines: string[] = [`# ${title}`, ""];

  if (items.length === 0) {
    lines.push("No entries found.");
    lines.push("");
    return lines.join("\n");
  }

  for (const item of items) {
    lines.push(`- ${item}`);
  }

  lines.push("");
  return lines.join("\n");
}

function buildComponentsMd(components: ComponentContext[]): string {
  const lines: string[] = ["# APS Components", ""];

  if (components.length === 0) {
    lines.push("No entries found.", "");
    return lines.join("\n");
  }

  for (const component of components) {
    lines.push(`## ${component.name}`, "", `Provider: ${component.provider}`);
    if (component.id) {
      lines.push(`Resource ID: ${component.id}`);
    }
    if (component.description?.trim()) {
      lines.push("", component.description.trim());
    }
    if (component.whenToUse.length > 0) {
      lines.push("", "### When to use", "");
      lines.push(...component.whenToUse.map((item) => `- ${item}`));
    }
    if (component.whenNotToUse.length > 0) {
      lines.push("", "### When not to use", "");
      lines.push(...component.whenNotToUse.map((item) => `- ${item}`));
    }
    lines.push("");
  }

  return lines.join("\n");
}

function buildResourcesMd(resources: ResourceContext[]): string {
  const lines: string[] = ["# APS Resources", ""];
  if (resources.length === 0) {
    lines.push("No entries found.", "");
    return lines.join("\n");
  }

  let currentType = "";
  for (const resource of resources) {
    if (resource.type !== currentType) {
      currentType = resource.type;
      lines.push(`## ${currentType}`, "");
    }
    lines.push(`### ${resource.name}`, "", `Provider: ${resource.provider}`);
    if (resource.id) lines.push(`Resource ID: ${resource.id}`);
    if (resource.importName) lines.push(`Import: ${resource.importName}`);
    if (resource.description?.trim()) lines.push("", resource.description.trim());
    if (resource.apiProps.length > 0) lines.push("", `API props: ${resource.apiProps.join(", ")}`);
    if (resource.apiMembers.length > 0) lines.push("", `API members: ${resource.apiMembers.join(", ")}`);
    if (resource.patterns.length > 0) lines.push(`Patterns: ${resource.patterns.join(", ")}`);
    if (resource.relatedResources.length > 0) {
      lines.push("", "Related resources:", ...resource.relatedResources.map((item) => `- ${item}`));
    }
    if (resource.whenToUse.length > 0) {
      lines.push("", "When to use:", ...resource.whenToUse.map((item) => `- ${item}`));
    }
    if (resource.whenNotToUse.length > 0) {
      lines.push("", "When not to use:", ...resource.whenNotToUse.map((item) => `- ${item}`));
    }
    lines.push("");
  }
  return lines.join("\n");
}

function buildIndexMd(): string {
  return [
    "# APS Context",
    "",
    "Generated APS knowledge for AI agents.",
    "",
    "Read in order:",
    "- providers.md",
    "- components.md",
    "- resources.md",
    "- rules.md",
    "- examples.md",
    ""
  ].join("\n");
}

export async function generateContext(cwd: string, discovery: DiscoveryResult): Promise<ContextOutput> {
  const outputDir = path.join(cwd, ".agents", "aps");
  await ensureDir(outputDir);

  const components = discovery.providers.flatMap(extractComponents);
  const resources = discovery.providers.flatMap(extractResources);
  const rules = uniqueSorted(
    discovery.providers.flatMap((provider) => extractNamedEntries(provider.manifest, "rules"))
  );
  const examples = uniqueSorted(
    discovery.providers.flatMap((provider) => extractNamedEntries(provider.manifest, "examples"))
  );

  const files = [
    path.join(outputDir, "index.md"),
    path.join(outputDir, "providers.md"),
    path.join(outputDir, "components.md"),
    path.join(outputDir, "resources.md"),
    path.join(outputDir, "rules.md"),
    path.join(outputDir, "examples.md")
  ];

  await writeText(files[0], buildIndexMd());
  await writeText(files[1], buildProvidersMd(discovery));
  await writeText(files[2], buildComponentsMd(components));
  await writeText(files[3], buildResourcesMd(resources));
  await writeText(files[4], buildSimpleList("APS Rules", rules));
  await writeText(files[5], buildSimpleList("APS Examples", examples));

  return {
    outputDir,
    files
  };
}
