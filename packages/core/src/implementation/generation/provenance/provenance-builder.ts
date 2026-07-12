import type { FieldEvidence } from "../types";

export function fromTypeScript(sourceRef: string): FieldEvidence {
  return {
    sourceType: "typescript",
    sourceRef,
    confidence: "high"
  };
}

export function fromPackageJson(): FieldEvidence {
  return {
    sourceType: "package",
    sourceRef: "package.json",
    confidence: "high"
  };
}

export function fromStorybook(sourceRef: string): FieldEvidence {
  return {
    sourceType: "storybook",
    sourceRef,
    confidence: "medium"
  };
}

export function fromHumanKnowledge(sourceRef: string): FieldEvidence {
  return {
    sourceType: "human",
    sourceRef,
    confidence: "high"
  };
}

export function missingHumanSource(fieldName: string): FieldEvidence {
  return {
    sourceType: "human",
    sourceRef: "missing",
    confidence: "low",
    note: `Missing human-authored source for '${fieldName}'`
  };
}
