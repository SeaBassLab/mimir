import type { ApsInlineExample, ApsResourceReference, ApsScope, ApsSeverity } from "./common";
import type { ApsResource } from "./resource";

export interface ApsRuleTarget {
  resourceType?: string;
  resourceIds?: string[];
  resourceNames?: string[];
  patterns?: string[];
  [key: string]: unknown;
}

export interface ApsRuleResource extends ApsResource {
  type: "rule";
  id?: string;
  name?: string;
  description: string;
  severity?: ApsSeverity;
  scope?: ApsScope;
  appliesTo?: ApsRuleTarget[];
  rationale?: string;
  examples?: ApsInlineExample[];
  antiExamples?: ApsInlineExample[];
  enforceable?: boolean;
  expression?: string;
  message?: string;
  relatedResources?: ApsResourceReference[];
  tags?: string[];
  [key: string]: unknown;
}
