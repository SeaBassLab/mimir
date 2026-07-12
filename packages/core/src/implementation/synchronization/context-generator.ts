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

function buildIndexMd(): string {
  return [
    "# APS Context",
    "",
    "Generated APS knowledge for AI agents.",
    "",
    "Read in order:",
    "- providers.md",
    "- components.md",
    "- rules.md",
    "- examples.md",
    ""
  ].join("\n");
}

export async function generateContext(cwd: string, discovery: DiscoveryResult): Promise<ContextOutput> {
  const outputDir = path.join(cwd, ".agents", "aps");
  await ensureDir(outputDir);

  const components = discovery.providers.flatMap(extractComponents);
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
    path.join(outputDir, "rules.md"),
    path.join(outputDir, "examples.md")
  ];

  await writeText(files[0], buildIndexMd());
  await writeText(files[1], buildProvidersMd(discovery));
  await writeText(files[2], buildComponentsMd(components));
  await writeText(files[3], buildSimpleList("APS Rules", rules));
  await writeText(files[4], buildSimpleList("APS Examples", examples));

  return {
    outputDir,
    files
  };
}
