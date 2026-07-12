import path from "node:path";
import ts from "typescript";
import type { DesignTokenCategory, DiscoveredResourceFact, ExtractedDesignTokens, StaticValue } from "../contracts/resource";
import type { TypeScriptAnalysis } from "./typescript-analysis";

const CATEGORY_NAMES: Record<string, DesignTokenCategory> = {
  color: "colors", colors: "colors", palette: "colors", spacing: "spacing", space: "spacing",
  typography: "typography", font: "typography", radius: "radius", radii: "radius",
  shadow: "shadows", shadows: "shadows", zindex: "zIndex", breakpoint: "breakpoints", breakpoints: "breakpoints"
};

function staticValue(node: ts.Expression): StaticValue | undefined {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false;
  if (node.kind === ts.SyntaxKind.NullKeyword) return null;
  if (ts.isArrayLiteralExpression(node)) {
    const values = node.elements.map((item) => ts.isExpression(item) ? staticValue(item) : undefined);
    return values.every((item) => item !== undefined) ? values as StaticValue[] : undefined;
  }
  if (ts.isObjectLiteralExpression(node)) {
    const value: Record<string, StaticValue> = {};
    for (const property of node.properties) {
      if (!ts.isPropertyAssignment(property)) return undefined;
      const name = property.name.getText().replace(/^['"]|['"]$/g, "");
      const child = staticValue(property.initializer);
      if (child === undefined) return undefined;
      value[name] = child;
    }
    return value;
  }
  return undefined;
}

export function extractDesignTokens(analysis: TypeScriptAnalysis, resources: DiscoveredResourceFact[]): Map<string, ExtractedDesignTokens> {
  const result = new Map<string, ExtractedDesignTokens>();
  for (const resource of resources) {
    if (resource.classification.kind !== "token" && resource.classification.kind !== "theme") continue;
    const sourceFile = analysis.program.getSourceFile(path.join(analysis.cwd, resource.filePath));
    if (!sourceFile) continue;
    const tokens: ExtractedDesignTokens = {};
    const visit = (node: ts.Node): void => {
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        const category = CATEGORY_NAMES[node.name.text.toLowerCase()];
        const value = staticValue(node.initializer);
        if (category && value && typeof value === "object" && !Array.isArray(value)) tokens[category] = value;
        if (ts.isObjectLiteralExpression(node.initializer)) {
          for (const property of node.initializer.properties) {
            if (!ts.isPropertyAssignment(property)) continue;
            const nestedCategory = CATEGORY_NAMES[property.name.getText().replace(/^['"]|['"]$/g, "").toLowerCase()];
            const nestedValue = staticValue(property.initializer);
            if (nestedCategory && nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
              tokens[nestedCategory] = nestedValue;
            }
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(sourceFile);
    result.set(`${resource.filePath}::${resource.name}`, tokens);
  }
  return result;
}
