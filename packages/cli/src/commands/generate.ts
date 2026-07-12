import { Command } from "commander";
import { runGeneration } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import path from "node:path";
import {
  errorWithResolution,
  errorMessage,
  EXIT_CODES,
  info,
  printJson,
  setExitCode,
  success,
  warn
} from "../dx/output/cli-output";
import { isDryRun, shouldEmitJson } from "../dx/runtime/options";

function isNoDescriptorsFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "NO_DESCRIPTORS_FOUND"
  );
}

function printNoDescriptorsMessage(): void {
  console.log("No descriptors found.");
  console.log("");
  console.log("Run:");
  console.log("    mimir author");
  console.log("");
  console.log("Then:");
  console.log("    mimir generate");
}

export function registerGenerateCommand(program: Command): void {
  const command = program
    .command("generate")
    .description("Compile APS resources from descriptor contracts")
    .option("--json", "output machine-readable JSON")
    .option("--force", "replace existing generated resources in dist/aps")
    .action(async (options: { json?: boolean; force?: boolean }) => {
      const startedAt = Date.now();
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
        const durationMs = Date.now() - startedAt;

        if (shouldEmitJson(options.json)) {
          printJson({
            command: "generate",
            ok: report.validate.valid && Boolean(report.governance?.valid ?? true),
            durationMs,
            report
          });
        } else {
          success("generation complete");
          info(`Descriptors compiled: ${report.descriptorsCompiled}`);
          info(`Resources generated: ${report.generatedResources}`);
          info(
            `Validation: ${report.validate.valid ? "PASS" : "FAIL"} (${report.validate.errors.length} errors, ${report.validate.warnings.length} warnings)`
          );
          info(
            `Governance: ${report.governance?.valid ? "PASS" : "FAIL"} (${report.governance?.errors.length ?? 0} errors, ${report.governance?.warnings.length ?? 0} warnings)`
          );
          info(`Total time: ${durationMs}ms`);

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

        if (!report.validate.valid || !Boolean(report.governance?.valid ?? true)) {
          setExitCode(EXIT_CODES.GENERAL_ERROR);
        }
      } catch (error) {
        if (isNoDescriptorsFoundError(error)) {
          if (shouldEmitJson(options.json)) {
            printJson({
              command: "generate",
              ok: false,
              error: {
                what: "No descriptors found.",
                why: "Generation compiles from *.mimir.yaml descriptors and none were discovered.",
                howToFix: "Run 'mimir author' and then 'mimir generate'."
              }
            });
          } else {
            printNoDescriptorsMessage();
          }
          setExitCode(EXIT_CODES.GENERAL_ERROR);
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "generate", ok: false, error: message });
        } else {
          errorWithResolution({
            what: "Generate failed.",
            why: message,
            howToFix: "Fix the reported issue and run 'mimir generate' again. If output exists already, use '--force' to replace it."
          });
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "generate");
}
