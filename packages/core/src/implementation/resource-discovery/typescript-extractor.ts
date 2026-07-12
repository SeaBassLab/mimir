import path from "node:path";
import { readdir } from "node:fs/promises";
import { readText } from "../io/fs";
import type { ExtractedComponentFact, ExtractedProp } from "../contracts/resource";

const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

function isPascalCase(name: string): boolean {
  return /^[A-Z][A-Za-z0-9]*$/.test(name);
}

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
        continue;
      }
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    if (
      entry.isFile() &&
      TS_EXTENSIONS.has(path.extname(entry.name)) &&
      !entry.name.includes(".stories.")
    ) {
      files.push(absolutePath);
    }
  }

  return files;
}

function extractExportedNames(content: string): string[] {
  const names = new Set<string>();
  const patterns = [
    /export\s+function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g,
    /export\s+const\s+([A-Z][A-Za-z0-9_]*)\s*[:=]/g,
    /export\s+class\s+([A-Z][A-Za-z0-9_]*)\s+/g,
    /export\s+\{\s*([^}]+)\s*\}/g
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(content)) !== null) {
      if (pattern.source.includes("[^}]+")) {
        const tokens = match[1].split(",").map((item) => item.trim());
        for (const token of tokens) {
          const aliasParts = token.split(/\s+as\s+/i).map((part) => part.trim());
          const candidate = aliasParts[aliasParts.length - 1];
          if (isPascalCase(candidate)) {
            names.add(candidate);
          }
        }
      } else {
        const candidate = match[1];
        if (isPascalCase(candidate)) {
          names.add(candidate);
        }
      }
    }
  }

  return [...names].sort((a, b) => a.localeCompare(b));
}

function parsePropsBlock(block: string): Record<string, ExtractedProp> {
  const result: Record<string, ExtractedProp> = {};
  const lines = block.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\??:\s*([^;]+);?$/.exec(trimmed);
    if (!match) {
      continue;
    }

    const propName = match[1];
    const propType = match[2].trim();
    const optional = trimmed.includes("?:");
    result[propName] = {
      name: propName,
      type: propType,
      required: !optional
    };
  }

  return result;
}

function extractProps(content: string, componentName: string): Record<string, ExtractedProp> {
  const interfacePattern = new RegExp(
    `interface\\s+${componentName}Props\\s*\\{([\\s\\S]*?)\\}`,
    "m"
  );
  const typePattern = new RegExp(
    `type\\s+${componentName}Props\\s*=\\s*\\{([\\s\\S]*?)\\}`,
    "m"
  );

  const interfaceMatch = interfacePattern.exec(content);
  if (interfaceMatch) {
    return parsePropsBlock(interfaceMatch[1]);
  }

  const typeMatch = typePattern.exec(content);
  if (typeMatch) {
    return parsePropsBlock(typeMatch[1]);
  }

  return {};
}

export async function extractTypeScriptComponents(
  cwd: string,
  packageName: string
): Promise<ExtractedComponentFact[]> {
  const files = await collectFiles(cwd);
  const components: ExtractedComponentFact[] = [];

  for (const filePath of files) {
    const content = await readText(filePath);
    const exportedNames = extractExportedNames(content);
    if (exportedNames.length === 0) {
      continue;
    }

    const relativeFilePath = normalizeSlashes(path.relative(cwd, filePath));

    for (const exportedName of exportedNames) {
      components.push({
        name: exportedName,
        filePath: relativeFilePath,
        importName: exportedName,
        packageName,
        props: extractProps(content, exportedName)
      });
    }
  }

  const unique = new Map<string, ExtractedComponentFact>();
  for (const component of components) {
    const key = component.name;
    const previous = unique.get(key);
    if (!previous) {
      unique.set(key, component);
      continue;
    }

    const previousScore =
      Object.keys(previous.props).length + (previous.filePath.endsWith("/index.ts") ? 0 : 1);
    const candidateScore =
      Object.keys(component.props).length + (component.filePath.endsWith("/index.ts") ? 0 : 1);

    if (candidateScore > previousScore) {
      unique.set(key, component);
    }
  }

  return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
}
