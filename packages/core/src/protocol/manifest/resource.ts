import type {
  ApsDeprecation,
  ApsResourceReference,
  ApsRuleBinding,
  ApsVersionConstraint
} from "./common";

export const APS_RESOURCE_TYPES = [
  "component", "api", "service", "model", "event", "pattern", "rule", "migration", "example",
  "function", "hook", "context", "provider", "template", "icon", "page", "utility", "theme",
  "token", "configuration", "story", "internal", "unknown"
] as const;

export type ApsResourceType = (typeof APS_RESOURCE_TYPES)[number];

export interface ApsResource {
  type: ApsResourceType;
  id?: string;
  name?: string;
  package?: string;
  import?: string;
  description?: string;
  category?: string;
  intendedUsage?: string | string[];
  whenToUse?: string[];
  whenNotToUse?: string[];
  alternatives?: ApsResourceReference[];
  relatedResources?: ApsResourceReference[];
  rules?: ApsRuleBinding[];
  examples?: ApsResourceReference[];
  antiExamples?: ApsResourceReference[];
  deprecated?: boolean | ApsDeprecation;
  versionConstraints?: ApsVersionConstraint;
  metadata?: Record<string, unknown>;
  tags?: string[];
  [key: string]: unknown;
}
