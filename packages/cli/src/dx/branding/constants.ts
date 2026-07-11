export const CLI_BRAND = "Mimir CLI";
export const CLI_BINARY_NAME = "mimir";
export const CLI_PROTOCOL_NAME = "APS Protocol";
export const CLI_REPOSITORY_URL = "https://github.com/SeaBassLab/mimir";
export const CLI_DOC_RELATIVE_PATH = "README.md";

export function cliCommand(command?: string): string {
  return command ? `${CLI_BINARY_NAME} ${command}` : CLI_BINARY_NAME;
}
