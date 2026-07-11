import { validateApsManifest, type ApsManifest } from "./aps-manifest-schema";

export type ValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type SchemaValidationResult<T> = {
  valid: boolean;
  value?: T;
  errors: ValidationIssue[];
  warnings: string[];
  validResources: string[];
};

export { validateApsManifest, type ApsManifest };
