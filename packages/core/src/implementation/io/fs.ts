import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function readText(filePath: string): Promise<string> {
  return readFile(filePath, "utf8");
}

export async function writeText(filePath: string, content: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await writeFile(filePath, content, "utf8");
}

export async function readJson<T>(filePath: string): Promise<T> {
  const raw = await readText(filePath);

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid JSON at ${filePath}: ${message}`);
  }
}

export async function writeJson(filePath: string, data: unknown): Promise<void> {
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  await writeText(filePath, serialized);
}
