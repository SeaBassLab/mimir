import path from "node:path";
import ts from "typescript";
import type { DiscoveredResourceFact, ExtractedRelationship, RelationshipType } from "../contracts/resource";
import type { TypeScriptAnalysis } from "./typescript-analysis";

function normalize(value: string): string {
  return value.split(path.sep).join("/");
}

export function extractRelationships(
  analysis: TypeScriptAnalysis,
  resources: DiscoveredResourceFact[]
): Map<string, ExtractedRelationship[]> {
  const resourceByDeclaration = new Map<ts.Declaration, DiscoveredResourceFact>();
  const declarationsByResource = new Map<string, ts.Declaration[]>();
  const resourceByName = new Map(resources.map((resource) => [resource.name, resource]));
  for (const resource of resources) {
    const sourceFile = analysis.program.getSourceFile(path.join(analysis.cwd, resource.filePath));
    const moduleSymbol = sourceFile && analysis.checker.getSymbolAtLocation(sourceFile);
    const exported = moduleSymbol && analysis.checker.getExportsOfModule(moduleSymbol).find((item) => item.getName() === resource.importName);
    const symbol = exported && (exported.flags & ts.SymbolFlags.Alias ? analysis.checker.getAliasedSymbol(exported) : exported);
    const declarations = symbol?.declarations ?? [];
    declarationsByResource.set(`${normalize(resource.filePath)}::${resource.name}`, declarations);
    for (const declaration of declarations) resourceByDeclaration.set(declaration, resource);
  }

  const result = new Map<string, ExtractedRelationship[]>();
  for (const resource of resources) {
    const sourceFile = analysis.program.getSourceFile(path.join(analysis.cwd, resource.filePath));
    if (!sourceFile) continue;
    const relationships = new Map<string, ExtractedRelationship>();
    const add = (type: RelationshipType, target: DiscoveredResourceFact | string, confidence: number): void => {
      const targetId = typeof target === "string" ? target : `local.${target.classification.kind}.${target.name.toLowerCase()}`;
      relationships.set(`${type}:${targetId}`, { type, target: targetId, confidence });
    };
    const visit = (node: ts.Node): void => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) add("imports", node.moduleSpecifier.text, 1);
      if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) add("exports", node.moduleSpecifier.text, 1);
      if (ts.isIdentifier(node)) {
        let symbol = analysis.checker.getSymbolAtLocation(node);
        if (symbol?.flags && symbol.flags & ts.SymbolFlags.Alias) symbol = analysis.checker.getAliasedSymbol(symbol);
        const target = symbol?.declarations?.map((declaration) => resourceByDeclaration.get(declaration)).find(Boolean);
        if (target && target.name !== resource.name) {
          const type: RelationshipType = ts.isJsxOpeningElement(node.parent) || ts.isJsxSelfClosingElement(node.parent)
            ? resource.classification.kind === "page" || resource.classification.kind === "template" ? "composes" : "uses"
            : ts.isTypeReferenceNode(node.parent) ? "references" : "dependsOn";
          add(type, target, 1);
        }
      }
      if (ts.isPropertyAccessExpression(node)) {
        const name = node.name.text;
        const target = resourceByName.get(node.expression.getText(sourceFile));
        if (name === "Provider" && target) add("provides", target, 1);
      }
      if (ts.isCallExpression(node)) {
        const callName = ts.isIdentifier(node.expression) ? node.expression.text : ts.isPropertyAccessExpression(node.expression) ? node.expression.name.text : "";
        if (callName === "useContext" && node.arguments[0] && ts.isIdentifier(node.arguments[0])) {
          const target = resourceByName.get(node.arguments[0].text);
          if (target) add("consumes", target, 1);
        }
      }
      ts.forEachChild(node, visit);
    };
    for (const statement of sourceFile.statements) {
      if (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) visit(statement);
    }
    const key = `${normalize(resource.filePath)}::${resource.name}`;
    for (const declaration of declarationsByResource.get(key) ?? []) visit(declaration);
    result.set(key, [...relationships.values()].sort((a, b) => `${a.type}:${a.target}`.localeCompare(`${b.type}:${b.target}`)));
  }
  return result;
}
