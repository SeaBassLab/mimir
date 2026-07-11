import type { ApsResourceReference, ApsRuleBinding } from "./common";
import type { ApsResource } from "./resource";

export interface ApsApiParameter {
  name: string;
  location?: "path" | "query" | "header" | "cookie" | "body" | string;
  type?: string;
  required?: boolean;
  description?: string;
  [key: string]: unknown;
}

export interface ApsApiResource extends ApsResource {
  type: "api";
  name: string;
  protocol?: "http" | "grpc" | "graphql" | "websocket" | string;
  method?: string;
  path?: string;
  operationId?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  parameters?: ApsApiParameter[];
  errors?: Array<Record<string, unknown>>;
  rules?: ApsRuleBinding[];
  examples?: ApsResourceReference[];
  [key: string]: unknown;
}
