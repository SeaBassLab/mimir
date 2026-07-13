import path from "node:path";
import { fileExists, readText, writeText } from "../io/fs";

const APS_START_MARKER = "<!-- APS:START -->";
const APS_END_MARKER = "<!-- APS:END -->";

export function renderApsManagedSection(): string {
  return [
    APS_START_MARKER,
    "",
    "## APS Context",
    "",
    "Generated AI package knowledge:",
    "",
    "Before using an installed library, read .agents/aps/index.md and follow its intent routing.",
    "Treat published imports and APIs as authoritative; do not invent unavailable knowledge.",
    "",
    APS_END_MARKER
  ].join("\n");
}

export async function upsertAgentsMd(cwd: string): Promise<void> {
  const agentsPath = path.join(cwd, "AGENTS.md");
  const section = renderApsManagedSection();

  if (!(await fileExists(agentsPath))) {
    await writeText(agentsPath, `${section}\n`);
    return;
  }

  const current = await readText(agentsPath);
  const startIndex = current.indexOf(APS_START_MARKER);
  const endIndex = current.indexOf(APS_END_MARKER);

  if (startIndex >= 0 && endIndex > startIndex) {
    const before = current.slice(0, startIndex).trimEnd();
    const after = current.slice(endIndex + APS_END_MARKER.length).trimStart();
    const parts = [before, section, after].filter((part) => part.length > 0);
    await writeText(agentsPath, `${parts.join("\n\n")}\n`);
    return;
  }

  const merged = `${current.trimEnd()}\n\n${section}\n`;
  await writeText(agentsPath, merged);
}
