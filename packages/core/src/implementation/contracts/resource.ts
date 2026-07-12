export type ExtractedProp = {
  name: string;
  type?: string;
  required?: boolean;
};

export type SemanticResourceKind =
  | "component"
  | "hook"
  | "context"
  | "provider"
  | "template"
  | "icon"
  | "page"
  | "utility"
  | "theme"
  | "token"
  | "configuration"
  | "story"
  | "internal"
  | "unknown";

export type ResourceClassification = {
  kind: SemanticResourceKind;
  confidence: number;
  reasons: string[];
  generateDescriptor: boolean;
};

export type PublicApiTypeDescriptor =
  | {
      kind: "primitive";
      name: string;
    }
  | {
      kind: "literal";
      value: string | number | boolean | null;
    }
  | {
      kind: "union";
      values: Array<string | number | boolean | null>;
      display: string;
    }
  | {
      kind: "enum";
      name: string;
      members: Array<string | number>;
      display: string;
    }
  | {
      kind: "reference";
      name: string;
      display: string;
    }
  | {
      kind: "unknown";
      display: string;
    };

export type PublicApiProp = {
  name: string;
  type: PublicApiTypeDescriptor;
  required: boolean;
  inherited: boolean;
  inheritedFrom?: string;
  description?: string;
  deprecated?: string | boolean;
  default?: string | number | boolean | null;
  remarks?: string;
};

export type PublicComponentApi = {
  props: PublicApiProp[];
  events: unknown[];
  slots: unknown[];
  methods: unknown[];
  refs: unknown[];
};

export type ExtractedComponentFact = {
  name: string;
  filePath: string;
  importName: string;
  packageName: string;
  props: Record<string, ExtractedProp>;
};

export type DiscoveredResourceFact = {
  name: string;
  filePath: string;
  importName: string;
  packageName: string;
  classification: ResourceClassification;
};

export type StorybookFacts = {
  variantsByComponent: Record<string, string[]>;
  storyFilesByComponent: Record<string, string[]>;
};