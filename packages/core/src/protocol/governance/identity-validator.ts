import { isObject } from "../../shared/json";
import type { GovernanceIssue, GovernanceResource, GovernanceValidatorResult } from "./index";

const RESOURCE_ID_PATTERN = /^[a-z0-9]+(?:\.[a-z0-9]+){3,}$/;

function getRetiredIds(manifest: Record<string, unknown>): Set<string> {
  const metadata = manifest.metadata;
  if (!isObject(metadata)) {
    return new Set();
  }

  const governance = metadata.governance;
  if (!isObject(governance) || !Array.isArray(governance.retiredResourceIds)) {
    return new Set();
  }

  return new Set(
    governance.retiredResourceIds.filter(
      (item): item is string => typeof item === "string" && item.trim() !== ""
    )
  );
}

export function validateIdentity(
  resources: GovernanceResource[],
  manifest: Record<string, unknown>
): GovernanceValidatorResult {
  const errors: GovernanceIssue[] = [];
  const warnings: GovernanceIssue[] = [];

  const seenIds = new Map<string, number>();
  const retiredIds = getRetiredIds(manifest);

  for (let index = 0; index < resources.length; index += 1) {
    const resource = resources[index];
    const basePath = `resources[${index}].id`;

    if (typeof resource.id !== "string" || resource.id.trim() === "") {
      warnings.push({
        code: "APS_GOV_RESOURCE_ID_RECOMMENDED",
        path: basePath,
        message: "Resource id is strongly recommended for governance"
      });
      continue;
    }

    const id = resource.id.trim();
    if (!RESOURCE_ID_PATTERN.test(id)) {
      errors.push({
        code: "APS_GOV_INVALID_RESOURCE_ID_FORMAT",
        path: basePath,
        message: "Resource id must match org.domain.resourceType.resourceName in lowercase"
      });
      continue;
    }

    const segments = id.split(".");
    if (segments.length >= 3 && typeof resource.type === "string" && segments[2] !== resource.type) {
      warnings.push({
        code: "APS_GOV_RESOURCE_ID_TYPE_MISMATCH",
        path: basePath,
        message: `Resource id type segment '${segments[2]}' does not match resource.type '${resource.type}'`
      });
    }

    if (seenIds.has(id)) {
      const firstIndex = seenIds.get(id) ?? 0;
      errors.push({
        code: "APS_GOV_DUPLICATE_RESOURCE_ID",
        path: basePath,
        message: `Duplicate resource id also found at resources[${firstIndex}]`
      });
    } else {
      seenIds.set(id, index);
    }

    if (retiredIds.has(id)) {
      errors.push({
        code: "APS_GOV_RECYCLED_RESOURCE_ID",
        path: basePath,
        message: "Resource id is recycled from retiredResourceIds"
      });
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
