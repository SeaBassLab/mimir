function sanitizeSegment(value: string): string {
  return value
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
}

function splitPackageName(packageName: string): { org: string; pkg: string } {
  if (packageName.startsWith("@")) {
    const parts = packageName.split("/");
    const org = sanitizeSegment(parts[0] ?? "local");
    const pkg = sanitizeSegment(parts[1] ?? "package");
    return { org: org || "local", pkg: pkg || "package" };
  }

  return {
    org: "local",
    pkg: sanitizeSegment(packageName) || "package"
  };
}

export function createComponentResourceId(packageName: string, componentName: string): string {
  // TODO: APS resource IDs currently include the visible component name. Making IDs
  // rename-stable requires a protocol-level identity decision and is outside authoring.
  const { org, pkg } = splitPackageName(packageName);
  const name = sanitizeSegment(componentName) || "component";
  return `${org}.${pkg}.component.${name}`;
}

export function createResourceId(packageName: string, kind: string, resourceName: string): string {
  const { org, pkg } = splitPackageName(packageName);
  const normalizedKind = sanitizeSegment(kind) || "resource";
  const name = sanitizeSegment(resourceName) || "resource";
  return `${org}.${pkg}.${normalizedKind}.${name}`;
}
