import {
  fromPackageJson,
  fromReadme,
  fromStorybook,
  fromTypeScript,
  missingHumanSource
} from "../provenance/provenance-builder";
import type {
  ExtractedComponentFact,
  GeneratedComponentResource,
  ReadmeFacts,
  StorybookFacts
} from "../types";

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

function createDeterministicId(packageName: string, componentName: string): string {
  const { org, pkg } = splitPackageName(packageName);
  const name = sanitizeSegment(componentName) || "component";
  return `${org}.${pkg}.component.${name}`;
}

export function buildComponentResource(
  component: ExtractedComponentFact,
  storybook: StorybookFacts,
  readme: ReadmeFacts
): GeneratedComponentResource {
  const description = readme.descriptionsByComponent[component.name] ?? "";
  const variants = storybook.variantsByComponent[component.name] ?? [];
  const storyFiles = storybook.storyFilesByComponent[component.name] ?? [];

  const evidenceByField: Record<string, { evidence: ReturnType<typeof fromPackageJson>[] }> = {
    id: { evidence: [fromPackageJson()] },
    name: { evidence: [fromTypeScript(component.filePath)] },
    package: { evidence: [fromPackageJson()] },
    import: { evidence: [fromTypeScript(component.filePath)] },
    description: {
      evidence:
        description !== ""
          ? [fromReadme("README.md")]
          : [missingHumanSource("description")]
    },
    props: { evidence: [fromTypeScript(component.filePath)] },
    variants: {
      evidence:
        variants.length > 0 && storyFiles.length > 0
          ? storyFiles.map((file) => fromStorybook(file))
          : [missingHumanSource("variants")]
    },
    whenToUse: { evidence: [missingHumanSource("whenToUse")] },
    whenNotToUse: { evidence: [missingHumanSource("whenNotToUse")] }
  };

  return {
    type: "component",
    id: createDeterministicId(component.packageName, component.name),
    name: component.name,
    package: component.packageName,
    import: component.importName,
    description,
    props: component.props,
    variants,
    whenToUse: [],
    whenNotToUse: [],
    governance: {
      fields: evidenceByField
    }
  };
}
