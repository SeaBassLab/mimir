import path from "node:path";
import type { ApsManifest } from "../../protocol/manifest";
import { resolveApsPackageConfig } from "../configuration/package-config";
import { validateGovernance } from "../../protocol/governance";
import { fileExists, readJson } from "../io/fs";

export async function runGovernanceValidation(cwd: string) {
  const packageJsonPath = path.join(cwd, "package.json");

  if (!(await fileExists(packageJsonPath))) {
    throw new Error("package.json not found");
  }

  const packageJson = await readJson<Record<string, unknown>>(packageJsonPath);
  const configResolution = resolveApsPackageConfig(packageJson);

  if (!configResolution.config || typeof configResolution.config.manifest !== "string") {
    throw new Error("aps.manifest is missing in package.json");
  }

  const manifestPath = path.resolve(cwd, configResolution.config.manifest);
  if (!(await fileExists(manifestPath))) {
    throw new Error(`manifest not found at ${manifestPath}`);
  }

  const manifest = await readJson<ApsManifest>(manifestPath);
  return validateGovernance(manifest);
}
