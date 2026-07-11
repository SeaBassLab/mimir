import { isObject } from "../../shared/json";
import type { GovernanceIssue, GovernanceResource, GovernanceValidatorResult } from "./index";

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function hasNonEmptyStringArray(value: unknown): boolean {
  return Array.isArray(value) && value.some((item) => hasText(item));
}

function getDeprecationReason(resource: GovernanceResource): string | null {
  if (hasText(resource.deprecationReason)) {
    return resource.deprecationReason as string;
  }

  if (isObject(resource.deprecated) && hasText(resource.deprecated.reason)) {
    return resource.deprecated.reason as string;
  }

  return null;
}

function hasReplacementOrMigration(resource: GovernanceResource): boolean {
  if (hasNonEmptyStringArray(resource.replacementResourceIds)) {
    return true;
  }

  if (hasNonEmptyStringArray(resource.migrationIds)) {
    return true;
  }

  if (isObject(resource.deprecated)) {
    if (Array.isArray(resource.deprecated.replacement) && resource.deprecated.replacement.length > 0) {
      return true;
    }

    if (hasNonEmptyStringArray(resource.deprecated.migrationIds)) {
      return true;
    }
  }

  return false;
}

export function validateLifecycle(resources: GovernanceResource[]): GovernanceValidatorResult {
  const errors: GovernanceIssue[] = [];
  const warnings: GovernanceIssue[] = [];

  for (let index = 0; index < resources.length; index += 1) {
    const resource = resources[index];
    const lifecycleState = hasText(resource.lifecycleState)
      ? (resource.lifecycleState as string)
      : null;

    const deprecated = resource.deprecated === true || lifecycleState === "deprecated";
    const removed = lifecycleState === "removed";

    if (deprecated) {
      const basePath = `resources[${index}]`;
      const reason = getDeprecationReason(resource);
      if (!reason) {
        errors.push({
          code: "APS_GOV_DEPRECATION_REASON_REQUIRED",
          path: `${basePath}.deprecationReason`,
          message: "Deprecated resources must declare deprecationReason"
        });
      }

      if (!hasReplacementOrMigration(resource)) {
        errors.push({
          code: "APS_GOV_DEPRECATION_SUCCESSOR_REQUIRED",
          path: basePath,
          message: "Deprecated resources must define replacementResourceIds or migrationIds"
        });
      }
    }

    if (removed) {
      const basePath = `resources[${index}]`;
      if (!hasReplacementOrMigration(resource) && !getDeprecationReason(resource)) {
        errors.push({
          code: "APS_GOV_REMOVED_HISTORY_REQUIRED",
          path: basePath,
          message: "Removed resources must preserve historical references (replacement/migration/reason)"
        });
      }

      if (!hasText(resource.id)) {
        warnings.push({
          code: "APS_GOV_REMOVED_ID_RECOMMENDED",
          path: `${basePath}.id`,
          message: "Removed resources should keep stable id for historical traceability"
        });
      }
    }
  }

  return {
    errors,
    warnings,
    counters: {
      governedFields: 0,
      fieldsWithEvidence: 0,
      fieldsWithProvenance: 0
    }
  };
}
