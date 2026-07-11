import { Command } from "commander";
import { attachCommandHelp } from "./attach-command-help";
import { findCommandMeta, getCommandRegistry, listVisibleCommandNames } from "../command-registry";
import { formatDetailedHelp } from "./formatter";
import {
  CLI_BRAND,
  CLI_DOC_RELATIVE_PATH,
  CLI_PROTOCOL_NAME,
  CLI_BINARY_NAME,
  cliCommand
} from "../branding/constants";
import { errorMessage, EXIT_CODES, setExitCode } from "../output/cli-output";

function printGeneralHelp(): void {
  const registry = getCommandRegistry().filter((command) => !command.hidden);

  console.log(CLI_BRAND);
  console.log(`Reference implementation CLI for the ${CLI_PROTOCOL_NAME}`);
  console.log("");
  console.log("Commands:");

  const maxLen = Math.max(...registry.map((command) => command.name.length));
  for (const command of registry) {
    const padded = command.name.padEnd(maxLen, " ");
    console.log(`- ${padded}  ${command.description}`);
  }

  console.log("");
  console.log("Quick examples:");
  console.log(`- ${cliCommand("about")}`);
  console.log(`- ${cliCommand("init")}`);
  console.log(`- ${cliCommand("generate")} --force`);
  console.log(`- ${cliCommand("validate")}`);
  console.log(`- ${cliCommand("governance")} --json`);
  console.log(`- ${cliCommand("doctor")} --json`);
  console.log(`- ${cliCommand("completion")} zsh`);
  console.log("");
  console.log("Docs:");
  console.log(`- ${CLI_DOC_RELATIVE_PATH}`);
  console.log("");
  console.log("Global options:");
  console.log("- --json      Emit deterministic JSON output");
  console.log("- --dry-run   Show planned actions without changing files");
  console.log("- --verbose   Enable verbose output");
  console.log("- --quiet     Suppress non-error output");
  console.log("");
  console.log(`Use '${cliCommand("help")} <command>' for detailed command help.`);
}

export function registerHelpCommand(program: Command): void {
  const command = program
    .command("help [commandName]")
    .description("Show Mimir CLI help")
    .action((commandName?: string) => {
      if (!commandName || commandName.trim() === "") {
        printGeneralHelp();
        return;
      }

      const target = program.commands.find(
        (candidate) =>
          candidate.name() === commandName ||
          candidate.aliases().includes(commandName) ||
          (commandName === "help" && candidate.name() === "help")
      );

      if (!target) {
        errorMessage(`unknown command '${commandName}'.`);
        console.error(`Available commands: ${listVisibleCommandNames().join(", ")}`);
        setExitCode(EXIT_CODES.USAGE_ERROR);
        return;
      }

      const baseHelp = target.helpInformation();
      const meta = findCommandMeta(commandName);
      if (!meta) {
        console.log(baseHelp);
        return;
      }

      const details = formatDetailedHelp(meta);
      const alreadyIncludesDetails = baseHelp.includes(`Name: ${CLI_BINARY_NAME} ${meta.name}`);

      if (alreadyIncludesDetails) {
        console.log(baseHelp);
        return;
      }

      console.log(`${baseHelp.trimEnd()}\n${details}`);
    });

  attachCommandHelp(command, "help");
}
