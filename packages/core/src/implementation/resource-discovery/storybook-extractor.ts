import path from "node:path";
import { readdir } from "node:fs/promises";
import { readText } from "../io/fs";
import type { StorybookFacts } from "../contracts/resource";

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

async function collectStoryFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
        continue;
      }
      files.push(...(await collectStoryFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && entry.name.includes(".stories.")) {
      files.push(absolutePath);
    }
  }

  return files;
}

export async function extractStorybookFacts(cwd: string): Promise<StorybookFacts> {
  const files = await collectStoryFiles(cwd);
  const variantsByComponent: Record<string, string[]> = {};
  const storyFilesByComponent: Record<string, string[]> = {};

  for (const file of files) {
    const content = await readText(file);
    const componentMatch = /component\s*:\s*([A-Z][A-Za-z0-9_]*)/.exec(content);
    if (!componentMatch) {
      continue;
    }

    const componentName = componentMatch[1];
    if (!variantsByComponent[componentName]) {
      variantsByComponent[componentName] = [];
      storyFilesByComponent[componentName] = [];
    }

    const relativeFile = normalizeSlashes(path.relative(cwd, file));
    storyFilesByComponent[componentName].push(relativeFile);

    const variantPattern = /export\s+const\s+([A-Za-z][A-Za-z0-9_]*)\s*[:=]/g;
    let match: RegExpExecArray | null;
    while ((match = variantPattern.exec(content)) !== null) {
      const variantName = match[1];
      if (!variantsByComponent[componentName].includes(variantName)) {
        variantsByComponent[componentName].push(variantName);
      }
    }

    variantsByComponent[componentName].sort((a, b) => a.localeCompare(b));
  }

  return {
    variantsByComponent,
    storyFilesByComponent
  };
}
