import { isObject, toStringArray } from "../../shared/json";
import type { ValidationIssue } from "./index";

export type ApsComponent = {
  name: string;
  import?: string;
  description?: string;
  tags?: string[];
  aliases?: string[];
  examples?: string[];
  rules?: string[];
};

export type ResourceValidationResult<T> = {
  valid: boolean;
  value?: T;
  errors: ValidationIssue[];
  warnings: string[];
};

export function validateApsComponent(value: unknown, path: string): ResourceValidationResult<ApsComponent> {
  const errors: ValidationIssue[] = [];
  const warnings: string[] = [];

  if (!isObject(value)) {
    return {
      valid: false,
      errors: [
        {
          code: "APS_INVALID_COMPONENT",
          path,
          message: "Component must be an object"
        }
      ],
      warnings
    };
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    errors.push({
      code: "APS_INVALID_COMPONENT",
      path,
      message: "Component.name is required and must be a non-empty string"
    });
  }

  if (value.import !== undefined && typeof value.import !== "string") {
    errors.push({
      code: "APS_INVALID_COMPONENT_IMPORT",
      path,
      message: "Component.import must be a string"
    });
  }

  if (value.description !== undefined && typeof value.description !== "string") {
    errors.push({
      code: "APS_INVALID_COMPONENT_DESCRIPTION",
      path,
      message: "Component.description must be a string"
    });
  }

  const tags = value.tags === undefined ? undefined : toStringArray(value.tags);
  if (
    value.tags !== undefined &&
    (!Array.isArray(value.tags) || (tags !== undefined && tags.length !== value.tags.length))
  ) {
    warnings.push(`${path}: component.tags should be an array of strings`);
  }

  const aliases = value.aliases === undefined ? undefined : toStringArray(value.aliases);
  if (
    value.aliases !== undefined &&
    (!Array.isArray(value.aliases) || (aliases !== undefined && aliases.length !== value.aliases.length))
  ) {
    warnings.push(`${path}: component.aliases should be an array of strings`);
  }

  const examples = value.examples === undefined ? undefined : toStringArray(value.examples);
  if (
    value.examples !== undefined &&
    (!Array.isArray(value.examples) || (examples !== undefined && examples.length !== value.examples.length))
  ) {
    warnings.push(`${path}: component.examples should be an array of strings`);
  }

  const rules = value.rules === undefined ? undefined : toStringArray(value.rules);
  if (
    value.rules !== undefined &&
    (!Array.isArray(value.rules) || (rules !== undefined && rules.length !== value.rules.length))
  ) {
    warnings.push(`${path}: component.rules should be an array of strings`);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors,
      warnings
    };
  }

  const name = value.name;

  return {
    valid: true,
    value: {
      name: typeof name === "string" ? name : "",
      import: typeof value.import === "string" ? value.import : undefined,
      description: typeof value.description === "string" ? value.description : undefined,
      tags,
      aliases,
      examples,
      rules
    },
    errors,
    warnings
  };
}
