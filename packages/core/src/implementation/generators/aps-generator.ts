import { compileApsFromDescriptors } from "../generation/generate-service";
import type { GenerateReport } from "../generation/types";
import type { MimirGenerator } from "./types";

type ApsGenerateOptions = {
  force?: boolean;
};

export const apsGenerator: MimirGenerator<ApsGenerateOptions, GenerateReport> = {
  name: "aps",
  async generate(cwd: string, options?: ApsGenerateOptions): Promise<GenerateReport> {
    return compileApsFromDescriptors(cwd, options ?? {});
  }
};
