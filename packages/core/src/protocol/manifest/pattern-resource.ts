import type { ApsResourceReference, ApsRuleBinding } from "./common";
import type { ApsResource } from "./resource";

export interface ApsPatternResource extends ApsResource {
  type: "pattern";
  name: string;
  description?: string;
  whenToUse?: string[];
  resources?: ApsResourceReference[];
  examples?: ApsResourceReference[];
  rules?: ApsRuleBinding[];
  antiPatterns?: string[];
  tradeoffs?: string[];
  [key: string]: unknown;
}
