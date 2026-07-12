import { Command } from "commander";
import { runGeneration } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import path from "node:path";
import {
  errorMessage,
  EXIT_CODES,
  printJson,
  setExitCode,
  success,
  warn
} from "../dx/output/cli-output";
import { isDryRun, shouldEmitJson } from "../dx/runtime/options";

export function registerGenerateCommand(program: Command): void {
  const command = program
    .command("generate")
    .description("Compile APS resources from descriptor contracts")
    .option("--json", "output machine-readable JSON")
    .option("--force", "replace existing generated resources in dist/aps")
    .action(async (options: { json?: boolean; force?: boolean }) => {
      try {
        if (isDryRun()) {
          const payload = {
            command: "generate",
            dryRun: true,
            ok: true,
            force: Boolean(options.force),
            outputDir: path.join(process.cwd(), "dist", "aps")
          };
          if (shouldEmitJson(options.json)) {
            printJson(payload);
          } else {
            success(`dry-run: would generate APS resources in ${payload.outputDir}`);
          }
          return;
        }

        const report = await runGeneration(process.cwd(), {
          force: options.force
        });

        if (shouldEmitJson(options.json)) {
          printJson({ command: "generate", ok: report.validate.valid, report });
        } else {
          success(`generated APS resources in ${report.outputDir}`);
          console.log(`- generated resources: ${report.generatedResources}`);
          console.log(`- validation valid: ${report.validate.valid}`);
          console.log(`- governance valid: ${report.governance?.valid ?? false}`);

          if (report.warnings.length > 0) {
            for (const warning of report.warnings) {
              warn(warning);
            }
          }

          if (report.missingHumanMetadata.length > 0) {
            warn("human metadata is incomplete for some components");
            console.log("Expected human metadata fields: description, whenToUse, whenNotToUse.");
            console.log("Run 'mimir author' and complete the generated *.mimir.yaml descriptor files.");
            console.log("A README description remains the fallback when authored description is empty.");
            console.log("Missing human metadata for components:");
            for (const name of report.missingHumanMetadata) {
              console.log(`- ${name}`);
            }
          }

          if (report.validate.errors.length > 0) {
            console.log("Validation errors:");
            for (const issue of report.validate.errors) {
              console.log(`- [${issue.code}] ${issue.path}: ${issue.message}`);
            }
          }

          if ((report.governance?.errors.length ?? 0) > 0) {
            console.log("Governance errors:");
            for (const issue of report.governance?.errors ?? []) {
              console.log(`- [${issue.code}] ${issue.path}: ${issue.message}`);
            }
          }
        }

        if (!report.validate.valid) {
          setExitCode(EXIT_CODES.GENERAL_ERROR);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "generate", ok: false, error: message });
        } else {
          errorMessage(`generate failed: ${message}`);
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "generate");
}
