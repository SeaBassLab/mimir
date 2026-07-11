import type { ApsApiResource } from "./api-resource";
import type { ApsComponentResource } from "./component-resource";
import type { ApsEventResource } from "./event-resource";
import type { ApsExampleResource } from "./example-resource";
import type { ApsMigrationResource } from "./migration-resource";
import type { ApsModelResource } from "./model-resource";
import type { ApsPatternResource } from "./pattern-resource";
import type { ApsResource } from "./resource";
import type { ApsRuleResource } from "./rule-resource";
import type { ApsServiceResource } from "./service-resource";

export type ApsSchemaVersion = 1 | 2;

export type ApsLegacyResourceEntry<T> = T | string | Record<string, unknown>;

export interface ApsManifest {
  version: number;
  schemaVersion?: ApsSchemaVersion;
  resources?: ApsResource[];
  components?: ApsLegacyResourceEntry<ApsComponentResource>[];
  apis?: ApsLegacyResourceEntry<ApsApiResource>[];
  services?: ApsLegacyResourceEntry<ApsServiceResource>[];
  models?: ApsLegacyResourceEntry<ApsModelResource>[];
  events?: ApsLegacyResourceEntry<ApsEventResource>[];
  rules?: ApsLegacyResourceEntry<ApsRuleResource>[];
  examples?: ApsLegacyResourceEntry<ApsExampleResource>[];
  patterns?: ApsLegacyResourceEntry<ApsPatternResource>[];
  migrations?: ApsLegacyResourceEntry<ApsMigrationResource>[];
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}
