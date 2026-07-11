import { isObject } from "../../shared/json";
import type {
  GovernanceConflict,
  GovernanceIssue,
  GovernanceResource,
  GovernanceValidatorResult
} from "./index";

function getConflicts(resource: GovernanceResource): GovernanceConflict[] {
  if (!isObject(resource.metadata)) {
    return [];
  }

  const governance = resource.metadata.governance;
  if (!isObject(governance) || !Array.isArray(governance.conflicts)) {
    return [];
  }

  return governance.conflicts.filter((item): item is GovernanceConflict => isObject(item));
}

function readCandidateIds(conflict: GovernanceConflict): string[] {
  if (!Array.isArray(conflict.candidates)) {
    return [];
  }

  return conflict.candidates
    .map((candidate) => (isObject(candidate) && typeof candidate.id === "string" ? candidate.id : null))
    .filter((item): item is string => Boolean(item));
}

export function validateConflicts(resources: GovernanceResource[]): GovernanceValidatorResult {
  const errors: GovernanceIssue[] = [];
  const warnings: GovernanceIssue[] = [];

  for (let index = 0; index < resources.length; index += 1) {
    const conflicts = getConflicts(resources[index]);

    for (let conflictIndex = 0; conflictIndex < conflicts.length; conflictIndex += 1) {
      const conflict = conflicts[conflictIndex];
      const basePath = `resources[${index}].metadata.governance.conflicts[${conflictIndex}]`;

      if (typeof conflict.id !== "string" || conflict.id.trim() === "") {
        errors.push({
          code: "APS_GOV_CONFLICT_ID_REQUIRED",
          path: `${basePath}.id`,
          message: "Conflict id is required"
        });
      }

      if (typeof conflict.fieldPath !== "string" || conflict.fieldPath.trim() === "") {
        errors.push({
          code: "APS_GOV_CONFLICT_FIELD_PATH_REQUIRED",
          path: `${basePath}.fieldPath`,
          message: "Conflict fieldPath is required"
        });
      }

      const candidateIds = readCandidateIds(conflict);
      if (candidateIds.length < 2) {
        errors.push({
          code: "APS_GOV_CONFLICT_CANDIDATES_INSUFFICIENT",
          path: `${basePath}.candidates`,
          message: "Conflict must contain at least two candidates"
        });
      }

      if (typeof conflict.selectedCandidateId !== "string" || conflict.selectedCandidateId.trim() === "") {
        errors.push({
          code: "APS_GOV_CONFLICT_SELECTED_MISSING",
          path: `${basePath}.selectedCandidateId`,
          message: "Conflict must define selectedCandidateId"
        });
      } else if (!candidateIds.includes(conflict.selectedCandidateId)) {
        errors.push({
          code: "APS_GOV_CONFLICT_SELECTED_NOT_FOUND",
          path: `${basePath}.selectedCandidateId`,
          message: "selectedCandidateId must reference an existing candidate"
        });
      }

      if (!Array.isArray(conflict.rejectedCandidateIds) || conflict.rejectedCandidateIds.length === 0) {
        errors.push({
          code: "APS_GOV_CONFLICT_REJECTED_MISSING",
          path: `${basePath}.rejectedCandidateIds`,
          message: "Conflict must define rejectedCandidateIds"
        });
      } else {
        for (const rejected of conflict.rejectedCandidateIds) {
          if (typeof rejected !== "string" || !candidateIds.includes(rejected)) {
            errors.push({
              code: "APS_GOV_CONFLICT_REJECTED_NOT_FOUND",
              path: `${basePath}.rejectedCandidateIds`,
              message: "All rejectedCandidateIds must reference existing candidates"
            });
            break;
          }

          if (rejected === conflict.selectedCandidateId) {
            errors.push({
              code: "APS_GOV_CONFLICT_SELECTED_REJECTED_COLLISION",
              path: `${basePath}.rejectedCandidateIds`,
              message: "selectedCandidateId cannot appear in rejectedCandidateIds"
            });
            break;
          }
        }
      }

      if (typeof conflict.explanation !== "string" || conflict.explanation.trim() === "") {
        errors.push({
          code: "APS_GOV_CONFLICT_EXPLANATION_REQUIRED",
          path: `${basePath}.explanation`,
          message: "Conflict resolution requires explanation"
        });
      }

      const rejectedCandidateIds = Array.isArray(conflict.rejectedCandidateIds)
        ? conflict.rejectedCandidateIds
        : [];

      if (
        rejectedCandidateIds.length > 0 &&
        typeof conflict.selectedCandidateId === "string" &&
        candidateIds.length > 0
      ) {
        const unresolved = candidateIds.filter(
          (candidateId) =>
            candidateId !== conflict.selectedCandidateId &&
            !rejectedCandidateIds.includes(candidateId)
        );

        if (unresolved.length > 0) {
          warnings.push({
            code: "APS_GOV_CONFLICT_UNRESOLVED_CANDIDATES",
            path: basePath,
            message: `Conflict has candidates without explicit disposition: ${unresolved.join(", " )}`
          });
        }
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
