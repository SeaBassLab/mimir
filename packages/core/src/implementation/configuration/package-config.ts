import { isObject } from "../io/json";

export type ApsPackageConfig = {
  version?: number;
  manifest?: string;
  adapters?: unknown;
  [key: string]: unknown;
};

export type ApsPackageConfigResolution = {
  config: ApsPackageConfig | null;
  source: "aps" | "ai" | null;
  warnings: string[];
};

export function resolveApsPackageConfig(packageJson: Record<string, unknown>): ApsPackageConfigResolution {
  const hasAps = isObject(packageJson.aps);
  const hasAi = isObject(packageJson.ai);
  const warnings: string[] = [];

  if (hasAps && hasAi) {
    warnings.push("Both 'aps' and legacy 'ai' configurations are present. Using 'aps'.");
  }

  if (hasAps) {
    return {
      config: packageJson.aps as ApsPackageConfig,
      source: "aps",
      warnings
    };
  }

  if (hasAi) {
    warnings.push("Legacy 'ai' configuration detected. Please migrate to 'aps'.");
    return {
      config: packageJson.ai as ApsPackageConfig,
      source: "ai",
      warnings
    };
  }

  return {
    config: null,
    source: null,
    warnings
  };
}
