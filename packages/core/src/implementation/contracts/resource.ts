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