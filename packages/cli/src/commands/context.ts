import { Command } from "commander";
import { runContextWorkflow } from "@mimir-labs/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import {
  errorWithResolution,
  EXIT_CODES,
  printJson,
  setExitCode,
  success
} from "../dx/output/cli-output";
import { isDryRun, shouldEmitJson } from "../dx/runtime/options";

export function registerContextCommand(program: Command): void {
  const command = program
    .command("context")
    .description("Generate AI agent context from discovered APS packages")
    .option("--json", "Emit machine-readable context result")
    .action(async (options: { json?: boolean }) => {
      try {
        if (isDryRun()) {
          const payload = {
            command: "context",
            dryRun: true,
            ok: true,
            plan: ["discover providers", "generate context files", "update AGENTS.md managed section"]
          };
          if (shouldEmitJson(options.json)) {
            printJson(payload);
          } else {
            success("dry-run: would generate context files and update AGENTS.md");
          }
          return;
        }

        const result = await runContextWorkflow(process.cwd());

        if (shouldEmitJson(options.json)) {
          printJson({ command: "context", ok: true, result });
          return;
        }

        success(`context generated in ${result.outputDir}`);
        for (const file of result.files) {
          console.log(`- ${file}`);
        }
        success("AGENTS.md updated with APS managed section");
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "context", ok: false, error: message });
        } else {
          errorWithResolution({
            what: "Context generation failed.",
            why: message,
            howToFix: "Fix the reported configuration/discovery issue and run 'mimir context' again."
          });
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "context");
}
