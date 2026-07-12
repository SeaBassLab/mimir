import { isObject } from "../../shared/json";
import { APS_RESOURCE_TYPES, type ApsResource, type ApsResourceType } from "../manifest";
import type { ResourceValidationResult } from "./aps-component-schema";

const RESOURCE_TYPES: ReadonlySet<ApsResourceType> = new Set(APS_RESOURCE_TYPES);

export function validateApsResource(value: unknown, path: string): ResourceValidationResult<ApsResource> {
  const errors: ResourceValidationResult<ApsResource>["errors"] = [];
  const warnings: string[] = [];

  if (!isObject(value)) {
    return {
      valid: false,
      errors: [{ code: "APS_INVALID_RESOURCE", path, message: "Resource must be an object" }],
      warnings
    };
  }

  if (typeof value.type !== "string" || !RESOURCE_TYPES.has(value.type as ApsResourceType)) {
    errors.push({ code: "APS_INVALID_RESOURCE_TYPE", path: `${path}.type`, message: "Resource.type is not supported" });
  }

  if (typeof value.name !== "string" || value.name.trim() === "") {
    errors.push({ code: "APS_INVALID_RESOURCE_NAME", path: `${path}.name`, message: "Resource.name is required" });
  }

  return errors.length > 0
    ? { valid: false, errors, warnings }
    : { valid: true, value: value as ApsResource, errors, warnings };
}
