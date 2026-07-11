import { Command } from "commander";
import { runDoctorAssessment } from "@mimir/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import {
  errorMessage,
  EXIT_CODES,
  printJson,
  setExitCode,
  success
} from "../dx/output/cli-output";
import { shouldEmitJson } from "../dx/runtime/options";

export function registerDoctorCommand(program: Command): void {
  const command = program
    .command("doctor")
    .description("Evaluate APS provider maturity (L0-L3)")
    .option("--json", "output machine-readable JSON")
    .action(async (options: { json?: boolean }) => {
      try {
        const report = await runDoctorAssessment(process.cwd());

        if (shouldEmitJson(options.json)) {
          const anyFail = report.providers.some((provider) => provider.level < provider.maxLevel);
          printJson({ command: "doctor", ok: !anyFail, report });
          if (anyFail) {
            setExitCode(EXIT_CODES.GENERAL_ERROR);
          }
          return;
        }

        if (report.providers.length === 0) {
          errorMessage("no APS providers discovered");
          setExitCode(EXIT_CODES.GENERAL_ERROR);
          return;
        }

        success("doctor report");

        for (const provider of report.providers) {
          console.log(`Provider: ${provider.provider}`);
          console.log(`Maturity: L${provider.level}/${provider.maxLevel}`);

          const failedChecks = provider.checks.filter((check) => check.status === "fail");
          if (failedChecks.length === 0) {
            console.log("Checks: all passed");
          } else {
            console.log("Failed checks:");
            for (const check of failedChecks) {
              console.log(`- ${check.name}: ${check.details}`);
            }
          }

          if (provider.recommendations.length > 0) {
            console.log("Recommendations:");
            for (const recommendation of provider.recommendations) {
              console.log(`- ${recommendation}`);
            }
          }

          console.log("");
        }

        const anyFail = report.providers.some((provider) => provider.level < provider.maxLevel);
        if (anyFail) {
          setExitCode(EXIT_CODES.GENERAL_ERROR);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "doctor", ok: false, error: message });
        } else {
          errorMessage(`doctor failed: ${message}`);
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "doctor");
}
