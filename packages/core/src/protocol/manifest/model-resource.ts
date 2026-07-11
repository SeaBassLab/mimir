import type { ApsResourceReference, ApsRuleBinding } from "./common";
import type { ApsResource } from "./resource";

export interface ApsModelField {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  constraints?: string[];
  [key: string]: unknown;
}

export interface ApsModelResource extends ApsResource {
  type: "model";
  name: string;
  schema?: Record<string, unknown>;
  fields?: ApsModelField[];
  invariants?: string[];
  relatedResources?: ApsResourceReference[];
  rules?: ApsRuleBinding[];
  examples?: ApsResourceReference[];
  [key: string]: unknown;
}
