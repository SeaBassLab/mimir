import path from "node:path";
import ts from "typescript";
import type {
  ExtractedComponentFact,
  ExtractedProp,
  PublicApiProp,
  PublicApiTypeDescriptor,
  PublicComponentApi
} from "../contracts/resource";

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

    const propName = ts.isIdentifier(element.propertyName)
      ? element.propertyName.text
      : ts.isStringLiteral(element.propertyName)
      ? element.propertyName.text
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

function literalFromType(type: ts.Type): string | number | boolean | null | undefined {
  if (type.flags & ts.TypeFlags.StringLiteral) {
    return (type as ts.StringLiteralType).value;
  }

  if (type.flags & ts.TypeFlags.NumberLiteral) {
    return (type as ts.NumberLiteralType).value;
  }

  if (type.flags & ts.TypeFlags.BooleanLiteral) {
    return (type.flags & ts.TypeFlags.BooleanLiteral) && (type as ts.IntrinsicType).intrinsicName === "true"
      ? true
      : false;
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
      const literalValue = literalFromType(candidate);
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

  const literalValue = literalFromType(type);
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
  components: ExtractedComponentFact[]
): Promise<Map<string, ExtractedPublicApiFact>> {
  const programRoots = [...new Set(components.map((component) => path.join(cwd, component.filePath)))];
  if (programRoots.length === 0) {
    return new Map<string, ExtractedPublicApiFact>();
  }

  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    esModuleInterop: true,
    allowJs: false,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true
  };

  const program = ts.createProgram(programRoots, compilerOptions);
  const checker = program.getTypeChecker();

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
      result.set(componentKey(component.filePath, component.name), {
        name: component.name,
        filePath: component.filePath,
        api: buildEmptyApi(),
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
