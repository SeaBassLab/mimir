import { isObject } from "../../shared/json";
import type { GovernanceIssue, GovernanceResource, GovernanceValidatorResult } from "./index";

function getGovernance(resource: GovernanceResource): Record<string, unknown> {
  if (!isObject(resource.metadata)) {
    return {};
  }

  const governance = resource.metadata.governance;
  return isObject(governance) ? governance : {};
}

function hasApplicabilityContext(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  const keys = ["framework", "language", "runtime", "platform", "layer", "boundedContext"];
  return keys.some((key) => {
    const item = value[key];
    return (
      typeof item === "string" ||
      (Array.isArray(item) && item.some((entry) => typeof entry === "string" && entry.trim() !== ""))
    );
  });
}

function readAuthority(resource: GovernanceResource): string {
  const governance = getGovernance(resource);
  return typeof governance.authority === "string" ? governance.authority : "advisory";
}

function looksReactSpecific(resource: GovernanceResource): boolean {
  const text = [resource.name, resource.id, resource.description]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();

  return text.includes("react") || text.includes("jsx") || text.includes("tsx");
}

function looksBackendSpecific(resource: GovernanceResource): boolean {
  const text = [resource.name, resource.id, resource.description]
    .filter((item): item is string => typeof item === "string")
    .join(" ")
    .toLowerCase();

  return (
    text.includes("backend") ||
    text.includes("api") ||
    text.includes("service") ||
    text.includes("node")
  );
}

export function validateApplicability(resources: GovernanceResource[]): GovernanceValidatorResult {
  const errors: GovernanceIssue[] = [];
  const warnings: GovernanceIssue[] = [];

  for (let index = 0; index < resources.length; index += 1) {
    const resource = resources[index];
    if (resource.type !== "rule" && resource.type !== "pattern") {
      continue;
    }

    const governance = getGovernance(resource);
    const authority = readAuthority(resource);
    const strongAuthority = authority === "policy" || authority === "required";
    const applicability = governance.applicability;
    const hasContext = hasApplicabilityContext(applicability);

    if (!strongAuthority) {
      continue;
    }

    const basePath = `resources[${index}].metadata.governance.applicability`;

    if (!hasContext) {
      if (authority === "policy" && looksBackendSpecific(resource)) {
        errors.push({
          code: "APS_GOV_BACKEND_POLICY_GLOBAL",
          path: basePath,
          message: "Backend policy cannot be global; applicability context is required"
        });
      } else if (looksReactSpecific(resource)) {
        warnings.push({
          code: "APS_GOV_REACT_RULE_MISSING_CONTEXT",
          path: basePath,
          message: "React-oriented rule should define framework applicability"
        });
      } else {
        warnings.push({
          code: "APS_GOV_STRONG_AUTHORITY_CONTEXT_RECOMMENDED",
          path: basePath,
          message: "Rules and patterns with strong authority should define applicability context"
        });
      }
      continue;
    }

    if (authority === "policy" && isObject(applicability)) {
      const layer = applicability.layer;
      if (
        (layer === undefined || layer === "") &&
        applicability.framework === undefined &&
        applicability.runtime === undefined
      ) {
        errors.push({
          code: "APS_GOV_POLICY_CONTEXT_TOO_GENERIC",
          path: basePath,
          message: "Policy applicability is too generic; define at least layer/framework/runtime"
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
