import path from "node:path";
import { parse } from "yaml";
import { fileExists, readText } from "../io/fs";
import { isObject } from "../io/json";

export type HumanKnowledge = {
  description: string;
  whenToUse: string[];
  whenNotToUse: string[];
};

export type AuthoredKnowledge = {
  knowledge: HumanKnowledge;
  sourceRef: string;
};

function readStringArray(value: unknown, field: string, sourceRef: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${sourceRef}: '${field}' must be an array of strings`);
  }

  return value as string[];
}

export async function loadComponentKnowledge(
  cwd: string,
  resourceId: string
): Promise<AuthoredKnowledge | null> {
  const sourceRef = `aps/knowledge/components/${resourceId}.yaml`;
  const filePath = path.join(cwd, "aps", "knowledge", "components", `${resourceId}.yaml`);

  if (!(await fileExists(filePath))) {
    return null;
  }

  let value: unknown;
  try {
    value = parse(await readText(filePath));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid author knowledge at ${sourceRef}: ${message}`);
  }

  if (!isObject(value)) {
    throw new Error(`${sourceRef}: author knowledge must be a YAML object`);
  }

  if (typeof value.description !== "string") {
    throw new Error(`${sourceRef}: 'description' must be a string`);
  }

  return {
    knowledge: {
      description: value.description,
      whenToUse: readStringArray(value.whenToUse, "whenToUse", sourceRef),
      whenNotToUse: readStringArray(value.whenNotToUse, "whenNotToUse", sourceRef)
    },
    sourceRef
  };
}
