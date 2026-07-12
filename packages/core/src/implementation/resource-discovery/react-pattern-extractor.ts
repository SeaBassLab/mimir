import path from "node:path";
import ts from "typescript";
import type { DiscoveredResourceFact, ExtractedReactPatterns } from "../contracts/resource";
import type { TypeScriptAnalysis } from "./typescript-analysis";

export function extractReactPatterns(analysis: TypeScriptAnalysis, resources: DiscoveredResourceFact[]): Map<string, ExtractedReactPatterns> {
  const result = new Map<string, ExtractedReactPatterns>();
  for (const resource of resources) {
    const sourceFile = analysis.program.getSourceFile(path.join(analysis.cwd, resource.filePath));
    const patterns: ExtractedReactPatterns = {
      forwardRef: false, memo: false, lazy: false, suspense: false, portal: false,
      errorBoundary: false, context: false, provider: false, customHook: /^use[A-Z]/.test(resource.name)
    };
    const visit = (node: ts.Node): void => {
      if (ts.isIdentifier(node)) {
        if (node.text === "forwardRef") patterns.forwardRef = true;
        else if (node.text === "memo") patterns.memo = true;
        else if (node.text === "lazy") patterns.lazy = true;
        else if (node.text === "Suspense") patterns.suspense = true;
        else if (node.text === "createPortal") patterns.portal = true;
        else if (node.text === "createContext") patterns.context = true;
        else if (node.text === "Provider") patterns.provider = true;
      }
      if (ts.isClassDeclaration(node) && node.members.some((member) => ts.isMethodDeclaration(member) && member.name.getText() === "componentDidCatch")) patterns.errorBoundary = true;
      ts.forEachChild(node, visit);
    };
    if (sourceFile) {
      const moduleSymbol = analysis.checker.getSymbolAtLocation(sourceFile);
      const exported = moduleSymbol && analysis.checker.getExportsOfModule(moduleSymbol).find((item) => item.getName() === resource.importName);
      const symbol = exported && (exported.flags & ts.SymbolFlags.Alias ? analysis.checker.getAliasedSymbol(exported) : exported);
      for (const declaration of symbol?.declarations ?? []) visit(declaration);
    }
    result.set(`${resource.filePath}::${resource.name}`, patterns);
  }
  return result;
}
