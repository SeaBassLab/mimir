import type { DxCommandMeta } from "../command-registry";
import { CLI_BINARY_NAME } from "../branding/constants";

function formatFlags(flags: DxCommandMeta["flags"]): string[] {
  if (flags.length === 0) {
    return ["Flags:", "- none", ""];
  }

  return [
    "Flags:",
    ...flags.map((flag) => `- ${flag.name}: ${flag.description}`),
    ""
  ];
}

function formatExamples(examples: string[]): string[] {
  if (examples.length === 0) {
    return ["Examples:", "- none", ""];
  }

  return ["Examples:", ...examples.map((example) => `- ${example}`), ""];
}

function formatExitCodes(exitCodes: DxCommandMeta["exitCodes"]): string[] {
  if (exitCodes.length === 0) {
    return ["Exit codes:", "- not defined", ""];
  }

  return [
    "Exit codes:",
    ...exitCodes.map((exitCode) => `- ${exitCode.code}: ${exitCode.meaning}`),
    ""
  ];
}

function formatNotes(notes: string[]): string[] {
  if (notes.length === 0) {
    return ["Notes:", "- none", ""];
  }

  return ["Notes:", ...notes.map((note) => `- ${note}`), ""];
}

export function formatDetailedHelp(meta: DxCommandMeta): string {
  const lines: string[] = [
    "",
    `Name: ${CLI_BINARY_NAME} ${meta.name}`,
    `Usage: ${meta.usage}`,
    "",
    `Description: ${meta.description}`,
    "",
    ...formatFlags(meta.flags),
    ...formatExamples(meta.examples),
    ...formatExitCodes(meta.exitCodes),
    ...formatNotes(meta.notes)
  ];

  return lines.join("\n").trimEnd();
}
