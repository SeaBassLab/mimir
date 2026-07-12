import { Command } from "commander";
import { prepareApsConfig } from "@mimir-labs/core";
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

export function registerInitCommand(program: Command): void {
  const command = program
    .command("init")
    .description("Initialize APS support in package.json")
    .option("--json", "Emit machine-readable result")
    .action(async (options: { json?: boolean }) => {
      try {
        if (isDryRun()) {
          const payload = {
            command: "init",
            dryRun: true,
            ok: true,
            plan: ["prepare aps configuration in package.json"]
          };
          if (shouldEmitJson(options.json)) {
            printJson(payload);
          } else {
            success("dry-run: would prepare APS configuration in package.json");
          }
          return;
        }

        const result = await prepareApsConfig(process.cwd());

        if (!result.changed) {
          if (shouldEmitJson(options.json)) {
            printJson({ command: "init", ok: true, changed: false, warnings: [] });
          } else {
            success("APS config already present in package.json. No changes made.");
          }
          return;
        }

        if (result.legacyAiDetected) {
          warn("legacy 'ai' configuration detected. 'aps' has been prepared.");
        }

        if (shouldEmitJson(options.json)) {
          printJson({
            command: "init",
            ok: true,
            changed: true,
            warnings: result.legacyAiDetected ? ["legacy-ai-configuration-detected"] : []
          });
        } else {
          success("APS configuration prepared in package.json.");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "init", ok: false, error: message });
        } else {
          errorMessage(`init failed: ${message}`);
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "init");
}
