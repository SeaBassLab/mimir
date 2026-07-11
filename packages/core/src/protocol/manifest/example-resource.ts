import type { ApsResourceReference, ApsStringMap } from "./common";
import type { ApsResource } from "./resource";

export interface ApsExampleResource extends ApsResource {
  type: "example";
  id?: string;
  title: string;
  description?: string;
  language?: string;
  imports?: string[];
  code: string;
  relatedResources?: ApsResourceReference[];
  explanation?: string;
  context?: Record<string, unknown>;
  files?: ApsStringMap;
  tags?: string[];
  [key: string]: unknown;
}
