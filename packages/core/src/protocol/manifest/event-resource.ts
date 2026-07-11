import type { ApsResourceReference, ApsRuleBinding } from "./common";
import type { ApsResource } from "./resource";

export interface ApsEventResource extends ApsResource {
  type: "event";
  name: string;
  topic?: string;
  publisher?: string;
  consumers?: string[];
  payloadSchema?: Record<string, unknown>;
  deliverySemantics?: "at-most-once" | "at-least-once" | "exactly-once" | string;
  ordering?: "unordered" | "partitioned" | "global" | string;
  relatedResources?: ApsResourceReference[];
  rules?: ApsRuleBinding[];
  examples?: ApsResourceReference[];
  [key: string]: unknown;
}
