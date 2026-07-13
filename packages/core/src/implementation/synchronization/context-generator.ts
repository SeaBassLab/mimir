import path from "node:path";
import type { DiscoveryResult } from "../dependency-discovery/discover-providers";
import { deleteFile, ensureDir, writeText } from "../io/fs";
import { buildAgentKnowledgeView } from "./agent-knowledge";
import { renderAgentContext } from "./context-renderer";

type ContextOutput = {
  outputDir: string;
  files: string[];
};

const MANAGED_CONTEXT_FILES = [
  "index.md",
  "providers.md",
  "components.md",
  "tokens.md",
  "hooks.md",
  "contexts.md",
  "templates.md",
  "resources.md",
  "rules.md",
  "examples.md"
];

export async function generateContext(cwd: string, discovery: DiscoveryResult): Promise<ContextOutput> {
  const outputDir = path.join(cwd, ".agents", "aps");
  await ensureDir(outputDir);

  const rendered = renderAgentContext(buildAgentKnowledgeView(discovery));
  const renderedNames = new Set(rendered.map((file) => file.name));

  for (const name of MANAGED_CONTEXT_FILES) {
    if (!renderedNames.has(name)) await deleteFile(path.join(outputDir, name));
  }

  const files = rendered.map((file) => path.join(outputDir, file.name));
  await Promise.all(rendered.map((file) => writeText(path.join(outputDir, file.name), file.content)));

  return { outputDir, files };
}
