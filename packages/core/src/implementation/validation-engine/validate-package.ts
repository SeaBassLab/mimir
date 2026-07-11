import path from "node:path";
import { fileExists, readJson } from "../io/fs";
import { isObject } from "../io/json";
import { validateApsManifest, type ApsManifest, type ValidationIssue } from "../../protocol/compatibility";
import { resolveApsPackageConfig } from "../configuration/package-config";

export type ApsPackageValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: string[];
  validResources: string[];
  manifestPath?: string;
  manifest?: ApsManifest;
};

function collectResourcePaths(value: unknown, acc: string[]): void {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectResourcePaths(item, acc);
    }
    return;
  }

  if (!isObject(value)) {
    return;
  }

  const pathFields = ["path", "file", "location"];
  for (const field of pathFields) {
    const candidate = value[field];
    if (typeof candidate === "string") {
      acc.push(candidate);
    }
  }

  for (const nested of Object.values(value)) {
    if (nested !== value) {
      collectResourcePaths(nested, acc);
    }
  }
}

export async function validateApsPackage(cwd: string): Promise<ApsPackageValidationResult> {
  const errors: ValidationIssue[] = [];
  const warnings: string[] = [];
  const validResources: string[] = [];

  const packageJsonPath = path.join(cwd, "package.json");
  if (!(await fileExists(packageJsonPath))) {
    return {
      valid: false,
      errors: [
        {
          code: "APS_PACKAGE_JSON_NOT_FOUND",
          path: "package.json",
          message: "package.json not found"
        }
      ],
      warnings,
      validResources
    };
  }

  const packageJson = await readJson<Record<string, unknown>>(packageJsonPath);
  const configResolution = resolveApsPackageConfig(packageJson);

  if (configResolution.warnings.length > 0) {
    warnings.push(...configResolution.warnings);
  }

  if (!isObject(configResolution.config)) {
    errors.push({
      code: "APS_MISSING_CONFIG",
      path: "package.json.aps",
      message: "Missing aps configuration in package.json"
    });
    return { valid: false, errors, warnings, validResources };
  }

  const apsConfig = configResolution.config;
  const sourcePrefix = configResolution.source === "ai" ? "package.json.ai" : "package.json.aps";

  if (typeof apsConfig.version !== "number") {
    errors.push({
      code: "APS_INVALID_CONFIG_VERSION",
      path: `${sourcePrefix}.version`,
      message: "aps.version is required and must be a number"
    });
  }

  if (typeof apsConfig.manifest !== "string") {
    errors.push({
      code: "APS_INVALID_CONFIG_MANIFEST",
      path: `${sourcePrefix}.manifest`,
      message: "aps.manifest is required and must be a string"
    });
    return { valid: false, errors, warnings, validResources };
  }

  const manifestPath = path.resolve(cwd, apsConfig.manifest);

  if (!(await fileExists(manifestPath))) {
    errors.push({
      code: "APS_MANIFEST_NOT_FOUND",
      path: "manifest",
      message: `Manifest not found: ${manifestPath}`
    });
    return { valid: false, errors, warnings, validResources, manifestPath };
  }

  const manifestRaw = await readJson<unknown>(manifestPath);

  const schemaResult = validateApsManifest(manifestRaw);
  errors.push(...schemaResult.errors);
  warnings.push(...schemaResult.warnings);
  validResources.push(...schemaResult.validResources);

  const declaredPaths: string[] = [];
  collectResourcePaths(manifestRaw, declaredPaths);

  const uniquePaths = [...new Set(declaredPaths)].sort((a, b) => a.localeCompare(b));

  for (const resourcePath of uniquePaths) {
    const absolutePath = path.resolve(cwd, resourcePath);
    if (!(await fileExists(absolutePath))) {
      errors.push({
        code: "APS_DECLARED_RESOURCE_NOT_FOUND",
        path: resourcePath,
        message: `Declared resource does not exist: ${resourcePath}`
      });
    }
  }

  if (uniquePaths.length === 0) {
    warnings.push("No declared resource paths found in manifest");
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    validResources,
    manifestPath,
    manifest: schemaResult.valid ? schemaResult.value : undefined
  };
}
