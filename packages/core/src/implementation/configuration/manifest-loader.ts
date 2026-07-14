import path from "node:path";
import { createRequire } from "node:module";
import { fileExists, readJson } from "../io/fs";
import { isObject } from "../io/json";
import { extractResourceCounts } from "../query/resource-summary";
import { resolveApsPackageConfig, type ApsPackageConfig } from "./package-config";

const DEFAULT_MANIFEST_PATH = "./dist/aps/manifest.json";

export type DiscoveredProvider = {
  name: string;
  packageRoot: string;
  packageJsonPath: string;
  aps: ApsPackageConfig;
  configSource: "aps" | "ai";
  manifestPath: string;
  manifest: Record<string, unknown> | null;
  resourceCounts: Array<{ key: string; count: number }>;
  warnings: string[];
};

type PackageJson = {
  name?: string;
  aps?: unknown;
  ai?: unknown;
  [key: string]: unknown;
};

async function resolvePackageJsonPath(
  requireFromApp: ReturnType<typeof createRequire>,
  packageName: string
): Promise<string | null> {
  try {
    return requireFromApp.resolve(`${packageName}/package.json`);
  } catch {
    // Some packages use `exports` and do not expose package.json directly.
  }

  let packageEntryPath: string;

  try {
    packageEntryPath = requireFromApp.resolve(packageName);
  } catch {
    return null;
  }

  let currentDir = path.dirname(packageEntryPath);

  while (true) {
    const candidate = path.join(currentDir, "package.json");

    if (await fileExists(candidate)) {
      try {
        const parsed = await readJson<PackageJson>(candidate);
        if (parsed.name === packageName) {
          return candidate;
        }
      } catch {
        // Ignore malformed package.json candidates and keep walking up.
      }
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      break;
    }
    currentDir = parentDir;
  }

  return null;
}

export async function loadApsProvider(
  packageName: string,
  fromDirectory: string
): Promise<DiscoveredProvider | null> {
  const requireFromApp = createRequire(path.join(fromDirectory, "package.json"));

  const packageJsonPath = await resolvePackageJsonPath(requireFromApp, packageName);

  if (!packageJsonPath) {
    return null;
  }

  const packageRoot = path.dirname(packageJsonPath);
  const packageJson = await readJson<PackageJson>(packageJsonPath);

  const configResolution = resolveApsPackageConfig(packageJson);

  if (!configResolution.config || !configResolution.source) {
    return null;
  }

  const aps = configResolution.config;
  const manifestRelPath =
    typeof aps.manifest === "string" ? aps.manifest : DEFAULT_MANIFEST_PATH;
  const manifestPath = path.resolve(packageRoot, manifestRelPath);
  const warnings: string[] = [...configResolution.warnings];

  let manifest: Record<string, unknown> | null = null;

  if (await fileExists(manifestPath)) {
    try {
      const parsed = await readJson<unknown>(manifestPath);
      if (isObject(parsed)) {
        manifest = parsed;
      } else {
        warnings.push(`Manifest is not an object: ${manifestPath}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(message);
    }
  } else {
    warnings.push(`Manifest file missing: ${manifestPath}`);
  }

  return {
    name: packageJson.name ?? packageName,
    packageRoot,
    packageJsonPath,
    aps,
    configSource: configResolution.source,
    manifestPath,
    manifest,
    resourceCounts: manifest ? extractResourceCounts(manifest) : [],
    warnings
  };
}
