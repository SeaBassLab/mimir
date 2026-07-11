import type { Command } from "commander";
import { findCommandMeta } from "../command-registry";
import { formatDetailedHelp } from "./formatter";

export function attachCommandHelp(command: Command, commandName: string): void {
  const meta = findCommandMeta(commandName);
  if (!meta) {
    return;
  }

  command.addHelpText("after", formatDetailedHelp(meta));
}
