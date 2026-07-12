import { Command } from "commander";
import {
  CLI_BINARY_NAME,
  CLI_BRAND,
  CLI_DOC_RELATIVE_PATH,
  CLI_PROTOCOL_NAME,
  CLI_REPOSITORY_URL,
  cliCommand
} from "../branding/constants";
import { attachCommandHelp } from "../help/attach-command-help";
import { printJson } from "../output/cli-output";
import { shouldEmitJson } from "../runtime/options";

type AboutPayload = {
  brand: string;
  protocol: string;
  binary: string;
  version: string;
  providerWorkflow: string[];
  consumerWorkflow: string[];
  docs: string;
  repository: string;
};

function resolveVersion(command: Command): string {
  const value = command.parent?.version();
  return typeof value === "string" && value.trim() !== "" ? value : "unknown";
}

function buildAboutPayload(command: Command): AboutPayload {
  return {
    brand: CLI_BRAND,
    protocol: CLI_PROTOCOL_NAME,
    binary: CLI_BINARY_NAME,
    version: resolveVersion(command),
    providerWorkflow: [
      cliCommand("init"),
      cliCommand("author"),
      cliCommand("generate"),
      cliCommand("validate"),
      cliCommand("governance"),
      cliCommand("doctor")
    ],
    consumerWorkflow: [
      "npm install <provider-package>",
      cliCommand("discover"),
      cliCommand("sync")
    ],
    docs: CLI_DOC_RELATIVE_PATH,
    repository: CLI_REPOSITORY_URL
  };
}

export function registerAboutCommand(program: Command): void {
  const command = program
    .command("about")
    .description("Show an overview of APS Protocol and Mimir CLI workflows")
    .option("--json", "Emit machine-readable about information")
    .action((options: { json?: boolean }, actionCommand: Command) => {
      const payload = buildAboutPayload(actionCommand);

      if (shouldEmitJson(options.json)) {
        printJson({ command: "about", ok: true, about: payload });
        return;
      }

      console.log(`${payload.brand} (${payload.version})`);
      console.log(`Protocol: ${payload.protocol}`);
      console.log("");
      console.log("What it is:");
      console.log(
        `- ${payload.protocol} is an open specification for publishing structured software knowledge that AI agents can consume consistently.`
      );
      console.log("");
      console.log("Provider workflow:");
      for (const step of payload.providerWorkflow) {
        console.log(`- ${step}`);
      }
      console.log("- publish package");
      console.log("");
      console.log("Consumer workflow:");
      for (const step of payload.consumerWorkflow) {
        console.log(`- ${step}`);
      }
      console.log("");
      console.log("Docs:");
      console.log(`- ${payload.docs}`);
      console.log("Repository:");
      console.log(`- ${payload.repository}`);
    });

  attachCommandHelp(command, "about");
}
