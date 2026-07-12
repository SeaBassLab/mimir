import { Command } from "commander";
import { runValidation } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import {
  errorMessage,
  EXIT_CODES,
  printJson,
  setExitCode,
  success,
  warn
} from "../dx/output/cli-output";
import { shouldEmitJson } from "../dx/runtime/options";

export function registerValidateCommand(program: Command): void {
  const command = program
    .command("validate")
    .description("Validate APS compliance for current package")
    .option("--json", "Emit machine-readable validation result")
    .action(async (options: { json?: boolean }) => {
      try {
        const result = await runValidation(process.cwd());

        if (shouldEmitJson(options.json)) {
          printJson({ command: "validate", ok: result.valid, result });
          if (!result.valid) {
            setExitCode(EXIT_CODES.GENERAL_ERROR);
          }
          return;
        }

        success(
          `validation complete (valid=${result.valid}, errors=${result.errors.length}, warnings=${result.warnings.length})`
        );

        if (result.validResources.length > 0) {
          console.log("Resources:");
          for (const resource of result.validResources) {
            console.log(`- ${resource}`);
          }
          console.log("");
        }

        if (result.warnings.length > 0) {
          for (const warning of result.warnings) {
            warn(warning);
          }
        }

        if (result.errors.length > 0) {
          errorMessage("validation failed");
          for (const error of result.errors) {
            console.error(`- [${error.code}] ${error.path}: ${error.message}`);
          }
          setExitCode(EXIT_CODES.GENERAL_ERROR);
          return;
        }

        success("APS validation passed");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "validate", ok: false, error: message });
        } else {
          errorMessage(`validation failed: ${message}`);
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "validate");
}
