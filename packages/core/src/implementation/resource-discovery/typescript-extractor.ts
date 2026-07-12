import path from "path";
import { readdir } from "fs/promises";
import ts from "typescript";
import {
  classifyResource,
  mergeClassificationPolicy,
  type SemanticResourceSignals
} from "./semantic-resource-classifier";
import type {
  DiscoveredResourceFact,
  ExtractedComponentFact,
  SemanticResourceKind
} from "../contracts/resource";

const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

export type TypeScriptResourceDiscoveryOptions = {
  includeKinds?: SemanticResourceKind[];
  excludeKinds?: SemanticResourceKind[];
};

function normalizeSlashes(value: string): string {
  return value.split(path.sep).join("/");
}

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) {
        continue;
      }
      files.push(...(await collectFiles(absolutePath)));
      continue;
    }

    if (entry.isFile() && TS_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }

  return files;
}

function sourceFileHasModuleImport(sourceFile: ts.SourceFile, predicate: (modulePath: string) => boolean): boolean {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) {
      continue;
    }

    const modulePath = statement.moduleSpecifier.text;
    if (predicate(modulePath)) {
      return true;
    }
  }

  return false;
}

function declarationContainsSignal(declaration: ts.Declaration, predicate: (node: ts.Node) => boolean): boolean {
  let found = false;

  const visit = (node: ts.Node): void => {
    if (found) {
      return;
    }

    if (predicate(node)) {
      found = true;
      return;
    }

    ts.forEachChild(node, visit);
  };

  visit(declaration);
  return found;
}

function hasJsxInDeclaration(declaration: ts.Declaration): boolean {
  return declarationContainsSignal(
    declaration,
    (node) =>
      ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node) || ts.isJsxFragment(node)
  );
}

function hasCreateContextCall(declaration: ts.Declaration): boolean {
  return declarationContainsSignal(declaration, (node) => {
    if (!ts.isCallExpression(node)) {
      return false;
    }

    if (ts.isIdentifier(node.expression)) {
      return node.expression.text === "createContext";
    }

    return ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "createContext";
  });
}

function hasStyledCall(declaration: ts.Declaration): boolean {
  return declarationContainsSignal(declaration, (node) => {
    if (!ts.isCallExpression(node)) {
      return false;
    }

    if (ts.isIdentifier(node.expression) && node.expression.text === "styled") {
      return true;
    }

    return ts.isPropertyAccessExpression(node.expression) && ts.isIdentifier(node.expression.expression)
      ? node.expression.expression.text === "styled"
      : false;
  });
}

function getExportSymbol(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  exportSymbol: ts.Symbol
): { symbol: ts.Symbol; importName: string } | null {
  const importName = exportSymbol.getName();

  if ((exportSymbol.flags & ts.SymbolFlags.Alias) !== 0) {
    const aliased = checker.getAliasedSymbol(exportSymbol);
    return {
      symbol: aliased,
      importName
    };
  }

  const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
  if (!moduleSymbol) {
    return null;
  }

  return {
    symbol: exportSymbol,
    importName
  };
}

function keyForDiscoveredResource(resource: Pick<DiscoveredResourceFact, "filePath" | "name">): string {
  return `${resource.filePath}::${resource.name}`;
}

function shouldIgnoreSourceFile(sourceFile: ts.SourceFile, cwd: string): boolean {
  if (sourceFile.isDeclarationFile) {
    return true;
  }

  const relative = normalizeSlashes(path.relative(cwd, sourceFile.fileName));
  return relative.startsWith("../") || relative === "..";
}

export async function discoverTypeScriptResources(
  cwd: string,
  packageName: string,
  options: TypeScriptResourceDiscoveryOptions = {}
): Promise<DiscoveredResourceFact[]> {
  const files = await collectFiles(cwd);
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    strict: true,
    jsx: ts.JsxEmit.ReactJSX,
    skipLibCheck: true,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    resolveJsonModule: true
  });

  const checker = program.getTypeChecker();
  const policy = mergeClassificationPolicy({
    include: options.includeKinds,
    exclude: options.excludeKinds
  });
  const sourceSignalsCache = new Map<string, {
    hasReactImport: boolean;
    hasStorybookImport: boolean;
    hasStyledImport: boolean;
  }>();

  const resolveSourceSignals = (sourceFile: ts.SourceFile): {
    hasReactImport: boolean;
    hasStorybookImport: boolean;
    hasStyledImport: boolean;
  } => {
    const key = sourceFile.fileName;
    const cached = sourceSignalsCache.get(key);
    if (cached) {
      return cached;
    }

    const resolved = {
      hasReactImport: sourceFileHasModuleImport(
        sourceFile,
        (modulePath) => modulePath === "react" || modulePath.startsWith("react/")
      ),
      hasStorybookImport: sourceFileHasModuleImport(
        sourceFile,
        (modulePath) => modulePath.includes("storybook") || modulePath.includes("@stories")
      ),
      hasStyledImport: sourceFileHasModuleImport(
        sourceFile,
        (modulePath) =>
          modulePath === "styled-components" ||
          modulePath === "@emotion/styled" ||
          modulePath.includes("styled")
      )
    };

    sourceSignalsCache.set(key, resolved);
    return resolved;
  };

  const resources = new Map<string, DiscoveredResourceFact>();

  for (const sourceFile of program.getSourceFiles()) {
    if (shouldIgnoreSourceFile(sourceFile, cwd)) {
      continue;
    }

    const relativePath = normalizeSlashes(path.relative(cwd, sourceFile.fileName));
    const moduleSymbol = checker.getSymbolAtLocation(sourceFile);
    if (!moduleSymbol) {
      continue;
    }

    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      const resolved = getExportSymbol(checker, sourceFile, exported);
      if (!resolved) {
        continue;
      }

      const declaration = resolved.symbol.valueDeclaration ?? resolved.symbol.declarations?.[0];
      if (!declaration) {
        continue;
      }

      const declarationFile = declaration.getSourceFile();
      if (shouldIgnoreSourceFile(declarationFile, cwd)) {
        continue;
      }

      const declarationSourceSignals = resolveSourceSignals(declarationFile);

      const declarationFilePath = normalizeSlashes(path.relative(cwd, declarationFile.fileName));
      const name = resolved.symbol.getName();

      const signals: SemanticResourceSignals = {
        name,
        filePath: declarationFilePath,
        isPublicExport: true,
        hasReactImport: declarationSourceSignals.hasReactImport,
        hasJsx: hasJsxInDeclaration(declaration),
        hasCreateContextCall: hasCreateContextCall(declaration),
        hasStyledImport: declarationSourceSignals.hasStyledImport,
        hasStyledCall: hasStyledCall(declaration),
        hasStorybookImport: declarationSourceSignals.hasStorybookImport,
        extension: path.extname(declarationFilePath)
      };

      const classification = classifyResource(signals, policy);
      const candidate: DiscoveredResourceFact = {
        name,
        filePath: declarationFilePath,
        importName: resolved.importName,
        packageName,
        classification
      };

      const key = keyForDiscoveredResource(candidate);
      const previous = resources.get(key);
      if (!previous || candidate.classification.confidence > previous.classification.confidence) {
        resources.set(key, candidate);
      }
    }
  }

  return [...resources.values()].sort((a, b) => {
    const byFile = a.filePath.localeCompare(b.filePath);
    if (byFile !== 0) {
      return byFile;
    }
    return a.name.localeCompare(b.name);
  });
}

export async function extractTypeScriptComponents(
  cwd: string,
  packageName: string,
  options: TypeScriptResourceDiscoveryOptions = {}
): Promise<ExtractedComponentFact[]> {
  const resources = await discoverTypeScriptResources(cwd, packageName, options);

  return resources
    .filter((resource) => resource.classification.generateDescriptor)
    .map((resource) => ({
      name: resource.name,
      filePath: resource.filePath,
      importName: resource.importName,
      packageName: resource.packageName,
      props: {}
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
