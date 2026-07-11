import type { ApsResourceReference, ApsRuleBinding } from "./common";
import type { ApsResource } from "./resource";

export interface ApsServiceResource extends ApsResource {
  type: "service";
  name: string;
  responsibilities?: string[];
  dependencies?: ApsResourceReference[];
  endpoints?: ApsResourceReference[];
  operations?: string[];
  sla?: Record<string, unknown>;
  rules?: ApsRuleBinding[];
  examples?: ApsResourceReference[];
  [key: string]: unknown;
}
