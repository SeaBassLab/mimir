import type {
  ApsDeprecation,
  ApsInlineExample,
  ApsResourceReference,
  ApsRuleBinding,
  ApsVersionConstraint
} from "./common";
import type { ApsResource } from "./resource";

export interface ApsComponentProp {
  name: string;
  type?: string;
  required?: boolean;
  default?: unknown;
  description?: string;
  values?: unknown[];
  [key: string]: unknown;
}

export interface ApsComponentVariant {
  name: string;
  description?: string;
  conditions?: string[];
  [key: string]: unknown;
}

export interface ApsComponentState {
  name: string;
  description?: string;
  transitions?: string[];
  [key: string]: unknown;
}

export interface ApsComponentResource extends ApsResource {
  type: "component";
  name: string;
  package?: string;
  import?: string;
  importLocation?: string;
  category?: string;
  intendedUsage?: string | string[];
  whenToUse?: string[];
  whenNotToUse?: string[];
  alternatives?: ApsResourceReference[];
  relatedResources?: ApsResourceReference[];
  props?: ApsComponentProp[];
  variants?: ApsComponentVariant[];
  states?: ApsComponentState[];
  rules?: ApsRuleBinding[];
  examples?: ApsResourceReference[];
  antiExamples?: ApsInlineExample[];
  deprecated?: boolean | ApsDeprecation;
  migrations?: string[];
  versionConstraints?: ApsVersionConstraint;
  aliases?: string[];
  tags?: string[];
  [key: string]: unknown;
}
