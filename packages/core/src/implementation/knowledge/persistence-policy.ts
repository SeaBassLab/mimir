import type {
  DiscoveredResourceFact,
  ExtractedExample,
  ExtractedProp,
  ExtractedReactPatterns,
  ExtractedRelationship,
  ExtractionMetadata,
  PublicComponentApi
} from "../contracts/resource";
import type { KnowledgeGraphReader } from "./model";

export type PersistentResourceKnowledge = {
  resource: DiscoveredResourceFact;
  props: Record<string, ExtractedProp>;
  api?: PublicComponentApi;
  relationships: ExtractedRelationship[];
  examples: ExtractedExample[];
  variants: string[];
  storyFiles: string[];
  react: ExtractedReactPatterns;
  metadata: ExtractionMetadata;
};

export interface PersistencePolicy {
  select(graph: KnowledgeGraphReader): PersistentResourceKnowledge[];
}

const EMPTY_REACT: ExtractedReactPatterns = {
  forwardRef: false,
  memo: false,
  lazy: false,
  suspense: false,
  portal: false,
  errorBoundary: false,
  context: false,
  provider: false,
  customHook: false
};

function firstObject<T>(graph: KnowledgeGraphReader, subject: string, predicate: Parameters<KnowledgeGraphReader["factsFor"]>[1]): T | undefined {
  return graph.factsFor(subject, predicate)[0]?.object as T | undefined;
}

export class DescriptorPersistencePolicy implements PersistencePolicy {
  constructor(
    private readonly excludedRelationshipTypes: ReadonlySet<ExtractedRelationship["type"]> = new Set(["imports", "exports"])
  ) {}

  select(graph: KnowledgeGraphReader): PersistentResourceKnowledge[] {
    return graph.facts("resource")
      .map((fact) => ({ subject: fact.subject, resource: fact.object as DiscoveredResourceFact }))
      .filter(({ resource }) => resource.classification.generateDescriptor)
      .map(({ subject, resource }) => {
        const publicApi = firstObject<{ api: PublicComponentApi; props: Record<string, ExtractedProp> }>(graph, subject, "public-api");
        const relationships = graph.factsFor(subject, "relationship")
          .map((fact) => fact.object as ExtractedRelationship)
          .filter((relationship) => !this.excludedRelationshipTypes.has(relationship.type));
        const examples = graph.factsFor(subject, "example").map((fact) => fact.object as ExtractedExample);
        return {
          resource,
          props: publicApi?.props ?? {},
          api: publicApi?.api,
          relationships,
          examples,
          variants: [...new Set(examples.map((example) => example.story))].sort((a, b) => a.localeCompare(b)),
          storyFiles: [...new Set(examples.map((example) => example.source.file))].sort((a, b) => a.localeCompare(b)),
          react: firstObject<ExtractedReactPatterns>(graph, subject, "react-patterns") ?? EMPTY_REACT,
          metadata: {
            confidence: resource.classification.confidence,
            extractorVersion: "1.0.0"
          }
        };
      });
  }
}
