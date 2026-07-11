import type {
  ApsDeprecation,
  ApsResourceReference,
  ApsRuleBinding,
  ApsVersionConstraint
} from "./common";

export type ApsResourceType =
  | "component"
  | "api"
  | "service"
  | "model"
  | "event"
  | "pattern"
  | "rule"
  | "migration"
  | "example";

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
