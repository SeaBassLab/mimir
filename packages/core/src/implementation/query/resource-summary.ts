import { isObject } from "../io/json";

const RESERVED_KEYS = new Set([
  "version",
  "name",
  "provider",
  "description",
  "$schema",
  "metadata"
]);

function countValue(value: unknown): number {
  if (Array.isArray(value)) {
    return value.length;
  }

  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }

  if (isObject(value)) {
    return Object.keys(value).length;
  }

  return 0;
}

export function extractResourceCounts(
  manifest: Record<string, unknown>
): Array<{ key: string; count: number }> {
  return Object.keys(manifest)
    .filter((key) => !RESERVED_KEYS.has(key))
    .map((key) => ({ key, count: countValue(manifest[key]) }))
    .filter((item) => item.count > 0)
    .sort((a, b) => a.key.localeCompare(b.key));
}
