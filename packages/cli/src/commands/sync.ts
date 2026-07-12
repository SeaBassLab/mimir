import { Command } from "commander";
import { runSyncWorkflow } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import {
  errorWithResolution,
  EXIT_CODES,
  printJson,
  setExitCode,
  success,
  warn
} from "../dx/output/cli-output";
import { isDryRun, shouldEmitJson } from "../dx/runtime/options";

export function registerSyncCommand(program: Command): void {
  const command = program
    .command("sync")
    .description("Synchronize APS context to configured AI agent adapters")
    .option("--json", "Emit machine-readable sync result")
    .action(async (options: { json?: boolean }) => {
      try {
        if (isDryRun()) {
          const payload = {
            command: "sync",
            dryRun: true,
            ok: true,
            plan: ["discover providers", "generate context", "sync configured adapters"]
          };
          if (shouldEmitJson(options.json)) {
            printJson(payload);
          } else {
            success("dry-run: would discover providers, generate context, and sync adapters");
          }
          return;
        }

        const result = await runSyncWorkflow(process.cwd());

        if (shouldEmitJson(options.json)) {
          printJson({ command: "sync", ok: true, result });
          return;
        }

        success("sync complete");
        console.log("Providers:");

        if (result.discovery.providers.length === 0) {
          console.log("- none");
        } else {
          for (const provider of result.discovery.providers) {
            console.log(`- OK ${provider.name}`);
            for (const warning of provider.warnings) {
              warn(`${provider.name}: ${warning}`);
            }
          }
        }

        console.log("");
        console.log("Adapters:");
        for (const adapterResult of result.adapterResults) {
          console.log(`- OK ${adapterResult.message}`);
          for (const warning of adapterResult.warnings) {
            warn(`${adapterResult.adapter}: ${warning}`);
          }
        }

        console.log("");
        console.log("No user content overwritten.");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "sync", ok: false, error: message });
        } else {
          errorWithResolution({
            what: "Sync failed.",
            why: message,
            howToFix: "Fix adapter/discovery errors and run 'mimir sync' again."
          });
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "sync");
}
