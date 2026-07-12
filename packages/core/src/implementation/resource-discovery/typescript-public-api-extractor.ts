import path from "node:path";
import ts from "typescript";
import type {
  ExtractedComponentFact,
  ExtractedProp,
  PublicApiMember,
  PublicApiProp,
  PublicApiTypeDescriptor,
  PublicComponentApi
} from "../contracts/resource";
import { createTypeScriptAnalysis, type TypeScriptAnalysis } from "./typescript-analysis";

type ExtractedPublicApiFact = {
  name: string;
  filePath: string;
  api: PublicComponentApi;
  props: Record<string, ExtractedProp>;
};

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

function componentKey(filePath: string, name: string): string {
  return `${normalizeSlashes(filePath)}::${name}`;
}

function toStaticLiteralValue(expression: ts.Expression): string | number | boolean | null | undefined {
  if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) {
    return expression.text;
  }

  if (ts.isNumericLiteral(expression)) {
    return Number(expression.text);
  }

  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return true;
  }

  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return false;
  }

  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return null;
  }

  if (ts.isPrefixUnaryExpression(expression) && ts.isNumericLiteral(expression.operand)) {
    if (expression.operator === ts.SyntaxKind.MinusToken) {
      return -Number(expression.operand.text);
    }
    if (expression.operator === ts.SyntaxKind.PlusToken) {
      return Number(expression.operand.text);
    }
  }

  return undefined;
}

function extractDefaultValuesFromParameter(parameter: ts.ParameterDeclaration): Map<string, string | number | boolean | null> {
  const defaults = new Map<string, string | number | boolean | null>();

  if (!ts.isObjectBindingPattern(parameter.name)) {
    return defaults;
  }

  for (const element of parameter.name.elements) {
    if (!ts.isIdentifier(element.name) || !element.initializer) {
      continue;
    }

    const defaultValue = toStaticLiteralValue(element.initializer);
    if (defaultValue === undefined) {
      continue;
    }

    const propertyName = element.propertyName;
    const propName =
      propertyName && (ts.isIdentifier(propertyName) || ts.isStringLiteral(propertyName))
        ? propertyName.text
        : element.name.text;

    defaults.set(propName, defaultValue);
  }

  return defaults;
}

function extractDefaultValuesFromDeclaration(declaration: ts.Declaration): Map<string, string | number | boolean | null> {
  if (ts.isFunctionDeclaration(declaration) || ts.isFunctionExpression(declaration) || ts.isArrowFunction(declaration)) {
    const firstParameter = declaration.parameters[0];
    return firstParameter ? extractDefaultValuesFromParameter(firstParameter) : new Map();
  }

  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) {
      const firstParameter = declaration.initializer.parameters[0];
      return firstParameter ? extractDefaultValuesFromParameter(firstParameter) : new Map();
    }
  }

  return new Map();
}

function typeDisplay(checker: ts.TypeChecker, type: ts.Type): string {
  return checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation);
}

function literalFromType(
  checker: ts.TypeChecker,
  type: ts.Type
): string | number | boolean | null | undefined {
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return (type as ts.StringLiteralType).value;
  }

  if (type.flags & ts.TypeFlags.NumberLiteral) {
    return (type as ts.NumberLiteralType).value;
  }

  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return checker.typeToString(type) === "true";
  }

  if (type.flags & ts.TypeFlags.Null) {
    return null;
  }

  return undefined;
}

function serializeType(checker: ts.TypeChecker, type: ts.Type): PublicApiTypeDescriptor {
  const display = typeDisplay(checker, type);

  if (type.isUnion()) {
    const values: Array<string | number | boolean | null> = [];
    for (const candidate of type.types) {
      const literalValue = literalFromType(checker, candidate);
      if (literalValue === undefined) {
        return {
          kind: "reference",
          name: display,
          display
        };
      }
      values.push(literalValue);
    }

    return {
      kind: "union",
      values: [...new Set(values)],
      display
    };
  }

  const literalValue = literalFromType(checker, type);
  if (literalValue !== undefined) {
    return {
      kind: "literal",
      value: literalValue
    };
  }

  if (type.flags & ts.TypeFlags.String) {
    return { kind: "primitive", name: "string" };
  }

  if (type.flags & ts.TypeFlags.Number) {
    return { kind: "primitive", name: "number" };
  }

  if (type.flags & ts.TypeFlags.Boolean) {
    return { kind: "primitive", name: "boolean" };
  }

  if (type.flags & ts.TypeFlags.BigInt) {
    return { kind: "primitive", name: "bigint" };
  }

  if (type.flags & ts.TypeFlags.Void) {
    return { kind: "primitive", name: "void" };
  }

  if (type.flags & ts.TypeFlags.Undefined) {
    return { kind: "primitive", name: "undefined" };
  }

  if (type.flags & ts.TypeFlags.Null) {
    return { kind: "primitive", name: "null" };
  }

  if (type.flags & ts.TypeFlags.Any) {
    return { kind: "unknown", display: "any" };
  }

  if (type.flags & ts.TypeFlags.Unknown) {
    return { kind: "unknown", display: "unknown" };
  }

  const symbol = type.aliasSymbol ?? type.getSymbol();
  if (symbol) {
    for (const declaration of symbol.declarations ?? []) {
      if (!ts.isEnumDeclaration(declaration)) {
        continue;
      }

      const members: Array<string | number> = [];
      for (const member of declaration.members) {
        const memberName = ts.isIdentifier(member.name)
          ? member.name.text
          : ts.isStringLiteral(member.name)
          ? member.name.text
          : undefined;
        if (!memberName) {
          continue;
        }

        if (member.initializer) {
          const staticValue = toStaticLiteralValue(member.initializer);
          if (typeof staticValue === "string" || typeof staticValue === "number") {
            members.push(staticValue);
            continue;
          }
        }

        members.push(memberName);
      }

      return {
        kind: "enum",
        name: symbol.getName(),
        members,
        display
      };
    }

    return {
      kind: "reference",
      name: symbol.getName(),
      display
    };
  }

  return {
    kind: "unknown",
    display
  };
}

function readTagText(tag: ts.JSDocTagInfo): string {
  return ts.displayPartsToString(tag.text).trim();
}

function declarationOwnerName(declaration: ts.Declaration): string | undefined {
  let node: ts.Node | undefined = declaration;
  while (node) {
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isClassDeclaration(node)) {
      return node.name?.text;
    }
    node = node.parent;
  }
  return undefined;
}

function collectTypeReferenceNames(typeNode: ts.TypeNode | undefined, names: Set<string>): void {
  if (!typeNode) {
    return;
  }

  if (ts.isTypeReferenceNode(typeNode)) {
    if (ts.isIdentifier(typeNode.typeName)) {
      names.add(typeNode.typeName.text);
    }
    if (typeNode.typeArguments) {
      for (const argument of typeNode.typeArguments) {
        collectTypeReferenceNames(argument, names);
      }
    }
    return;
  }

  if (ts.isIntersectionTypeNode(typeNode) || ts.isUnionTypeNode(typeNode)) {
    for (const member of typeNode.types) {
      collectTypeReferenceNames(member, names);
    }
    return;
  }

  if (ts.isParenthesizedTypeNode(typeNode)) {
    collectTypeReferenceNames(typeNode.type, names);
    return;
  }

  if (ts.isTypeLiteralNode(typeNode)) {
    return;
  }
}

function rootTypeNamesForProps(
  propsType: ts.Type,
  declaration: ts.Declaration | undefined
): Set<string> {
  const names = new Set<string>();

  const symbol = propsType.aliasSymbol ?? propsType.getSymbol();
  if (symbol) {
    names.add(symbol.getName());
  }

  if (
    declaration &&
    (ts.isFunctionDeclaration(declaration) || ts.isFunctionExpression(declaration) || ts.isArrowFunction(declaration))
  ) {
    const firstParameter = declaration.parameters[0];
    collectTypeReferenceNames(firstParameter?.type, names);
  }

  if (declaration && ts.isVariableDeclaration(declaration) && declaration.initializer) {
    if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) {
      const firstParameter = declaration.initializer.parameters[0];
      collectTypeReferenceNames(firstParameter?.type, names);
    }

    if (declaration.type && ts.isTypeReferenceNode(declaration.type) && declaration.type.typeArguments?.[0]) {
      collectTypeReferenceNames(declaration.type.typeArguments[0], names);
    }
  }

  return names;
}

function getExportSymbol(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  exportName: string
): ts.Symbol | undefined {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return undefined;
  }

  const exports = checker.getExportsOfModule(moduleSymbol);
  const directMatch = exports.find((item) => item.getName() === exportName);
  if (!directMatch) {
    return undefined;
  }

  if ((directMatch.flags & ts.SymbolFlags.Alias) !== 0) {
    return checker.getAliasedSymbol(directMatch);
  }

  return directMatch;
}

function extractPropsTypeForComponent(
  checker: ts.TypeChecker,
  componentSymbol: ts.Symbol
): { propsType: ts.Type | null; declaration: ts.Declaration | undefined } {
  const declaration = componentSymbol.valueDeclaration ?? componentSymbol.declarations?.[0];

  if (declaration) {
    const componentType = checker.getTypeOfSymbolAtLocation(componentSymbol, declaration);
    const signatures = checker.getSignaturesOfType(componentType, ts.SignatureKind.Call);
    for (const signature of signatures) {
      const parameters = signature.getParameters();
      if (parameters.length === 0) {
        continue;
      }

      const propsParameter = parameters[0];
      const propsDeclaration = propsParameter.valueDeclaration ?? declaration;
      const propsType = checker.getTypeOfSymbolAtLocation(propsParameter, propsDeclaration);
      return {
        propsType,
        declaration
      };
    }

    if (
      ts.isFunctionDeclaration(declaration) ||
      ts.isFunctionExpression(declaration) ||
      ts.isArrowFunction(declaration)
    ) {
      const firstParameter = declaration.parameters[0];
      if (firstParameter) {
        return {
          propsType: checker.getTypeAtLocation(firstParameter),
          declaration
        };
      }
    }

    if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
      if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) {
        const firstParameter = declaration.initializer.parameters[0];
        if (firstParameter) {
          return {
            propsType: checker.getTypeAtLocation(firstParameter),
            declaration
          };
        }
      }
    }
  }

  return {
    propsType: null,
    declaration
  };
}

function toLegacyTypeString(type: PublicApiTypeDescriptor): string {
  if (type.kind === "primitive") {
    return type.name;
  }
  if (type.kind === "literal") {
    return String(type.value);
  }
  if (type.kind === "union") {
    return type.values.map((value) => JSON.stringify(value)).join(" | ");
  }
  if (type.kind === "enum" || type.kind === "reference" || type.kind === "unknown") {
    return type.display;
  }
  return "unknown";
}

function buildPublicProp(
  checker: ts.TypeChecker,
  propSymbol: ts.Symbol,
  fallbackNode: ts.Node,
  defaultValues: Map<string, string | number | boolean | null>,
  rootTypeNames: Set<string>
): PublicApiProp {
  const declaration = propSymbol.valueDeclaration ?? propSymbol.declarations?.[0];
  const type = checker.getTypeOfSymbolAtLocation(propSymbol, declaration ?? fallbackNode);
  const description = ts.displayPartsToString(propSymbol.getDocumentationComment(checker)).trim();
  const tags = propSymbol.getJsDocTags();
  const ownerName = declaration ? declarationOwnerName(declaration) : undefined;
  const inherited = Boolean(ownerName && !rootTypeNames.has(ownerName));

  const deprecatedTag = tags.find((tag) => tag.name === "deprecated");
  const defaultTag = tags.find((tag) => tag.name === "default");
  const remarksTag = tags.find((tag) => tag.name === "remarks");

  return {
    name: propSymbol.getName(),
    type: serializeType(checker, type),
    required: (propSymbol.flags & ts.SymbolFlags.Optional) === 0,
    inherited,
    inheritedFrom: inherited ? ownerName : undefined,
    description: description === "" ? undefined : description,
    deprecated: deprecatedTag ? readTagText(deprecatedTag) || true : undefined,
    default: defaultValues.get(propSymbol.getName()),
    remarks: remarksTag ? readTagText(remarksTag) || undefined : undefined,
    ...(defaultTag && !defaultValues.has(propSymbol.getName())
      ? {
          default: readTagText(defaultTag)
        }
      : {})
  };
}

function buildEmptyApi(): PublicComponentApi {
  return {
    props: [],
    events: [],
    slots: [],
    methods: [],
    refs: []
  };
}

function appendMemberPath(parent: string, name: string): string {
  if (/^\d+$/.test(name)) {
    return `${parent}[${name}]`;
  }
  if (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) {
    return parent ? `${parent}.${name}` : name;
  }
  return `${parent}[${JSON.stringify(name)}]`;
}

function staticPropertyName(name: ts.PropertyName): string | undefined {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) {
    return name.text;
  }
  if (ts.isComputedPropertyName(name)) {
    const value = toStaticLiteralValue(name.expression);
    return typeof value === "string" || typeof value === "number" ? String(value) : undefined;
  }
  return undefined;
}

function unwrapSurfaceExpression(expression: ts.Expression): ts.Expression {
  let current = expression;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isTypeAssertionExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

function surfaceType(
  checker: ts.TypeChecker,
  type: ts.Type,
  expression?: ts.Expression
): PublicApiTypeDescriptor {
  const descriptor = serializeType(checker, checker.getBaseTypeOfLiteralType(type));
  if (descriptor.kind !== "unknown" || (descriptor.display !== "any" && descriptor.display !== "unknown")) {
    return descriptor;
  }
  if (expression) {
    const unwrapped = unwrapSurfaceExpression(expression);
    if (ts.isStringLiteralLike(unwrapped) || ts.isTemplateExpression(unwrapped)) {
      return { kind: "primitive", name: "string" };
    }
    if (ts.isNumericLiteral(unwrapped)) return { kind: "primitive", name: "number" };
    if (unwrapped.kind === ts.SyntaxKind.TrueKeyword || unwrapped.kind === ts.SyntaxKind.FalseKeyword) {
      return { kind: "primitive", name: "boolean" };
    }
  }
  return descriptor;
}

function extractObjectMembers(
  checker: ts.TypeChecker,
  symbol: ts.Symbol,
  declaration: ts.Declaration,
  maxDepth = 4,
  maxMembers = 200
): PublicApiMember[] {
  const rootType = checker.getTypeOfSymbolAtLocation(symbol, declaration);
  if (checker.getSignaturesOfType(rootType, ts.SignatureKind.Call).length > 0) {
    return [];
  }

  const members = new Map<string, PublicApiMember>();
  const addMember = (member: PublicApiMember): void => {
    if (members.size >= maxMembers && !members.has(member.path)) return;
    const current = members.get(member.path);
    const currentIsUnknown = current?.type.kind === "unknown";
    const nextIsKnown = member.type.kind !== "unknown";
    if (!current || (currentIsUnknown && nextIsKnown)) members.set(member.path, member);
  };
  const activeTypes = new Set<ts.Type>();
  const visit = (type: ts.Type, parent: string, depth: number): void => {
    if (members.size >= maxMembers || activeTypes.has(type)) return;
    activeTypes.add(type);
    for (const property of checker.getPropertiesOfType(type)) {
      if (members.size >= maxMembers) break;
      const propertyDeclaration = property.valueDeclaration ?? property.declarations?.[0] ?? declaration;
      const propertyType = checker.getTypeOfSymbolAtLocation(property, propertyDeclaration);
      const path = appendMemberPath(parent, property.getName());
      const nested =
        depth < maxDepth &&
        (propertyType.flags & ts.TypeFlags.Object) !== 0 &&
        checker.getSignaturesOfType(propertyType, ts.SignatureKind.Call).length === 0 &&
        !checker.isArrayType(propertyType) &&
        checker.getPropertiesOfType(propertyType).length > 0;

      if (nested) {
        visit(propertyType, path, depth + 1);
        continue;
      }

      const description = ts.displayPartsToString(property.getDocumentationComment(checker)).trim();
      addMember({
        path,
        type: surfaceType(checker, propertyType),
        description: description || undefined
      });
    }
    activeTypes.delete(type);
  };

  visit(rootType, "", 1);

  const activeSymbols = new Set<ts.Symbol>();
  const initializerForSymbol = (candidate: ts.Symbol): ts.Expression | undefined => {
    const resolved = (candidate.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(candidate) : candidate;
    if (activeSymbols.has(resolved)) return undefined;
    const valueDeclaration = resolved.valueDeclaration ?? resolved.declarations?.[0];
    if (valueDeclaration && ts.isVariableDeclaration(valueDeclaration)) return valueDeclaration.initializer;
    if (valueDeclaration && ts.isPropertyAssignment(valueDeclaration)) return valueDeclaration.initializer;
    if (valueDeclaration && ts.isPropertyDeclaration(valueDeclaration)) return valueDeclaration.initializer;
    if (valueDeclaration && ts.isExportAssignment(valueDeclaration)) return valueDeclaration.expression;
    if (valueDeclaration && ts.isShorthandPropertyAssignment(valueDeclaration)) {
      return valueDeclaration.name;
    }
    return undefined;
  };

  const visitExpression = (raw: ts.Expression, parent: string, depth: number): boolean => {
    if (members.size >= maxMembers) return false;
    const expression = unwrapSurfaceExpression(raw);
    if (depth > maxDepth) return false;

    if (ts.isIdentifier(expression)) {
      const candidate = checker.getSymbolAtLocation(expression);
      if (!candidate) return false;
      const resolved = (candidate.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(candidate) : candidate;
      const initializer = initializerForSymbol(resolved);
      if (!initializer) return false;
      activeSymbols.add(resolved);
      const expanded = visitExpression(initializer, parent, depth);
      activeSymbols.delete(resolved);
      return expanded;
    }

    if (ts.isCallExpression(expression)) {
      const callName = expression.expression.getText();
      if (/^(Object\.)?(freeze|seal)$/.test(callName) && expression.arguments[0]) {
        return visitExpression(expression.arguments[0], parent, depth);
      }
      if (callName === "Object.assign") {
        let expanded = false;
        for (const argument of expression.arguments) {
          expanded = visitExpression(argument, parent, depth) || expanded;
        }
        return expanded;
      }
      return false;
    }

    if (ts.isArrayLiteralExpression(expression)) {
      expression.elements.forEach((element, index) => {
        if (!ts.isExpression(element) || members.size >= maxMembers) return;
        const path = `${parent}[${index}]`;
        if (!visitExpression(element, path, depth + 1)) {
          addMember({ path, type: surfaceType(checker, checker.getTypeAtLocation(element), element) });
        }
      });
      return true;
    }

    if (!ts.isObjectLiteralExpression(expression)) return false;
    for (const property of expression.properties) {
      if (members.size >= maxMembers) break;
      if (ts.isSpreadAssignment(property)) {
        visitExpression(property.expression, parent, depth);
        continue;
      }
      if (ts.isPropertyAssignment(property)) {
        const name = staticPropertyName(property.name);
        if (!name) continue;
        const path = appendMemberPath(parent, name);
        if (!visitExpression(property.initializer, path, depth + 1)) {
          addMember({
            path,
            type: surfaceType(checker, checker.getTypeAtLocation(property.initializer), property.initializer)
          });
        }
        continue;
      }
      if (ts.isShorthandPropertyAssignment(property)) {
        const path = appendMemberPath(parent, property.name.text);
        if (!visitExpression(property.name, path, depth + 1)) {
          addMember({ path, type: surfaceType(checker, checker.getTypeAtLocation(property.name), property.name) });
        }
        continue;
      }
      if (ts.isMethodDeclaration(property) || ts.isGetAccessorDeclaration(property)) {
        const name = staticPropertyName(property.name);
        if (name) addMember({ path: appendMemberPath(parent, name), type: surfaceType(checker, checker.getTypeAtLocation(property)) });
      }
    }
    return true;
  };

  const rootInitializer = initializerForSymbol(symbol);
  if (rootInitializer) visitExpression(rootInitializer, "", 1);
  return [...members.values()].sort((a, b) => a.path.localeCompare(b.path));
}

function buildLegacyProps(publicProps: PublicApiProp[]): Record<string, ExtractedProp> {
  const props: Record<string, ExtractedProp> = {};

  for (const prop of publicProps) {
    props[prop.name] = {
      name: prop.name,
      type: toLegacyTypeString(prop.type),
      required: prop.required
    };
  }

  return props;
}

export async function extractTypeScriptPublicApi(
  cwd: string,
  components: ExtractedComponentFact[],
  analysis?: TypeScriptAnalysis
): Promise<Map<string, ExtractedPublicApiFact>> {
  if (components.length === 0) {
    return new Map<string, ExtractedPublicApiFact>();
  }
  const resolvedAnalysis = analysis ?? (await createTypeScriptAnalysis(cwd));
  const { program, checker } = resolvedAnalysis;

  const sourceByRelativePath = new Map<string, ts.SourceFile>();
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) {
      continue;
    }

    const relativePath = normalizeSlashes(path.relative(cwd, sourceFile.fileName));
    sourceByRelativePath.set(relativePath, sourceFile);
  }

  const result = new Map<string, ExtractedPublicApiFact>();

  for (const component of components) {
    const sourceFile = sourceByRelativePath.get(component.filePath);
    if (!sourceFile) {
      continue;
    }

    const exportSymbol = getExportSymbol(checker, sourceFile, component.importName);
    if (!exportSymbol) {
      continue;
    }

    const { propsType, declaration } = extractPropsTypeForComponent(checker, exportSymbol);
    if (!propsType || !declaration) {
      const api = buildEmptyApi();
      if (declaration) {
        api.members = extractObjectMembers(checker, exportSymbol, declaration);
      }
      result.set(componentKey(component.filePath, component.name), {
        name: component.name,
        filePath: component.filePath,
        api,
        props: {}
      });
      continue;
    }

    const defaultValues = extractDefaultValuesFromDeclaration(declaration);
    const rootTypeNames = rootTypeNamesForProps(propsType, declaration);
    const props = checker
      .getPropertiesOfType(propsType)
      .map((propSymbol) => buildPublicProp(checker, propSymbol, declaration, defaultValues, rootTypeNames))
      .sort((a, b) => a.name.localeCompare(b.name));

    const api: PublicComponentApi = {
      props,
      events: [],
      slots: [],
      methods: [],
      refs: []
    };

    result.set(componentKey(component.filePath, component.name), {
      name: component.name,
      filePath: component.filePath,
      api,
      props: buildLegacyProps(props)
    });
  }

  return result;
}

export function getComponentPublicApiKey(component: Pick<ExtractedComponentFact, "filePath" | "name">): string {
  return componentKey(component.filePath, component.name);
}
