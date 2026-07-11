import type { GenerateReport } from "../generation/types";
import { resolveGenerator } from "../generators";

type GenerateOptions = {
  force?: boolean;
  generator?: string;
};

export async function runGeneration(cwd: string, options: GenerateOptions = {}): Promise<GenerateReport> {
  const generator = resolveGenerator(options.generator);
  const result = await generator.generate(cwd, { force: options.force });
  return result as GenerateReport;
}
