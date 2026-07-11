import { isObject } from "../../shared/json";
import type { ApsManifest, ApsResourceType } from "../manifest";
import { validateApplicability } from "./applicability-validator";
import { validateConflicts } from "./conflict-validator";
import { validateEvidence } from "./evidence-validator";
import { validateIdentity } from "./identity-validator";
import { validateLifecycle } from "./lifecycle-validator";
import { validateProvenance } from "./provenance-validator";

export type KnowledgeSourceType =
  | "typescript"
  | "storybook"
  | "readme"
  | "human"
  | "static-analysis"
  | "architecture-policy"
  | "external";

export type KnowledgeConfidence = "low" | "medium" | "high";

export type KnowledgeAuthority = "advisory" | "required" | "policy";

export type GovernanceApplicability = {
  framework?: string | string[];
  language?: string | string[];
  runtime?: string | string[];
  platform?: string | string[];
  layer?: string | string[];
  boundedContext?: string | string[];
  [key: string]: unknown;
};

export type GovernanceEvidence = {
  evidenceId?: string;
  sourceType: KnowledgeSourceType;
  sourceRef: string;
  extractedAt: string;
  confidence: KnowledgeConfidence;
  authority: KnowledgeAuthority;
  scope?: string;
  sourceVersion?: string;
  freshnessTtlDays?: number;
  applicability?: GovernanceApplicability;
  extractor?: string;
  [key: string]: unknown;
};

export type GovernanceConflict = {
  id?: string;
  fieldPath?: string;
  candidates?: Array<Record<string, unknown>>;
  selectedCandidateId?: string;
  rejectedCandidateIds?: string[];
  explanation?: string;
  [key: string]: unknown;
};

export type GovernanceResource = {
  type?: ApsResourceType | string;
  id?: string;
  name?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  deprecated?: unknown;
  deprecationReason?: unknown;
  replacementResourceIds?: unknown;
  migrationIds?: unknown;
  lifecycleState?: unknown;
  [key: string]: unknown;
};

export type GovernanceIssue = {
  code: string;
  path: string;
  message: string;
};

export type GovernanceCounters = {
  governedFields: number;
  fieldsWithEvidence: number;
  fieldsWithProvenance: number;
};

export type GovernanceValidatorResult = {
  errors: GovernanceIssue[];
  warnings: GovernanceIssue[];
  counters: GovernanceCounters;
};

export type GovernanceValidationResult = {
  valid: boolean;
  errors: GovernanceIssue[];
  warnings: GovernanceIssue[];
  metrics: {
    resourcesChecked: number;
    evidenceCoverage: number;
    provenanceCoverage: number;
  };
};

const LEGACY_SECTION_TYPES: Array<{ key: string; type: ApsResourceType }> = [
  { key: "components", type: "component" },
  { key: "apis", type: "api" },
  { key: "services", type: "service" },
  { key: "models", type: "model" },
  { key: "events", type: "event" },
  { key: "patterns", type: "pattern" },
  { key: "rules", type: "rule" },
  { key: "migrations", type: "migration" },
  { key: "examples", type: "example" }
];

function toPercentage(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

function normalizeResourceEntry(
  entry: unknown,
  fallbackType: ApsResourceType,
  warnings: GovernanceIssue[],
  path: string
): GovernanceResource | null {
  if (typeof entry === "string") {
    return {
      type: fallbackType,
      name: entry
    };
  }

  if (!isObject(entry)) {
    warnings.push({
      code: "APS_GOV_RESOURCE_ENTRY_SKIPPED",
      path,
      message: "Resource entry is not an object or string and was skipped"
    });
    return null;
  }

  return {
    ...entry,
    type: typeof entry.type === "string" ? entry.type : fallbackType
  };
}

export function collectGovernanceResources(manifest: ApsManifest): {
  resources: GovernanceResource[];
  warnings: GovernanceIssue[];
} {
  const resources: GovernanceResource[] = [];
  const warnings: GovernanceIssue[] = [];

  if (Array.isArray(manifest.resources)) {
    for (let index = 0; index < manifest.resources.length; index += 1) {
      const entry = manifest.resources[index];
      if (isObject(entry)) {
        resources.push(entry as GovernanceResource);
      } else {
        warnings.push({
          code: "APS_GOV_RESOURCE_ENTRY_SKIPPED",
          path: `manifest.resources[${index}]`,
          message: "resources entry is not an object and was skipped"
        });
      }
    }
  }

  for (const section of LEGACY_SECTION_TYPES) {
    const value = manifest[section.key];
    if (!Array.isArray(value)) {
      continue;
    }

    for (let index = 0; index < value.length; index += 1) {
      const normalized = normalizeResourceEntry(
        value[index],
        section.type,
        warnings,
        `manifest.${section.key}[${index}]`
      );

      if (normalized) {
        resources.push(normalized);
      }
    }
  }

  return { resources, warnings };
}

function mergeValidatorResults(results: GovernanceValidatorResult[]): GovernanceValidatorResult {
  return {
    errors: results.flatMap((result) => result.errors),
    warnings: results.flatMap((result) => result.warnings),
    counters: {
      governedFields: results.reduce((acc, result) => acc + result.counters.governedFields, 0),
      fieldsWithEvidence: results.reduce((acc, result) => acc + result.counters.fieldsWithEvidence, 0),
      fieldsWithProvenance: results.reduce((acc, result) => acc + result.counters.fieldsWithProvenance, 0)
    }
  };
}

export function validateGovernance(manifest: ApsManifest): GovernanceValidationResult {
  const collected = collectGovernanceResources(manifest);

  const validators = [
    validateProvenance(collected.resources),
    validateEvidence(collected.resources),
    validateLifecycle(collected.resources),
    validateApplicability(collected.resources),
    validateIdentity(collected.resources, manifest as Record<string, unknown>),
    validateConflicts(collected.resources)
  ];

  const merged = mergeValidatorResults(validators);
  const allWarnings = [...collected.warnings, ...merged.warnings];

  return {
    valid: merged.errors.length === 0,
    errors: merged.errors,
    warnings: allWarnings,
    metrics: {
      resourcesChecked: collected.resources.length,
      evidenceCoverage: toPercentage(
        merged.counters.fieldsWithEvidence,
        merged.counters.governedFields
      ),
      provenanceCoverage: toPercentage(
        merged.counters.fieldsWithProvenance,
        merged.counters.governedFields
      )
    }
  };
}
