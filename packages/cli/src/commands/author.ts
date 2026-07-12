import { Command } from "commander";
import { runAuthoringWorkflow } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
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
import { isDryRun, isVerbose, shouldEmitJson } from "../dx/runtime/options";

function printFiles(label: string, files: string[]): void {
  info(`${label}:`);
  if (files.length === 0) {
    info("- none");
    return;
  }

  for (const file of files) {
    info(`- ${file}`);
  }
}

export function registerAuthorCommand(program: Command): void {
  const command = program
    .command("author")
    .description("Sync *.mimir.yaml descriptors (auto block) and preserve human authoring")
    .option("--json", "Emit machine-readable authoring result")
    .option("--dry-run", "Show descriptor sync plan without writing files")
    .option("--delete-orphans", "Delete orphaned descriptor resources during sync")
    .option("--no-refresh-auto", "Skip automatic descriptor field refresh")
    .option("--interactive", "Reserved for future guided human authoring mode")
    .option("--ai", "Reserved for future AI-assisted human authoring mode")
    .action(
      async (options: {
        json?: boolean;
        deleteOrphans?: boolean;
        refreshAuto?: boolean;
        interactive?: boolean;
        ai?: boolean;
      }) => {
      try {
        const report = await runAuthoringWorkflow(process.cwd(), {
          dryRun: isDryRun(),
          deleteOrphans: Boolean(options.deleteOrphans),
          refreshAuto: options.refreshAuto !== false,
          interactive: Boolean(options.interactive),
          ai: Boolean(options.ai)
        });

        if (shouldEmitJson(options.json)) {
          printJson({ command: "author", ok: true, report });
          return;
        }

        if (report.dryRun) {
          success("descriptor sync plan ready");
          info(`Resources discovered: ${report.discoveredResources}`);
          info(`Created: ${report.createdFiles.length}`);
          info(`Updated: ${report.updatedFiles.length}`);
          info(`Existing: ${report.existingFiles.length}`);
          info(`Orphans: ${report.orphanedResources.length}`);
          info(`Planned writes: ${report.plannedFiles.length}`);
        } else {
          success("Descriptor sync complete");
          info(`Resources discovered: ${report.discoveredResources}`);
          info(`Created: ${report.createdFiles.length}`);
          info(`Updated: ${report.updatedFiles.length}`);
          info(`Existing: ${report.existingFiles.length}`);
          info(`Orphans: ${report.orphanedResources.length}`);
        }

        if (isVerbose()) {
          if (report.dryRun) {
            printFiles("Would write", report.plannedFiles);
          } else {
            printFiles("Created", report.createdFiles);
            printFiles("Updated", report.updatedFiles);
            printFiles("Existing", report.existingFiles);
          }

          if (report.orphanedResources.length > 0) {
            printFiles("Orphaned", report.orphanedResources);
          }

          if (report.deletedOrphans.length > 0) {
            printFiles("Deleted orphans", report.deletedOrphans);
          }
        }

        if (report.warnings.length > 0) {
          for (const message of report.warnings) {
            warn(message);
          }
        }

        if (report.createdFiles.length > 0 || report.updatedFiles.length > 0) {
          console.log("");
          console.log("Run:");
          console.log("    mimir generate");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "author", ok: false, error: message });
        } else {
          errorWithResolution({
            what: "Author failed.",
            why: message,
            howToFix: "Fix the descriptor/source issue reported and run 'mimir author' again."
          });
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    }
    );

  attachCommandHelp(command, "author");
}
