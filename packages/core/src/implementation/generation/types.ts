export type EvidenceConfidence = "high" | "medium" | "low";

export type FieldEvidence = {
  sourceType: string;
  sourceRef: string;
  confidence: EvidenceConfidence;
  note?: string;
};

export type GeneratedField<T> = {
  value: T;
  evidence: FieldEvidence[];
};

export type ExtractedProp = {
  name: string;
  type?: string;
  required?: boolean;
};

export type ExtractedComponentFact = {
  name: string;
  filePath: string;
  importName: string;
  packageName: string;
  props: Record<string, ExtractedProp>;
};

export type StorybookFacts = {
  variantsByComponent: Record<string, string[]>;
  storyFilesByComponent: Record<string, string[]>;
};

export type ReadmeFacts = {
  descriptionsByComponent: Record<string, string>;
};

export type GeneratedComponentResource = {
  type: "component";
  id: string;
  name: string;
  package: string;
  import: string;
  description: string;
  props: Record<string, ExtractedProp>;
  variants: string[];
  whenToUse: string[];
  whenNotToUse: string[];
  governance: {
    fields: Record<string, { evidence: FieldEvidence[] }>;
  };
};

export type GenerateOutput = {
  components: GeneratedComponentResource[];
  warnings: string[];
  missingHumanMetadata: string[];
};

export type GenerateReport = {
  outputDir: string;
  generatedResources: number;
  warnings: string[];
  missingHumanMetadata: string[];
  validate: {
    valid: boolean;
    errors: Array<{ code: string; path: string; message: string }>;
    warnings: string[];
  };
  governance?: {
    valid: boolean;
    errors: Array<{ code: string; path: string; message: string }>;
    warnings: Array<{ code: string; path: string; message: string }>;
  };
};
