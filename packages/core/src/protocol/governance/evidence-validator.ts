import { isObject } from "../../shared/json";
import type {
  GovernanceConflict,
  GovernanceIssue,
  GovernanceResource,
  GovernanceValidatorResult
} from "./index";

function getGovernance(resource: GovernanceResource): Record<string, unknown> {
  if (!isObject(resource.metadata)) {
    return {};
  }

  const governance = resource.metadata.governance;
  return isObject(governance) ? governance : {};
}

function getConflicts(resource: GovernanceResource): GovernanceConflict[] {
  const governance = getGovernance(resource);
  if (!Array.isArray(governance.conflicts)) {
    return [];
  }

  return governance.conflicts.filter((item): item is GovernanceConflict => isObject(item));
}

export function validateEvidence(resources: GovernanceResource[]): GovernanceValidatorResult {
  const errors: GovernanceIssue[] = [];
  const warnings: GovernanceIssue[] = [];

  let governedFields = 0;
  let fieldsWithEvidence = 0;
  let fieldsWithProvenance = 0;

  for (let index = 0; index < resources.length; index += 1) {
    const resource = resources[index];
    const governance = getGovernance(resource);
    const conflicts = getConflicts(resource);
    const knownConflictIds = new Set(
      conflicts
        .map((item) => (typeof item.id === "string" ? item.id : null))
        .filter((item): item is string => Boolean(item))
    );

    if (!isObject(governance.fields)) {
      continue;
    }

    for (const [fieldName, fieldConfig] of Object.entries(governance.fields)) {
      if (!isObject(fieldConfig)) {
        continue;
      }

      governedFields += 1;
      const basePath = `resources[${index}].metadata.governance.fields.${fieldName}`;

      const evidence = Array.isArray(fieldConfig.evidence)
        ? fieldConfig.evidence.filter((item): item is Record<string, unknown> => isObject(item))
        : [];

      if (evidence.length > 0) {
        fieldsWithEvidence += 1;
      } else {
        errors.push({
          code: "APS_GOV_TRACEABLE_EVIDENCE_REQUIRED",
          path: basePath,
          message: "Every governed field must define traceable evidence"
        });
      }

      const evidenceIds = new Set(
        evidence
          .map((item) => (typeof item.evidenceId === "string" ? item.evidenceId : null))
          .filter((item): item is string => Boolean(item))
      );

      const selectedEvidenceId =
        typeof fieldConfig.selectedEvidenceId === "string" ? fieldConfig.selectedEvidenceId : null;

      if (selectedEvidenceId) {
        if (evidenceIds.size === 0 || !evidenceIds.has(selectedEvidenceId)) {
          errors.push({
            code: "APS_GOV_SELECTED_EVIDENCE_NOT_FOUND",
            path: `${basePath}.selectedEvidenceId`,
            message: "selectedEvidenceId must reference an existing evidence entry"
          });
        } else {
          fieldsWithProvenance += 1;
        }
      }

      const conflictId = typeof fieldConfig.conflictId === "string" ? fieldConfig.conflictId : null;
      if (conflictId && !knownConflictIds.has(conflictId)) {
        errors.push({
          code: "APS_GOV_CONFLICT_REFERENCE_MISSING",
          path: `${basePath}.conflictId`,
          message: "conflictId must reference an existing governance conflict"
        });
      }

      if (!conflictId && evidence.length > 1) {
        warnings.push({
          code: "APS_GOV_MULTIPLE_EVIDENCE_NO_CONFLICT",
          path: basePath,
          message: "Multiple evidence entries found without explicit conflict linkage"
        });
      }
    }
  }

  return {
    errors,
    warnings,
    counters: {
      governedFields,
      fieldsWithEvidence,
      fieldsWithProvenance
    }
  };
}
