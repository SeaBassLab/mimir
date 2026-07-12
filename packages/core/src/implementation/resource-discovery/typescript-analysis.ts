import path from "node:path";
import { readdir } from "node:fs/promises";
import ts from "typescript";

const TS_EXTENSIONS = new Set([".ts", ".tsx"]);

export type TypeScriptAnalysis = {
  cwd: string;
  program: ts.Program;
  checker: ts.TypeChecker;
};

async function collectFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist" || entry.name.startsWith(".")) continue;
      files.push(...(await collectFiles(absolutePath)));
    } else if (entry.isFile() && TS_EXTENSIONS.has(path.extname(entry.name))) {
      files.push(absolutePath);
    }
  }
  return files;
}

export async function createTypeScriptAnalysis(cwd: string): Promise<TypeScriptAnalysis> {
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
  return { cwd, program, checker: program.getTypeChecker() };
}
