import type { ApsResourceReference } from "./common";
import type { ApsResource } from "./resource";

export interface ApsMigrationStep {
  order?: number;
  title: string;
  description?: string;
  codeMod?: string;
  [key: string]: unknown;
}

export interface ApsMigrationResource extends ApsResource {
  type: "migration";
  id?: string;
  name?: string;
  from: string;
  to: string;
  reason?: string;
  steps?: ApsMigrationStep[];
  automatedHints?: string[];
  impacts?: string[];
  relatedResources?: ApsResourceReference[];
  [key: string]: unknown;
}
