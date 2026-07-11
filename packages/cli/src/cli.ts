import { Command } from "commander";
import { registerContextCommand } from "./commands/context";
import { registerDiscoverCommand } from "./commands/discover";
import { registerGenerateCommand } from "./commands/generate";
import { registerGovernanceCommand } from "./commands/governance";
import { registerInitCommand } from "./commands/init";
import { registerSyncCommand } from "./commands/sync";
import { registerValidateCommand } from "./commands/validate";
import { registerDoctorCommand } from "./commands/doctor";
import { registerHelpCommand } from "./dx/help/command";
import { registerCompletionCommand } from "./dx/completion/command";
import { CLI_BINARY_NAME, CLI_PROTOCOL_NAME } from "./dx/branding/constants";
import { registerAboutCommand } from "./dx/about/command";
import { configureRuntimeOptions } from "./dx/runtime/options";

export async function runCli(argv: string[]): Promise<void> {
  configureRuntimeOptions(argv);

  const program = new Command();

  program
    .name(CLI_BINARY_NAME)
    .description(`Reference implementation CLI for the ${CLI_PROTOCOL_NAME}`)
    .version("1.0.0");

  program.option("--json", "Emit deterministic JSON output");
  program.option("--verbose", "Enable verbose output");
  program.option("--quiet", "Suppress non-error output");
  program.option("--dry-run", "Show planned actions without changing files");
  program.showSuggestionAfterError(true);
  program.showHelpAfterError();

  program.helpCommand(false);

  registerInitCommand(program);
  registerDiscoverCommand(program);
  registerContextCommand(program);
  registerValidateCommand(program);
  registerGovernanceCommand(program);
  registerDoctorCommand(program);
  registerGenerateCommand(program);
  registerSyncCommand(program);
  registerAboutCommand(program);
  registerCompletionCommand(program);
  registerHelpCommand(program);

  await program.parseAsync(argv);
}
