import { isObject } from "../../shared/json";
import {
  validateApsComponent,
  type ApsComponent,
  type ResourceValidationResult as ComponentValidationResult
} from "./aps-component-schema";
import {
  validateApsRule,
  type ApsRule,
  type ResourceValidationResult as RuleValidationResult
} from "./aps-rule-schema";
import {
  validateApsExample,
  type ApsExample,
  type ResourceValidationResult as ExampleValidationResult
} from "./aps-example-schema";
import {
  validateApsPattern,
  type ApsPattern,
  type ResourceValidationResult as PatternValidationResult
} from "./aps-pattern-schema";
import {
  validateApsMigration,
  type ApsMigration,
  type ResourceValidationResult as MigrationValidationResult
} from "./aps-migration-schema";
import type { SchemaValidationResult, ValidationIssue } from "./index";

const SUPPORTED_VERSIONS = new Set([1]);

type ValidatorResult<T> =
  | ComponentValidationResult<T>
  | RuleValidationResult<T>
  | ExampleValidationResult<T>
  | PatternValidationResult<T>
  | MigrationValidationResult<T>;

function appendResourcePath(resourceType: string, resourceName: string): string {
  return `${resourceType}.${resourceName}`;
}

function validateResourceList<T>(
  value: unknown,
  resourceType: string,
  validateItem: (item: unknown, path: string) => ValidatorResult<T>
): {
  values: T[];
  errors: ValidationIssue[];
  warnings: string[];
  validResources: string[];
} {
  const errors: ValidationIssue[] = [];
  const warnings: string[] = [];
  const validResources: string[] = [];
  const values: T[] = [];

  if (value === undefined) {
    return { values, errors, warnings, validResources };
  }

  if (!Array.isArray(value)) {
    errors.push({
      code: `APS_INVALID_${resourceType.toUpperCase()}`,
      path: resourceType,
      message: `${resourceType} must be an array`
    });
    return { values, errors, warnings, validResources };
  }

  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    const basePath = `${resourceType}[${index}]`;
    const result = validateItem(item, basePath);

    warnings.push(...result.warnings);

    if (!result.valid || !result.value) {
      errors.push(...result.errors);
      continue;
    }

    values.push(result.value);
    const nameCandidate = (result.value as { name?: unknown }).name;
    if (typeof nameCandidate === "string" && nameCandidate.trim() !== "") {
      validResources.push(appendResourcePath(resourceType, nameCandidate));
    } else {
      validResources.push(basePath);
    }
  }

  return { values, errors, warnings, validResources };
}

export type ApsManifest = {
  version: number;
  components?: ApsComponent[];
  rules?: ApsRule[];
  examples?: ApsExample[];
  patterns?: ApsPattern[];
  migrations?: ApsMigration[];
};

export function validateApsManifest(value: unknown): SchemaValidationResult<ApsManifest> {
  const errors: ValidationIssue[] = [];
  const warnings: string[] = [];
  const validResources: string[] = [];

  if (!isObject(value)) {
    return {
      valid: false,
      errors: [
        {
          code: "APS_INVALID_MANIFEST",
          path: "manifest",
          message: "Manifest must be an object"
        }
      ],
      warnings,
      validResources
    };
  }

  const version = value.version;
  if (typeof version !== "number") {
    errors.push({
      code: "APS_INVALID_MANIFEST_VERSION",
      path: "version",
      message: "Manifest.version is required and must be a number"
    });
  } else if (!SUPPORTED_VERSIONS.has(version)) {
    errors.push({
      code: "APS_UNSUPPORTED_MANIFEST_VERSION",
      path: "version",
      message: `Manifest.version ${version} is not supported`
    });
  }

  const componentsResult = validateResourceList(value.components, "components", validateApsComponent);
  const rulesResult = validateResourceList(value.rules, "rules", validateApsRule);
  const examplesResult = validateResourceList(value.examples, "examples", validateApsExample);
  const patternsResult = validateResourceList(value.patterns, "patterns", validateApsPattern);
  const migrationsResult = validateResourceList(value.migrations, "migrations", validateApsMigration);

  errors.push(
    ...componentsResult.errors,
    ...rulesResult.errors,
    ...examplesResult.errors,
    ...patternsResult.errors,
    ...migrationsResult.errors
  );

  warnings.push(
    ...componentsResult.warnings,
    ...rulesResult.warnings,
    ...examplesResult.warnings,
    ...patternsResult.warnings,
    ...migrationsResult.warnings
  );

  validResources.push(
    ...componentsResult.validResources,
    ...rulesResult.validResources,
    ...examplesResult.validResources,
    ...patternsResult.validResources,
    ...migrationsResult.validResources
  );

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings,
      validResources
    };
  }

  const manifest: ApsManifest = {
    version: version as number,
    components: componentsResult.values.length > 0 ? componentsResult.values : undefined,
    rules: rulesResult.values.length > 0 ? rulesResult.values : undefined,
    examples: examplesResult.values.length > 0 ? examplesResult.values : undefined,
    patterns: patternsResult.values.length > 0 ? patternsResult.values : undefined,
    migrations: migrationsResult.values.length > 0 ? migrationsResult.values : undefined
  };

  return {
    valid: true,
    value: manifest,
    errors,
    warnings,
    validResources
  };
}
