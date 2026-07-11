import { Command } from "commander";
import { runDiscovery } from "@mimir/core";
import { attachCommandHelp } from "../dx/help/attach-command-help";
import {
  errorMessage,
  EXIT_CODES,
  printJson,
  setExitCode,
  success,
  warn
} from "../dx/output/cli-output";
import { shouldEmitJson } from "../dx/runtime/options";

function printDiscoverySummary(providers: Awaited<ReturnType<typeof runDiscovery>>["providers"]): void {
  if (providers.length === 0) {
    success("no APS providers found");
    return;
  }

  success(`found ${providers.length} APS provider(s)`);

  for (const provider of providers) {
    console.log(provider.name);

    if (provider.resourceCounts.length === 0) {
      console.log("  resources: 0");
    } else {
      for (const item of provider.resourceCounts) {
        console.log(`  ${item.key}: ${item.count}`);
      }
    }

    if (provider.warnings.length > 0) {
      for (const warning of provider.warnings) {
        warn(`${provider.name}: ${warning}`);
      }
    }

    console.log("");
  }
}

export function registerDiscoverCommand(program: Command): void {
  const command = program
    .command("discover")
    .description("Discover APS-enabled dependencies and load APS manifests")
    .option("--json", "Emit machine-readable discovery result")
    .action(async (options: { json?: boolean }) => {
      try {
        const result = await runDiscovery(process.cwd());

        if (shouldEmitJson(options.json)) {
          printJson({
            command: "discover",
            ok: true,
            providers: result.providers,
            unresolvedDependencies: result.unresolvedDependencies
          });
          return;
        }

        printDiscoverySummary(result.providers);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (shouldEmitJson(options.json)) {
          printJson({ command: "discover", ok: false, error: message });
        } else {
          errorMessage(`discovery failed: ${message}`);
        }
        setExitCode(EXIT_CODES.GENERAL_ERROR);
      }
    });

  attachCommandHelp(command, "discover");
}
