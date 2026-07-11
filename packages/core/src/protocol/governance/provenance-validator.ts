import { isObject } from "../../shared/json";
import type {
  GovernanceEvidence,
  GovernanceIssue,
  GovernanceResource,
  GovernanceValidatorResult,
  KnowledgeAuthority,
  KnowledgeConfidence,
  KnowledgeSourceType
} from "./index";

const VALID_SOURCE_TYPES: Set<KnowledgeSourceType> = new Set([
  "typescript",
  "storybook",
  "readme",
  "human",
  "static-analysis",
  "architecture-policy",
  "external"
]);

const VALID_CONFIDENCE: Set<KnowledgeConfidence> = new Set(["low", "medium", "high"]);
const VALID_AUTHORITY: Set<KnowledgeAuthority> = new Set(["advisory", "required", "policy"]);

function getGovernance(resource: GovernanceResource): Record<string, unknown> {
  if (!isObject(resource.metadata)) {
    return {};
  }

  const governance = resource.metadata.governance;
  return isObject(governance) ? governance : {};
}

function getGovernedFields(resource: GovernanceResource): Array<[string, Record<string, unknown>]> {
  const governance = getGovernance(resource);
  const fields = governance.fields;

  if (!isObject(fields)) {
    return [];
  }

  const governedFields: Array<[string, Record<string, unknown>]> = [];
  for (const [fieldName, fieldValue] of Object.entries(fields)) {
    if (isObject(fieldValue)) {
      governedFields.push([fieldName, fieldValue]);
    }
  }

  return governedFields;
}

function readEvidence(fieldConfig: Record<string, unknown>): GovernanceEvidence[] {
  if (!Array.isArray(fieldConfig.evidence)) {
    return [];
  }

  return fieldConfig.evidence.filter((item): item is GovernanceEvidence => isObject(item));
}

function validateEvidenceShape(
  evidence: GovernanceEvidence,
  path: string,
  errors: GovernanceIssue[],
  warnings: GovernanceIssue[]
): boolean {
  let valid = true;

  if (typeof evidence.sourceType !== "string" || !VALID_SOURCE_TYPES.has(evidence.sourceType)) {
    errors.push({
      code: "APS_GOV_INVALID_SOURCE_TYPE",
      path,
      message: "Evidence.sourceType is required and must be a valid source type"
    });
    valid = false;
  }

  if (typeof evidence.sourceRef !== "string" || evidence.sourceRef.trim() === "") {
    errors.push({
      code: "APS_GOV_INVALID_SOURCE_REF",
      path,
      message: "Evidence.sourceRef is required and must be a non-empty string"
    });
    valid = false;
  }

  if (typeof evidence.extractedAt !== "string" || Number.isNaN(Date.parse(evidence.extractedAt))) {
    errors.push({
      code: "APS_GOV_INVALID_EXTRACTED_AT",
      path,
      message: "Evidence.extractedAt is required and must be an ISO date string"
    });
    valid = false;
  }

  if (typeof evidence.confidence !== "string" || !VALID_CONFIDENCE.has(evidence.confidence)) {
    errors.push({
      code: "APS_GOV_INVALID_CONFIDENCE",
      path,
      message: "Evidence.confidence is required and must be low|medium|high"
    });
    valid = false;
  }

  if (typeof evidence.authority !== "string" || !VALID_AUTHORITY.has(evidence.authority)) {
    errors.push({
      code: "APS_GOV_INVALID_AUTHORITY",
      path,
      message: "Evidence.authority is required and must be advisory|required|policy"
    });
    valid = false;
  }

  if (evidence.authority === "policy") {
    if (evidence.sourceType !== "architecture-policy" && evidence.sourceType !== "human") {
      errors.push({
        code: "APS_GOV_POLICY_SOURCE_INVALID",
        path,
        message: "Policy evidence must come from architecture-policy or human sources"
      });
      valid = false;
    }

    if (!isObject(evidence.applicability)) {
      errors.push({
        code: "APS_GOV_POLICY_APPLICABILITY_REQUIRED",
        path,
        message: "Policy evidence requires applicability context"
      });
      valid = false;
    }
  }

  if (evidence.authority === "required") {
    if (typeof evidence.scope !== "string" || evidence.scope.trim() === "") {
      errors.push({
        code: "APS_GOV_REQUIRED_SCOPE_MISSING",
        path,
        message: "Required evidence must define scope"
      });
      valid = false;
    }
  }

  if (evidence.authority === "advisory" && evidence.confidence === "low") {
    warnings.push({
      code: "APS_GOV_LOW_CONFIDENCE_ADVISORY",
      path,
      message: "Advisory evidence with low confidence is acceptable but weak"
    });
  }

  return valid;
}

export function validateProvenance(resources: GovernanceResource[]): GovernanceValidatorResult {
  const errors: GovernanceIssue[] = [];
  const warnings: GovernanceIssue[] = [];

  let governedFields = 0;
  let fieldsWithEvidence = 0;
  let fieldsWithProvenance = 0;

  for (let index = 0; index < resources.length; index += 1) {
    const resource = resources[index];
    const fields = getGovernedFields(resource);

    for (const [fieldName, fieldConfig] of fields) {
      governedFields += 1;
      const basePath = `resources[${index}].metadata.governance.fields.${fieldName}`;
      const evidenceList = readEvidence(fieldConfig);
      const fieldAuthority = typeof fieldConfig.authority === "string" ? fieldConfig.authority : "advisory";

      if (evidenceList.length > 0) {
        fieldsWithEvidence += 1;
      }

      if ((fieldAuthority === "policy" || fieldAuthority === "required") && evidenceList.length === 0) {
        errors.push({
          code: "APS_GOV_EVIDENCE_REQUIRED",
          path: basePath,
          message: `Field authority '${fieldAuthority}' requires evidence`
        });
      }

      let hasValidProvenance = false;
      for (let evidenceIndex = 0; evidenceIndex < evidenceList.length; evidenceIndex += 1) {
        const evidence = evidenceList[evidenceIndex];
        const evidencePath = `${basePath}.evidence[${evidenceIndex}]`;
        const valid = validateEvidenceShape(evidence, evidencePath, errors, warnings);
        if (valid) {
          hasValidProvenance = true;
        }
      }

      if (hasValidProvenance) {
        fieldsWithProvenance += 1;
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
