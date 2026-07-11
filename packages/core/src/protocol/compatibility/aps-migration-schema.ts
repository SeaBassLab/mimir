import { isObject } from "../../shared/json";
import type { ValidationIssue } from "./index";

export type ApsMigration = {
  name: string;
  fromVersion?: number;
  toVersion?: number;
  description?: string;
};

export type ResourceValidationResult<T> = {
  valid: boolean;
  value?: T;
  errors: ValidationIssue[];
  warnings: string[];
};

export function validateApsMigration(value: unknown, path: string): ResourceValidationResult<ApsMigration> {
  const errors: ValidationIssue[] = [];
  const warnings: string[] = [];

  if (!isObject(value)) {
    return {
      valid: false,
      errors: [
        {
          code: "APS_INVALID_MIGRATION",
          path,
          message: "Migration must be an object"
        }
      ],
      warnings
    };
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    errors.push({
      code: "APS_INVALID_MIGRATION",
      path,
      message: "Migration.name is required and must be a non-empty string"
    });
  }

  if (value.fromVersion !== undefined && typeof value.fromVersion !== "number") {
    errors.push({
      code: "APS_INVALID_MIGRATION_FROM_VERSION",
      path,
      message: "Migration.fromVersion must be a number"
    });
  }

  if (value.toVersion !== undefined && typeof value.toVersion !== "number") {
    errors.push({
      code: "APS_INVALID_MIGRATION_TO_VERSION",
      path,
      message: "Migration.toVersion must be a number"
    });
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    errors.push({
      code: "APS_INVALID_MIGRATION_DESCRIPTION",
      path,
      message: "Migration.description must be a string"
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const name = value.name;

  return {
    valid: true,
    value: {
      name: typeof name === "string" ? name : "",
      fromVersion: typeof value.fromVersion === "number" ? value.fromVersion : undefined,
      toVersion: typeof value.toVersion === "number" ? value.toVersion : undefined,
      description: typeof value.description === "string" ? value.description : undefined
    },
    errors,
    warnings
  };
}
