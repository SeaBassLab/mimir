import { Command } from "commander";
import { runAuthoringWorkflow } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import {
  errorMessage,
  EXIT_CODES,
  printJson,
  setExitCode,
  success
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
    .description("Create human knowledge authoring files for discovered APS resources")
    .option("--json", "Emit machine-readable authoring result")
    .option("--dry-run", "Show missing authoring files without creating them")
    .action(async (options: { json?: boolean }) => {
      try {
        const report = await runAuthoringWorkflow(process.cwd(), {
          dryRun: isDryRun()
        });

        if (shouldEmitJson(options.json)) {
          printJson({ command: "author", ok: true, report });
          return;
        }

        if (report.dryRun) {
          success("dry-run: authoring plan ready");
          console.log(`Discovered resources: ${report.discoveredResources}`);
          printFiles("Would create", report.plannedFiles);
        } else {
          success(`authoring files ready in ${report.outputDir}`);
          console.log(`Discovered resources: ${report.discoveredResources}`);
          printFiles("Created", report.createdFiles);
        }

        printFiles("Existing", report.existingFiles);
        console.log("");
        console.log("No existing authoring files were modified.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "author", ok: false, error: message });
        } else {
          errorMessage(`author failed: ${message}`);
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "author");
}
