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
  members?: PublicApiMember[];
  callSignatures?: PublicApiCallSignature[];
  events: unknown[];
  slots: unknown[];
  methods: unknown[];
  refs: unknown[];
};

export type PublicApiCallSignature = {
  display: string;
  parameters: Array<{
    name: string;
    type: PublicApiTypeDescriptor;
    required: boolean;
  }>;
  returns: PublicApiTypeDescriptor;
};

export type PublicApiMember = {
  path: string;
  type: PublicApiTypeDescriptor;
  description?: string;
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
  examplesByComponent: Record<string, ExtractedExample[]>;
};

export type RelationshipType =
  | "imports"
  | "exports"
  | "uses"
  | "composes"
  | "dependsOn"
  | "provides"
  | "consumes"
  | "references";

export type ExtractedRelationship = {
  type: RelationshipType;
  target: string;
  confidence: number;
};

export type StaticValue = string | number | boolean | null | StaticValue[] | { [key: string]: StaticValue };

export type ExtractedExample = {
  name: string;
  source: { file: string };
  story: string;
  args?: Record<string, StaticValue>;
  decorators?: string[];
  play?: boolean;
};

export type DesignTokenCategory =
  | "colors"
  | "spacing"
  | "typography"
  | "radius"
  | "shadows"
  | "zIndex"
  | "breakpoints";

export type ExtractedDesignTokens = Partial<Record<DesignTokenCategory, Record<string, StaticValue>>>;

export type ExtractedReactPatterns = {
  forwardRef: boolean;
  memo: boolean;
  lazy: boolean;
  suspense: boolean;
  portal: boolean;
  errorBoundary: boolean;
  context: boolean;
  provider: boolean;
  customHook: boolean;
};

export type ExtractionMetadata = {
  confidence?: number;
  extractedAt?: string;
  extractorVersion?: string;
};
