import { discoverProviders } from "../dependency-discovery/discover-providers";
import { resolveApsPackageConfig } from "../configuration/package-config";
import { validateApsPackage } from "../validation-engine/validate-package";
import { collectGovernanceResources, validateGovernance, type GovernanceResource } from "../../protocol/governance";
import type { ApsManifest } from "../../protocol/manifest";
import { fileExists, readJson } from "../io/fs";
import { isObject } from "../io/json";
import path from "node:path";

export type DoctorCheck = {
  name: string;
  status: "pass" | "fail";
  details: string;
};

export type DoctorProviderReport = {
  provider: string;
  level: number;
  maxLevel: number;
  checks: DoctorCheck[];
  recommendations: string[];
};

export type DoctorReport = {
  providers: DoctorProviderReport[];
};

type DoctorEvaluableProvider = {
  name: string;
  packageRoot: string;
  manifestPath: string;
  manifest: Record<string, unknown> | null;
};

type LocalPackageJson = {
  name?: unknown;
  aps?: unknown;
  ai?: unknown;
  [key: string]: unknown;
};

async function loadCurrentProvider(cwd: string) {
  const packageJsonPath = path.join(cwd, "package.json");
  if (!(await fileExists(packageJsonPath))) {
    return null;
  }

  const packageJson = await readJson<LocalPackageJson>(packageJsonPath);
  const config = resolveApsPackageConfig(packageJson as Record<string, unknown>);

  if (!config.config) {
    return null;
  }

  const manifestRelPath =
    typeof config.config.manifest === "string"
      ? config.config.manifest
      : "./dist/knowledge/manifest.json";
  const manifestPath = path.resolve(cwd, manifestRelPath);

  let manifest: Record<string, unknown> | null = null;
  if (await fileExists(manifestPath)) {
    const parsed = await readJson<unknown>(manifestPath);
    if (isObject(parsed)) {
      manifest = parsed;
    }
  }

  return {
    name:
      typeof packageJson.name === "string" && packageJson.name.trim() !== ""
        ? packageJson.name
        : "(current-package)",
    packageRoot: cwd,
    manifest,
    manifestPath
  };
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function hasArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function hasTopLevelOrGovernance(resource: GovernanceResource, field: string): boolean {
  if (resource[field] !== undefined && resource[field] !== null) {
    return true;
  }

  if (!isObject(resource.metadata) || !isObject(resource.metadata.governance)) {
    return false;
  }

  return resource.metadata.governance[field] !== undefined;
}

function evaluateLevel1(resources: GovernanceResource[]): { checks: DoctorCheck[]; missing: string[] } {
  const checks: DoctorCheck[] = [];
  const missing: string[] = [];

  const requiredBase = ["id", "type", "name", "description"] as const;
  for (const field of requiredBase) {
    const ok = resources.every((resource) => hasText(resource[field]));
    checks.push({
      name: `Level 1: all resources require ${field}`,
      status: ok ? "pass" : "fail",
      details: ok ? "All resources include field" : `Missing ${field} in one or more resources`
    });
    if (!ok) {
      missing.push(`Add ${field} to all resources`);
    }
  }

  const components = resources.filter((resource) => resource.type === "component");
  const componentFields = ["package", "import", "whenToUse", "whenNotToUse"] as const;
  for (const field of componentFields) {
    const ok = components.length === 0 || components.every((resource) => {
      const value = resource[field];
      return hasText(value) || hasArray(value);
    });
    checks.push({
      name: `Level 1: components require ${field}`,
      status: ok ? "pass" : "fail",
      details: components.length === 0 ? "No component resources found" : ok ? "All components include field" : `Missing ${field} in one or more components`
    });
    if (!ok) {
      missing.push(`Add component.${field}`);
    }
  }

  const rules = resources.filter((resource) => resource.type === "rule");
  const ruleFields = ["severity", "scope", "appliesTo"] as const;
  for (const field of ruleFields) {
    const ok = rules.length === 0 || rules.every((resource) => hasText(resource[field]) || hasArray(resource[field]));
    checks.push({
      name: `Level 1: rules require ${field}`,
      status: ok ? "pass" : "fail",
      details: rules.length === 0 ? "No rule resources found" : ok ? "All rules include field" : `Missing ${field} in one or more rules`
    });
    if (!ok) {
      missing.push(`Add rule.${field}`);
    }
  }

  const examples = resources.filter((resource) => resource.type === "example");
  const exampleFields = ["code", "imports", "relatedResources"] as const;
  for (const field of exampleFields) {
    const ok = examples.length === 0 || examples.every((resource) => {
      const value = field === "relatedResources" ? (resource.relatedResources ?? resource.relatedResourceIds) : resource[field];
      return hasText(value) || hasArray(value);
    });
    checks.push({
      name: `Level 1: examples require ${field}`,
      status: ok ? "pass" : "fail",
      details: examples.length === 0 ? "No example resources found" : ok ? "All examples include field" : `Missing ${field} in one or more examples`
    });
    if (!ok) {
      missing.push(`Add example.${field}`);
    }
  }

  return { checks, missing };
}

function evaluateLevel2(resources: GovernanceResource[], governanceResultValid: boolean): { checks: DoctorCheck[]; missing: string[] } {
  const checks: DoctorCheck[] = [];
  const missing: string[] = [];

  const fields = ["provenance", "evidence", "applicability", "lifecycle"] as const;
  for (const field of fields) {
    const ok = resources.length > 0 && resources.every((resource) => hasTopLevelOrGovernance(resource, field));
    checks.push({
      name: `Level 2: governance requires ${field}`,
      status: ok ? "pass" : "fail",
      details: ok ? `All resources include ${field}` : `Missing ${field} in one or more resources`
    });
    if (!ok) {
      missing.push(`Add governance ${field}`);
    }
  }

  const governanceCheck: DoctorCheck = {
    name: "Level 2: governance validation contract",
    status: governanceResultValid ? "pass" : "fail",
    details: governanceResultValid
      ? "Governance validation passed"
      : "Governance validation failed; review governance errors"
  };
  checks.push(governanceCheck);
  if (!governanceResultValid) {
    missing.push("Fix governance validation errors");
  }

  return { checks, missing };
}

function evaluateLevel3(resources: GovernanceResource[]): { checks: DoctorCheck[]; missing: string[] } {
  const checks: DoctorCheck[] = [];
  const missing: string[] = [];

  const fields = [
    { key: "ownership", label: "ownership" },
    { key: "conflicts", label: "conflict resolution metadata" },
    { key: "migrations", label: "migrations" },
    { key: "versionCompatibility", label: "version compatibility" },
    { key: "reviewLifecycle", label: "review lifecycle" }
  ] as const;

  for (const item of fields) {
    const ok = resources.length > 0 && resources.every((resource) => hasTopLevelOrGovernance(resource, item.key));
    checks.push({
      name: `Level 3: ${item.label}`,
      status: ok ? "pass" : "fail",
      details: ok ? `All resources include ${item.label}` : `Missing ${item.label} in one or more resources`
    });
    if (!ok) {
      missing.push(`Add ${item.label}`);
    }
  }

  return { checks, missing };
}

function computeLevel(
  level0Pass: boolean,
  level1Pass: boolean,
  level2Pass: boolean,
  level3Pass: boolean
): number {
  if (level3Pass) {
    return 3;
  }
  if (level2Pass) {
    return 2;
  }
  if (level1Pass) {
    return 1;
  }
  if (level0Pass) {
    return 0;
  }
  return 0;
}

export async function runDoctor(cwd: string): Promise<DoctorReport> {
  const discovery = await discoverProviders(cwd);
  const providers: DoctorEvaluableProvider[] = discovery.providers.map((provider) => ({
    name: provider.name,
    packageRoot: provider.packageRoot,
    manifestPath: provider.manifestPath,
    manifest: provider.manifest
  }));

  if (providers.length === 0) {
    const currentProvider = await loadCurrentProvider(cwd);
    if (currentProvider) {
      providers.push(currentProvider);
    }
  }

  const reports: DoctorProviderReport[] = [];

  for (const provider of providers) {
    const checks: DoctorCheck[] = [];
    const recommendations: string[] = [];

    const manifestExists = provider.manifest !== null;
    checks.push({
      name: "Level 0: manifest exists",
      status: manifestExists ? "pass" : "fail",
      details: manifestExists ? provider.manifestPath : `Missing manifest at ${provider.manifestPath}`
    });

    const resourcesLoad = manifestExists;
    checks.push({
      name: "Level 0: resources load",
      status: resourcesLoad ? "pass" : "fail",
      details: resourcesLoad ? "Manifest loaded successfully" : "Cannot load resources without manifest"
    });

    const validation = await validateApsPackage(provider.packageRoot);
    checks.push({
      name: "Level 0: mimir validate passes",
      status: validation.valid ? "pass" : "fail",
      details: validation.valid
        ? `Validation passed with ${validation.validResources.length} valid resources`
        : `Validation failed with ${validation.errors.length} errors`
    });

    const level0Pass = manifestExists && resourcesLoad && validation.valid;

    const manifest = provider.manifest;
    const resources = manifest ? collectGovernanceResources(manifest as ApsManifest).resources : [];

    const level1 = evaluateLevel1(resources);
    checks.push(...level1.checks);
    const level1Pass = level0Pass && level1.checks.every((item) => item.status === "pass");

    const governanceResult = manifest
      ? validateGovernance(manifest as ApsManifest)
      : {
          valid: false,
          errors: [],
          warnings: [],
          metrics: { resourcesChecked: 0, evidenceCoverage: 0, provenanceCoverage: 0 }
        };

    const level2 = evaluateLevel2(resources, governanceResult.valid);
    checks.push(...level2.checks);
    const level2Pass = level1Pass && level2.checks.every((item) => item.status === "pass");

    const level3 = evaluateLevel3(resources);
    checks.push(...level3.checks);
    const level3Pass = level2Pass && level3.checks.every((item) => item.status === "pass");

    const level = computeLevel(level0Pass, level1Pass, level2Pass, level3Pass);

    if (!level0Pass) {
      recommendations.push("Ensure provider is APS compatible: manifest load + validate pass.");
    }
    if (!level1Pass) {
      recommendations.push(...level1.missing.map((item) => `Level 1: ${item}`));
    }
    if (!level2Pass) {
      recommendations.push(...level2.missing.map((item) => `Level 2: ${item}`));
    }
    if (!level3Pass) {
      recommendations.push(...level3.missing.map((item) => `Level 3: ${item}`));
    }

    reports.push({
      provider: provider.name,
      level,
      maxLevel: 3,
      checks,
      recommendations: [...new Set(recommendations)]
    });
  }

  reports.sort((a, b) => a.provider.localeCompare(b.provider));

  return { providers: reports };
}
