import type { ExtractedProp, PublicComponentApi, ResourceClassification } from "./resource";

export type MimirResourceDescriptor = {
  kind: string;
  name: string;
  id?: string;
  auto: {
    source: {
      file?: string;
      symbol?: string;
      public?: boolean;
    };
    props: Record<string, ExtractedProp>;
    api?: PublicComponentApi;
    classification?: ResourceClassification;
    variants: string[];
    storyFiles: string[];
  };
  human: {
    description: string;
    whenToUse: string[];
    whenNotToUse: string[];
  };
  sourceRef: string;
};

export type MimirDescriptorLoadResult = {
  descriptorFiles: string[];
  resources: MimirResourceDescriptor[];
  warnings: string[];
};