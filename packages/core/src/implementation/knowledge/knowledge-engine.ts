import { KnowledgeGraph } from "./knowledge-graph";
import type { KnowledgePredicate, KnowledgeProvider, KnowledgeWorkspace } from "./model";
import { createTypeScriptAnalysis } from "../resource-discovery/typescript-analysis";
import type { SemanticResourceKind } from "../contracts/resource";
import {
  DesignTokenProvider,
  PublicApiProvider,
  ReactProvider,
  RelationshipProvider,
  SemanticDiscoveryProvider,
  StorybookProvider,
} from "./providers";

const DEFAULT_PROVIDERS: KnowledgeProvider[] = [
  new SemanticDiscoveryProvider(),
  new PublicApiProvider(),
  new StorybookProvider(),
  new RelationshipProvider(),
  new ReactProvider(),
  new DesignTokenProvider()
];

export async function buildKnowledgeGraph(
  workspace: KnowledgeWorkspace,
  providers: readonly KnowledgeProvider[] = DEFAULT_PROVIDERS
): Promise<KnowledgeGraph> {
  const graph = new KnowledgeGraph();
  const availablePredicates = new Set<KnowledgePredicate>();
  for (const provider of providers) {
    const missing = (provider.requires ?? []).filter((predicate) => !availablePredicates.has(predicate));
    if (missing.length > 0) {
      throw new Error(`Knowledge provider '${provider.id}' requires facts: ${missing.join(", ")}`);
    }
    graph.add(await provider.collect(workspace, graph));
    for (const predicate of provider.provides) availablePredicates.add(predicate);
  }
  return graph;
}

export async function createKnowledgeWorkspace(
  cwd: string,
  packageName: string,
  discovery: { includeKinds?: SemanticResourceKind[]; excludeKinds?: SemanticResourceKind[] }
): Promise<KnowledgeWorkspace> {
  const analysis = await createTypeScriptAnalysis(cwd);
  return {
    cwd,
    packageName,
    discovery,
    program: analysis.program,
    checker: analysis.checker
  };
}
