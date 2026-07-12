import {
  fromPackageJson,
  fromReadme,
  fromStorybook,
  fromTypeScript,
  fromHumanKnowledge,
  missingHumanSource
} from "../provenance/provenance-builder";
import { createComponentResourceId } from "../../resource-identity";
import type { AuthoredKnowledge } from "../../authoring/knowledge-loader";
import type {
  ExtractedComponentFact,
  GeneratedComponentResource,
  ReadmeFacts,
  StorybookFacts
} from "../types";

export function buildComponentResource(
  component: ExtractedComponentFact,
  storybook: StorybookFacts,
  readme: ReadmeFacts,
  authored: AuthoredKnowledge | null = null
): GeneratedComponentResource {
  const authoredDescription = authored?.knowledge.description.trim() ?? "";
  const description = authoredDescription || readme.descriptionsByComponent[component.name] || "";
  const whenToUse = authored?.knowledge.whenToUse ?? [];
  const whenNotToUse = authored?.knowledge.whenNotToUse ?? [];
  const variants = storybook.variantsByComponent[component.name] ?? [];
  const storyFiles = storybook.storyFilesByComponent[component.name] ?? [];

  const evidenceByField: Record<string, { evidence: ReturnType<typeof fromPackageJson>[] }> = {
    id: { evidence: [fromPackageJson()] },
    name: { evidence: [fromTypeScript(component.filePath)] },
    package: { evidence: [fromPackageJson()] },
    import: { evidence: [fromTypeScript(component.filePath)] },
    description: {
      evidence:
        authoredDescription !== "" && authored
          ? [fromHumanKnowledge(authored.sourceRef)]
          : description !== ""
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
    whenToUse: {
      evidence:
        whenToUse.length > 0 && authored
          ? [fromHumanKnowledge(authored.sourceRef)]
          : [missingHumanSource("whenToUse")]
    },
    whenNotToUse: {
      evidence:
        whenNotToUse.length > 0 && authored
          ? [fromHumanKnowledge(authored.sourceRef)]
          : [missingHumanSource("whenNotToUse")]
    }
  };

  return {
    type: "component",
    id: createComponentResourceId(component.packageName, component.name),
    name: component.name,
    package: component.packageName,
    import: component.importName,
    description,
    props: component.props,
    variants,
    whenToUse,
    whenNotToUse,
    governance: {
      fields: evidenceByField
    }
  };
}
