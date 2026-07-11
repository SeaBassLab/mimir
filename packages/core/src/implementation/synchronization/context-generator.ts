import path from "node:path";
import type { DiscoveryResult } from "../dependency-discovery/discover-providers";
import type { DiscoveredProvider } from "../configuration/manifest-loader";
import { ensureDir, writeText } from "../io/fs";
import { isObject } from "../io/json";

type ContextOutput = {
  outputDir: string;
  files: string[];
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

  const components = uniqueSorted(
    discovery.providers.flatMap((provider) => extractNamedEntries(provider.manifest, "components"))
  );
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
  await writeText(files[2], buildSimpleList("APS Components", components));
  await writeText(files[3], buildSimpleList("APS Rules", rules));
  await writeText(files[4], buildSimpleList("APS Examples", examples));

  return {
    outputDir,
    files
  };
}
