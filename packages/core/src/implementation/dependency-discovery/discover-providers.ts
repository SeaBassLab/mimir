import path from "node:path";
import { readJson } from "../io/fs";
import { isObject } from "../io/json";
import { loadApsProvider, type DiscoveredProvider } from "../configuration/manifest-loader";

type RootPackageJson = {
  dependencies?: unknown;
  devDependencies?: unknown;
};

export type DiscoveryResult = {
  providers: DiscoveredProvider[];
  unresolvedDependencies: string[];
};

function readDependencyNames(value: unknown): string[] {
  if (!isObject(value)) {
    return [];
  }

  return Object.keys(value);
}

export async function discoverProviders(cwd: string): Promise<DiscoveryResult> {
  const packageJsonPath = path.join(cwd, "package.json");
  const packageJson = await readJson<RootPackageJson>(packageJsonPath);

  const dependencies = readDependencyNames(packageJson.dependencies);
  const devDependencies = readDependencyNames(packageJson.devDependencies);

  const uniqueDependencies = [...new Set([...dependencies, ...devDependencies])].sort((a, b) =>
    a.localeCompare(b)
  );

  const providers: DiscoveredProvider[] = [];
  const unresolvedDependencies: string[] = [];

  for (const dependency of uniqueDependencies) {
    const provider = await loadApsProvider(dependency, cwd);

    if (!provider) {
      unresolvedDependencies.push(dependency);
      continue;
    }

    providers.push(provider);
  }

  providers.sort((a, b) => a.name.localeCompare(b.name));

  return {
    providers,
    unresolvedDependencies
  };
}
