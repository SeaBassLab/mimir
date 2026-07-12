import path from "node:path";
import ts from "typescript";
import type { StaticValue, StorybookFacts } from "../contracts/resource";
import { createTypeScriptAnalysis, type TypeScriptAnalysis } from "./typescript-analysis";

function normalize(value: string): string { return value.split(path.sep).join("/"); }

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
      if (!ts.isPropertyAssignment(property)) continue;
      const child = staticValue(property.initializer);
      if (child !== undefined) value[property.name.getText().replace(/^['"]|['"]$/g, "")] = child;
    }
    return value;
  }
  return undefined;
}

function property(object: ts.ObjectLiteralExpression, name: string): ts.PropertyAssignment | undefined {
  return object.properties.find((item): item is ts.PropertyAssignment => ts.isPropertyAssignment(item) && item.name.getText().replace(/^['"]|['"]$/g, "") === name);
}

export async function extractStorybookFacts(input: TypeScriptAnalysis | string): Promise<StorybookFacts> {
  const analysis = typeof input === "string" ? await createTypeScriptAnalysis(input) : input;
  const facts: StorybookFacts = { variantsByComponent: {}, storyFilesByComponent: {}, examplesByComponent: {} };
  for (const sourceFile of analysis.program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile || !sourceFile.fileName.includes(".stories.")) continue;
    let componentName: string | undefined;
    const objects = new Map<string, ts.ObjectLiteralExpression>();
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer)) {
          objects.set(declaration.name.text, declaration.initializer);
        }
      }
    }
    for (const statement of sourceFile.statements) {
      if (!ts.isExportAssignment(statement)) continue;
      const meta = ts.isObjectLiteralExpression(statement.expression)
        ? statement.expression
        : ts.isIdentifier(statement.expression) ? objects.get(statement.expression.text) : undefined;
      if (!meta) continue;
      const component = property(meta, "component")?.initializer;
      if (component && ts.isIdentifier(component)) componentName = component.text;
    }
    if (!componentName) continue;
    const file = normalize(path.relative(analysis.cwd, sourceFile.fileName));
    const variants: string[] = [];
    const examples = [];
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((item) => item.kind === ts.SyntaxKind.ExportKeyword)) continue;
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue;
        const name = declaration.name.text;
        variants.push(name);
        const object = declaration.initializer && ts.isObjectLiteralExpression(declaration.initializer) ? declaration.initializer : undefined;
        const argsValue = object && property(object, "args")?.initializer;
        const decoratorsValue = object && property(object, "decorators")?.initializer;
        const args = argsValue && staticValue(argsValue);
        examples.push({
          name, source: { file }, story: name,
          ...(args && typeof args === "object" && !Array.isArray(args) ? { args } : {}),
          ...(decoratorsValue && ts.isArrayLiteralExpression(decoratorsValue) ? { decorators: decoratorsValue.elements.map((item) => item.getText(sourceFile)) } : {}),
          ...(object && property(object, "play") ? { play: true } : {})
        });
      }
    }
    facts.variantsByComponent[componentName] = [...new Set([...(facts.variantsByComponent[componentName] ?? []), ...variants])].sort();
    facts.storyFilesByComponent[componentName] = [...new Set([...(facts.storyFilesByComponent[componentName] ?? []), file])].sort();
    facts.examplesByComponent[componentName] = [...(facts.examplesByComponent[componentName] ?? []), ...examples];
  }
  return facts;
}
