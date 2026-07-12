import path from "node:path";
import { readdir } from "node:fs/promises";

export const DESCRIPTOR_SUFFIXES = [".mimir.yaml", ".mimir.yml"];

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

function shouldSkipDirectory(name: string): boolean {
  if (name === "node_modules" || name === "dist" || name === ".git") {
    return true;
  }

  if (name.startsWith(".") && name !== ".aps") {
    return true;
  }

  return false;
}

async function collectDescriptorFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }
      files.push(...(await collectDescriptorFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && DESCRIPTOR_SUFFIXES.some((suffix) => entry.name.endsWith(suffix))) {
      files.push(absolutePath);
    }
  }

  return files;
}

export async function discoverDescriptorFiles(cwd: string): Promise<string[]> {
  const descriptorPaths = await collectDescriptorFiles(cwd);
  return descriptorPaths
    .map((filePath) => normalizeSlashes(path.relative(cwd, filePath)))
    .sort((a, b) => a.localeCompare(b));
}