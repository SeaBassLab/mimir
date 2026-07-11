import { Command } from "commander";
import { attachCommandHelp } from "../help/attach-command-help";
import {
  buildBashCompletionScript,
  buildFishCompletionScript,
  buildPowerShellCompletionScript,
  buildZshCompletionScript
} from "./scripts";
import { CLI_BINARY_NAME } from "../branding/constants";
import { errorMessage, EXIT_CODES, setExitCode } from "../output/cli-output";

type SupportedShell = "bash" | "zsh" | "fish" | "powershell";

function isSupportedShell(value: string): value is SupportedShell {
  return value === "bash" || value === "zsh" || value === "fish" || value === "powershell";
}

function buildScript(shell: SupportedShell): string {
  switch (shell) {
    case "bash":
      return buildBashCompletionScript();
    case "zsh":
      return buildZshCompletionScript();
    case "fish":
      return buildFishCompletionScript();
    case "powershell":
      return buildPowerShellCompletionScript();
    default:
      return "";
  }
}

export function registerCompletionCommand(program: Command): void {
  const command = program
    .command("completion [shell]")
    .description("Print shell completion scripts")
    .action((shell?: string) => {
      if (!shell) {
        errorMessage(`missing shell argument. Use '${CLI_BINARY_NAME} completion <bash|zsh|fish|powershell>'.`);
        setExitCode(EXIT_CODES.USAGE_ERROR);
        return;
      }

      const normalized = shell.trim().toLowerCase();
      if (!isSupportedShell(normalized)) {
        errorMessage(`unsupported shell '${shell}'. Expected: bash, zsh, fish, powershell.`);
        setExitCode(EXIT_CODES.USAGE_ERROR);
        return;
      }

      console.log(buildScript(normalized));
    });

  attachCommandHelp(command, "completion");
}
