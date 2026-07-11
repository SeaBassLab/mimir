import path from "node:path";
import { getConfiguredAdapters } from "../adapters";
import { discoverProviders } from "../dependency-discovery/discover-providers";
import { resolveApsPackageConfig } from "../configuration/package-config";
import { generateContext } from "../synchronization/context-generator";
import { readJson } from "../io/fs";

export async function runSyncWorkflow(cwd: string) {
  const discovery = await discoverProviders(cwd);
  const contextResult = await generateContext(cwd, discovery);

  const packageJson = await readJson<Record<string, unknown>>(path.join(cwd, "package.json"));
  const configResolution = resolveApsPackageConfig(packageJson);
  const adapters = getConfiguredAdapters(configResolution.config?.adapters);

  const adapterResults = [];
  for (const adapter of adapters) {
    const result = await adapter.sync({
      cwd,
      contextDir: contextResult.outputDir,
      contextFiles: contextResult.files,
      providers: discovery.providers
    });
    adapterResults.push(result);
  }

  return {
    discovery,
    contextResult,
    adapterResults
  };
}
