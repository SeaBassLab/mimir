import { getRuntimeOptions } from "../runtime/options";

export const EXIT_CODES = {
  OK: 0,
  GENERAL_ERROR: 1,
  USAGE_ERROR: 2
} as const;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function stableJson(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (Array.isArray(value)) {
    return value.map((item) => stableJson(item));
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    const normalized: Record<string, JsonValue> = {};

    for (const key of keys) {
      normalized[key] = stableJson(obj[key]);
    }

    return normalized;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return String(value);
}

export function printJson(payload: unknown): void {
  const normalized = stableJson(payload);
  console.log(JSON.stringify(normalized, null, 2));
}

export function info(message: string): void {
  if (!getRuntimeOptions().quiet) {
    console.log(`INFO: ${message}`);
  }
}

export function warn(message: string): void {
  if (!getRuntimeOptions().quiet) {
    console.warn(`WARN: ${message}`);
  }
}

export function success(message: string): void {
  if (!getRuntimeOptions().quiet) {
    console.log(`OK: ${message}`);
  }
}

export function errorMessage(message: string): void {
  console.error(`ERROR: ${message}`);
}

export function errorWithResolution(details: {
  what: string;
  why: string;
  howToFix: string;
}): void {
  errorMessage(details.what);
  console.error(`INFO: Why: ${details.why}`);
  console.error(`INFO: Fix: ${details.howToFix}`);
}

export function setExitCode(code: number): void {
  process.exitCode = code;
}
