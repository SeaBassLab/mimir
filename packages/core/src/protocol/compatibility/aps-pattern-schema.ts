import { isObject, toStringArray } from "../../shared/json";
import type { ValidationIssue } from "./index";

export type ApsPattern = {
  name: string;
  description?: string;
  tags?: string[];
  examples?: string[];
  rules?: string[];
};

export type ResourceValidationResult<T> = {
  valid: boolean;
  value?: T;
  errors: ValidationIssue[];
  warnings: string[];
};

export function validateApsPattern(value: unknown, path: string): ResourceValidationResult<ApsPattern> {
  const errors: ValidationIssue[] = [];
  const warnings: string[] = [];

  if (!isObject(value)) {
    return {
      valid: false,
      errors: [
        {
          code: "APS_INVALID_PATTERN",
          path,
          message: "Pattern must be an object"
        }
      ],
      warnings
    };
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    errors.push({
      code: "APS_INVALID_PATTERN",
      path,
      message: "Pattern.name is required and must be a non-empty string"
    });
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    errors.push({
      code: "APS_INVALID_PATTERN_DESCRIPTION",
      path,
      message: "Pattern.description must be a string"
    });
  }

  const tags = value.tags === undefined ? undefined : toStringArray(value.tags);
  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) || (tags !== undefined && tags.length !== value.tags.length))
  ) {
    warnings.push(`${path}: pattern.tags should be an array of strings`);
  }

  const examples = value.examples === undefined ? undefined : toStringArray(value.examples);
  if (
    value.examples !== undefined &&
    (!Array.isArray(value.examples) || (examples !== undefined && examples.length !== value.examples.length))
  ) {
    warnings.push(`${path}: pattern.examples should be an array of strings`);
  }

  const rules = value.rules === undefined ? undefined : toStringArray(value.rules);
  if (
    value.rules !== undefined &&
    (!Array.isArray(value.rules) || (rules !== undefined && rules.length !== value.rules.length))
  ) {
    warnings.push(`${path}: pattern.rules should be an array of strings`);
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const name = value.name;

  return {
    valid: true,
    value: {
      name: typeof name === "string" ? name : "",
      description: typeof value.description === "string" ? value.description : undefined,
      tags,
      examples,
      rules
    },
    errors,
    warnings
  };
}
