import { Command } from "commander";
import { runGovernanceValidation } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import {
  errorWithResolution,
  errorMessage,
  EXIT_CODES,
  printJson,
  setExitCode,
  success,
  warn
} from "../dx/output/cli-output";
import { shouldEmitJson } from "../dx/runtime/options";

export function registerGovernanceCommand(program: Command): void {
  const command = program
    .command("governance")
    .description("Validate APS governance compliance")
    .option("--json", "Emit machine-readable governance result")
    .action(async (options: { json?: boolean }) => {
      try {
        const result = await runGovernanceValidation(process.cwd());

        if (shouldEmitJson(options.json)) {
          printJson({ command: "governance", ok: result.valid, result });
          if (!result.valid) {
            setExitCode(EXIT_CODES.GENERAL_ERROR);
          }
          return;
        }

        success("governance validation complete");
        console.log(`- valid: ${result.valid}`);
        console.log(`- errors: ${result.errors.length}`);
        console.log(`- warnings: ${result.warnings.length}`);
        console.log(`- resources checked: ${result.metrics.resourcesChecked}`);
        console.log(`- evidence coverage: ${result.metrics.evidenceCoverage}%`);
        console.log(`- provenance coverage: ${result.metrics.provenanceCoverage}%`);

        if (result.warnings.length > 0) {
          for (const warning of result.warnings) {
            warn(`[${warning.code}] ${warning.path}: ${warning.message}`);
          }
        }

        if (result.errors.length > 0) {
          errorMessage("governance validation failed");
          for (const error of result.errors) {
            console.error(`- [${error.code}] ${error.path}: ${error.message}`);
          }
          setExitCode(EXIT_CODES.GENERAL_ERROR);
          return;
        }

        success("APS governance validation passed");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "governance", ok: false, error: message });
        } else {
          errorWithResolution({
            what: "Governance validation failed.",
            why: message,
            howToFix: "Fix governance issues shown in output and run 'mimir governance' again."
          });
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "governance");
}
