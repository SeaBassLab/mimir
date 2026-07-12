import { createResourceId } from "../resource-identity";
import { extractDesignTokens } from "../resource-discovery/design-token-extractor";
import { extractReactPatterns } from "../resource-discovery/react-pattern-extractor";
import { extractRelationships } from "../resource-discovery/relationship-extractor";
import { extractStorybookFacts } from "../resource-discovery/storybook-extractor";
import { discoverTypeScriptResources } from "../resource-discovery/typescript-extractor";
import {
  extractTypeScriptPublicApi,
  getComponentPublicApiKey
} from "../resource-discovery/typescript-public-api-extractor";
import type { DiscoveredResourceFact, ExtractedComponentFact } from "../contracts/resource";
import type { TypeScriptAnalysis } from "../resource-discovery/typescript-analysis";
import type { KnowledgeFact, KnowledgeGraphReader, KnowledgeProvider, KnowledgeWorkspace } from "./model";

function analysis(workspace: KnowledgeWorkspace): TypeScriptAnalysis {
  return { cwd: workspace.cwd, program: workspace.program, checker: workspace.checker };
}

function subjectFor(resource: DiscoveredResourceFact): string {
  return createResourceId(resource.packageName, resource.classification.kind, resource.name);
}

function resources(graph: KnowledgeGraphReader): DiscoveredResourceFact[] {
  return graph.facts("resource").map((fact) => fact.object as DiscoveredResourceFact);
}

export class SemanticDiscoveryProvider implements KnowledgeProvider {
  readonly id = "semantic-discovery";
  readonly provides = ["resource", "classification"] as const;

  async collect(workspace: KnowledgeWorkspace, _graph: KnowledgeGraphReader): Promise<KnowledgeFact[]> {
    const found = await discoverTypeScriptResources(workspace.cwd, workspace.packageName, workspace.discovery, analysis(workspace));
    return found.flatMap((resource): KnowledgeFact[] => [
      {
        subject: subjectFor(resource),
        predicate: "resource",
        object: resource,
        confidence: resource.classification.confidence,
        source: "typescript",
        evidence: resource.classification.reasons.map((detail) => ({ kind: "classification-signal", detail, file: resource.filePath, symbol: resource.name }))
      },
      {
        subject: subjectFor(resource),
        predicate: "classification",
        object: resource.classification,
        confidence: resource.classification.confidence,
        source: "typescript",
        evidence: resource.classification.reasons.map((detail) => ({ kind: "classification-signal", detail, file: resource.filePath, symbol: resource.name }))
      }
    ]);
  }
}

export class PublicApiProvider implements KnowledgeProvider {
  readonly id = "public-api";
  readonly requires = ["resource"] as const;
  readonly provides = ["public-api"] as const;

  async collect(workspace: KnowledgeWorkspace, graph: KnowledgeGraphReader): Promise<KnowledgeFact[]> {
    const discovered = resources(graph);
    const components: ExtractedComponentFact[] = discovered.map((resource) => ({ ...resource, props: {} }));
    const extracted = await extractTypeScriptPublicApi(workspace.cwd, components, analysis(workspace));
    return discovered.flatMap((resource): KnowledgeFact[] => {
      const api = extracted.get(getComponentPublicApiKey(resource));
      return api ? [{
        subject: subjectFor(resource),
        predicate: "public-api",
        object: { api: api.api, props: api.props },
        confidence: 1,
        source: "typescript",
        evidence: [{ kind: "public-export", detail: resource.importName, file: resource.filePath, symbol: resource.name }]
      }] : [];
    });
  }
}

export class StorybookProvider implements KnowledgeProvider {
  readonly id = "storybook";
  readonly requires = ["resource"] as const;
  readonly provides = ["example"] as const;

  async collect(workspace: KnowledgeWorkspace, graph: KnowledgeGraphReader): Promise<KnowledgeFact[]> {
    const facts = await extractStorybookFacts(analysis(workspace));
    return resources(graph).flatMap((resource) => (facts.examplesByComponent[resource.name] ?? []).map((example): KnowledgeFact => ({
      subject: subjectFor(resource),
      predicate: "example",
      object: example,
      confidence: 1,
      source: "storybook",
      evidence: [{ kind: "exported-story", detail: example.story, file: example.source.file, symbol: example.name }]
    })));
  }
}

export class RelationshipProvider implements KnowledgeProvider {
  readonly id = "relationships";
  readonly requires = ["resource"] as const;
  readonly provides = ["relationship"] as const;

  async collect(workspace: KnowledgeWorkspace, graph: KnowledgeGraphReader): Promise<KnowledgeFact[]> {
    const discovered = resources(graph);
    const extracted = extractRelationships(analysis(workspace), discovered);
    return discovered.flatMap((resource) => (extracted.get(getComponentPublicApiKey(resource)) ?? []).map((relationship): KnowledgeFact => ({
      subject: subjectFor(resource),
      predicate: "relationship",
      object: relationship,
      confidence: relationship.confidence,
      source: "typescript",
      evidence: [{ kind: "ast-reference", detail: relationship.type, file: resource.filePath, symbol: resource.name }]
    })));
  }
}

export class ReactProvider implements KnowledgeProvider {
  readonly id = "react";
  readonly requires = ["resource"] as const;
  readonly provides = ["react-patterns"] as const;

  async collect(workspace: KnowledgeWorkspace, graph: KnowledgeGraphReader): Promise<KnowledgeFact[]> {
    const discovered = resources(graph);
    const extracted = extractReactPatterns(analysis(workspace), discovered);
    return discovered.flatMap((resource): KnowledgeFact[] => {
      const patterns = extracted.get(getComponentPublicApiKey(resource));
      if (!patterns) return [];
      const evidence = Object.entries(patterns)
        .filter(([, present]) => present)
        .map(([pattern]) => ({ kind: "react-pattern", detail: pattern, file: resource.filePath, symbol: resource.name }));
      return [{
        subject: subjectFor(resource),
        predicate: "react-patterns",
        object: patterns,
        confidence: 1,
        source: "react",
        evidence
      }];
    });
  }
}

export class DesignTokenProvider implements KnowledgeProvider {
  readonly id = "design-tokens";
  readonly requires = ["resource"] as const;
  readonly provides = ["design-tokens"] as const;

  async collect(workspace: KnowledgeWorkspace, graph: KnowledgeGraphReader): Promise<KnowledgeFact[]> {
    const discovered = resources(graph);
    const extracted = extractDesignTokens(analysis(workspace), discovered);
    return discovered.flatMap((resource): KnowledgeFact[] => {
      const tokens = extracted.get(getComponentPublicApiKey(resource));
      return tokens ? [{
        subject: subjectFor(resource),
        predicate: "design-tokens",
        object: tokens,
        confidence: resource.classification.confidence,
        source: "design-tokens",
        evidence: [{ kind: "static-token-object", detail: "Statically resolved token values", file: resource.filePath, symbol: resource.name }]
      }] : [];
    });
  }
}
