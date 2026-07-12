import { Command } from "commander";
import { runAuthoringWorkflow } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import {
  errorMessage,
  EXIT_CODES,
  printJson,
  setExitCode,
  success,
  warn
} from "../dx/output/cli-output";
import { isDryRun, shouldEmitJson } from "../dx/runtime/options";

function printFiles(label: string, files: string[]): void {
  console.log(`${label}:`);
  if (files.length === 0) {
    console.log("- none");
    return;
  }

  for (const file of files) {
    console.log(`- ${file}`);
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
          success("dry-run: authoring sync plan ready");
          console.log(`Discovered resources: ${report.discoveredResources}`);
          printFiles("Would write", report.plannedFiles);
        } else {
          success("descriptor sync complete");
          console.log(`Discovered resources: ${report.discoveredResources}`);
          printFiles("Created", report.createdFiles);
          printFiles("Updated", report.updatedFiles);
        }

        printFiles("Existing", report.existingFiles);

        if (report.orphanedResources.length > 0) {
          printFiles("Orphaned", report.orphanedResources);
        }

        if (report.deletedOrphans.length > 0) {
          printFiles("Deleted orphans", report.deletedOrphans);
        }

        if (report.warnings.length > 0) {
          for (const message of report.warnings) {
            warn(message);
          }
        }

        console.log("");
        console.log("Human fields were preserved. Only auto fields were synchronized.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "author", ok: false, error: message });
        } else {
          errorMessage(`author failed: ${message}`);
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    }
    );

  attachCommandHelp(command, "author");
}
