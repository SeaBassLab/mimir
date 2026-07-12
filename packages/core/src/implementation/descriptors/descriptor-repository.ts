import path from "node:path";
import { parse } from "yaml";
import { readText } from "../io/fs";
import { isObject } from "../io/json";
import type { MimirDescriptorLoadResult, MimirResourceDescriptor } from "../contracts/descriptor";
import type { ExtractedProp } from "../contracts/resource";
import { discoverDescriptorFiles } from "./descriptor-discovery";

const SUPPORTED_KINDS = new Set([
  "component",
  "function",
  "api",
  "service",
  "model",
  "event",
  "rule",
  "example",
  "pattern",
  "migration"
]);

type RawDescriptorResource = {
  kind?: unknown;
  name?: unknown;
  id?: unknown;
  auto?: unknown;
  human?: unknown;
  source?: unknown;
  props?: unknown;
  variants?: unknown;
  storyFiles?: unknown;
  description?: unknown;
  whenToUse?: unknown;
  whenNotToUse?: unknown;
};

function readStringArray(value: unknown, field: string, sourceRef: string): string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${sourceRef}: '${field}' must be an array of strings`);
  }

  return value;
}

function readPropsMap(value: unknown, field: string, sourceRef: string): Record<string, ExtractedProp> {
  if (value === undefined) {
    return {};
  }

  if (!Array.isArray(value)) {
    throw new Error(`${sourceRef}: '${field}' must be an array of prop objects`);
  }

  const props: Record<string, ExtractedProp> = {};
  for (let index = 0; index < value.length; index += 1) {
    const item = value[index];
    if (!isObject(item) || typeof item.name !== "string" || item.name.trim() === "") {
      throw new Error(`${sourceRef}: '${field}[${index}]' must include a non-empty 'name'`);
    }

    const name = item.name.trim();
    props[name] = {
      name,
      type: typeof item.type === "string" ? item.type : undefined,
      required: typeof item.required === "boolean" ? item.required : undefined
    };
  }

  return props;
}

function readResource(
  value: unknown,
  sourceRef: string,
  index: number
): MimirResourceDescriptor | null {
  if (!isObject(value)) {
    throw new Error(`${sourceRef}: resources[${index}] must be an object`);
  }

  const resource = value as RawDescriptorResource;

  if (typeof resource.kind !== "string" || resource.kind.trim() === "") {
    throw new Error(`${sourceRef}: resources[${index}].kind must be a non-empty string`);
  }

  if (typeof resource.name !== "string" || resource.name.trim() === "") {
    throw new Error(`${sourceRef}: resources[${index}].name must be a non-empty string`);
  }

  const kind = resource.kind.trim().toLowerCase();
  if (!SUPPORTED_KINDS.has(kind)) {
    throw new Error(
      `${sourceRef}: resources[${index}].kind '${resource.kind}' is not supported by the descriptor contract`
    );
  }

  const autoNode = isObject(resource.auto) ? resource.auto : {};
  const humanNode = isObject(resource.human) ? resource.human : {};

  const sourceCandidate = isObject(autoNode.source)
    ? autoNode.source
    : isObject(resource.source)
    ? resource.source
    : {};

  const source = isObject(sourceCandidate)
    ? {
        file: typeof sourceCandidate.file === "string" ? sourceCandidate.file : undefined,
        symbol: typeof sourceCandidate.symbol === "string" ? sourceCandidate.symbol : undefined,
        public: typeof sourceCandidate.public === "boolean" ? sourceCandidate.public : undefined
      }
    : {};

  const props = readPropsMap(
    autoNode.props ?? resource.props,
    "auto.props",
    sourceRef
  );

  const variants = readStringArray(
    autoNode.variants ?? resource.variants,
    "auto.variants",
    sourceRef
  );

  const storyFiles = readStringArray(
    autoNode.storyFiles ?? resource.storyFiles,
    "auto.storyFiles",
    sourceRef
  );

  return {
    kind,
    name: resource.name,
    id: typeof resource.id === "string" ? resource.id : undefined,
    auto: {
      source,
      props,
      variants,
      storyFiles
    },
    human: {
      description:
        typeof humanNode.description === "string"
          ? humanNode.description
          : typeof resource.description === "string"
          ? resource.description
          : "",
      whenToUse: readStringArray(humanNode.whenToUse ?? resource.whenToUse, "human.whenToUse", sourceRef),
      whenNotToUse: readStringArray(
        humanNode.whenNotToUse ?? resource.whenNotToUse,
        "human.whenNotToUse",
        sourceRef
      )
    },
    sourceRef
  };
}

export async function loadMimirDescriptors(cwd: string): Promise<MimirDescriptorLoadResult> {
  const descriptorFiles = await discoverDescriptorFiles(cwd);
  const resources: MimirResourceDescriptor[] = [];
  const warnings: string[] = [];

  for (const sourceRef of descriptorFiles) {
    const descriptorPath = path.join(cwd, sourceRef);

    let raw: unknown;
    try {
      raw = parse(await readText(descriptorPath));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      warnings.push(`Invalid descriptor YAML at ${sourceRef}: ${message}`);
      continue;
    }

    if (!isObject(raw)) {
      warnings.push(`${sourceRef}: descriptor must be a YAML object`);
      continue;
    }

    const schemaVersion = raw.schemaVersion;
    if (schemaVersion !== 1) {
      warnings.push(`${sourceRef}: schemaVersion must be 1`);
      continue;
    }

    if (!Array.isArray(raw.resources)) {
      warnings.push(`${sourceRef}: resources must be an array`);
      continue;
    }

    for (let index = 0; index < raw.resources.length; index += 1) {
      try {
        const resource = readResource(raw.resources[index], sourceRef, index);
        if (resource) {
          resources.push(resource);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        warnings.push(message);
      }
    }
  }

  return {
    descriptorFiles,
    resources,
    warnings
  };
}