export type ApsStringMap = Record<string, string>;

export type ApsSeverity = "error" | "warning" | "info" | "hint" | string;

export type ApsScope = "resource" | "package" | "project" | "workspace" | "global" | string;

export interface ApsResourceReference {
  id?: string;
  name?: string;
  type?: string;
  package?: string;
  import?: string;
  path?: string;
  [key: string]: unknown;
}

export interface ApsVersionConstraint {
  minVersion?: string;
  maxVersion?: string;
  range?: string;
  since?: string;
  until?: string;
  [key: string]: unknown;
}

export interface ApsDeprecation {
  deprecated: boolean;
  since?: string;
  replacement?: ApsResourceReference[];
  reason?: string;
  removeIn?: string;
  migrationIds?: string[];
  [key: string]: unknown;
}

export interface ApsRuleBinding {
  id?: string;
  name?: string;
  severity?: ApsSeverity;
  [key: string]: unknown;
}

export interface ApsInlineExample {
  title?: string;
  description?: string;
  language?: string;
  imports?: string[];
  code?: string;
  explanation?: string;
  [key: string]: unknown;
}
