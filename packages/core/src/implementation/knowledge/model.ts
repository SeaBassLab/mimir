import type ts from "typescript";
import type { SemanticResourceKind } from "../contracts/resource";

export type KnowledgeSource =
  | "typescript"
  | "storybook"
  | "react"
  | "design-tokens";

export type KnowledgeEvidence = {
  kind: string;
  detail: string;
  file?: string;
  symbol?: string;
};

export type KnowledgePredicate =
  | "resource"
  | "classification"
  | "public-api"
  | "relationship"
  | "example"
  | "react-patterns"
  | "design-tokens";

export type KnowledgeFact = {
  subject: string;
  predicate: KnowledgePredicate;
  object: unknown;
  confidence: number;
  source: KnowledgeSource;
  evidence: KnowledgeEvidence[];
  metadata?: Record<string, unknown>;
};

export type KnowledgeWorkspace = {
  cwd: string;
  packageName: string;
  program: ts.Program;
  checker: ts.TypeChecker;
  discovery: {
    includeKinds?: SemanticResourceKind[];
    excludeKinds?: SemanticResourceKind[];
  };
};

export interface KnowledgeProvider {
  readonly id: string;
  readonly requires?: readonly KnowledgePredicate[];
  readonly provides: readonly KnowledgePredicate[];
  collect(workspace: KnowledgeWorkspace, graph: KnowledgeGraphReader): Promise<KnowledgeFact[]>;
}

export interface KnowledgeGraphReader {
  facts(predicate?: KnowledgePredicate): readonly KnowledgeFact[];
  factsFor(subject: string, predicate?: KnowledgePredicate): readonly KnowledgeFact[];
  resources(): readonly KnowledgeFact[];
  relationships(subject?: string): readonly KnowledgeFact[];
  examples(subject?: string): readonly KnowledgeFact[];
  publicApi(subject: string): KnowledgeFact | undefined;
  classification(subject: string): KnowledgeFact | undefined;
}
