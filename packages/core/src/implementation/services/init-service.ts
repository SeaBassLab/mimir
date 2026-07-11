import path from "node:path";
import { resolveApsPackageConfig } from "../configuration/package-config";
import { fileExists, readJson, writeJson } from "../io/fs";
import { isObject } from "../io/json";

type PackageJson = Record<string, unknown>;

type PrepareInitResult = {
  changed: boolean;
  legacyAiDetected: boolean;
};

const APS_DEFAULT_CONFIG = {
  version: 1,
  manifest: "./dist/knowledge/manifest.json"
};

export async function prepareApsConfig(cwd: string): Promise<PrepareInitResult> {
  const packageJsonPath = path.join(cwd, "package.json");

  if (!(await fileExists(packageJsonPath))) {
    throw new Error("package.json not found in current directory.");
  }

  const packageJson = await readJson<PackageJson>(packageJsonPath);
  const hadAps = isObject(packageJson.aps);
  const configResolution = resolveApsPackageConfig(packageJson);
  const apsSection = isObject(packageJson.aps)
    ? { ...packageJson.aps }
    : isObject(configResolution.config)
      ? { ...configResolution.config }
      : {};

  let changed = false;

  if (apsSection.version === undefined) {
    apsSection.version = APS_DEFAULT_CONFIG.version;
    changed = true;
  }

  if (apsSection.manifest === undefined) {
    apsSection.manifest = APS_DEFAULT_CONFIG.manifest;
    changed = true;
  }

  if (!isObject(packageJson.aps)) {
    changed = true;
  }

  if (changed) {
    packageJson.aps = apsSection;
    await writeJson(packageJsonPath, packageJson);
  }

  return {
    changed,
    legacyAiDetected: configResolution.source === "ai" && !hadAps
  };
}
