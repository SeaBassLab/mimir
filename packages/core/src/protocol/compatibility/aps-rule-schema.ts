import { isObject, toStringArray } from "../../shared/json";
import type { ValidationIssue } from "./index";

export type ApsRule = {
  name: string;
  description?: string;
  tags?: string[];
};

export type ResourceValidationResult<T> = {
  valid: boolean;
  value?: T;
  errors: ValidationIssue[];
  warnings: string[];
};

export function validateApsRule(value: unknown, path: string): ResourceValidationResult<ApsRule> {
  const errors: ValidationIssue[] = [];
  const warnings: string[] = [];

  if (!isObject(value)) {
    return {
      valid: false,
      errors: [
        {
          code: "APS_INVALID_RULE",
          path,
          message: "Rule must be an object"
        }
      ],
      warnings
    };
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    errors.push({
      code: "APS_INVALID_RULE",
      path,
      message: "Rule.name is required and must be a non-empty string"
    });
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    errors.push({
      code: "APS_INVALID_RULE_DESCRIPTION",
      path,
      message: "Rule.description must be a string"
    });
  }

  const tags = value.tags === undefined ? undefined : toStringArray(value.tags);
  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) || (tags !== undefined && tags.length !== value.tags.length))
  ) {
    warnings.push(`${path}: rule.tags should be an array of strings`);
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
      tags
    },
    errors,
    warnings
  };
}
