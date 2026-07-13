import path from "node:path";
import { upsertManagedSection } from "../managed-section";
import type { AgentAdapter } from "../types";

export const copilotAdapter: AgentAdapter = {
  name: "copilot",
  async sync(context) {
    const targetPath = path.join(context.cwd, ".github", "copilot-instructions.md");
    const { changed, created } = await upsertManagedSection(targetPath, [
      "## APS Context",
      "",
      "Before using an installed library, read .agents/aps/index.md and follow its intent routing.",
      "Treat published imports and APIs as authoritative; do not invent unavailable knowledge."
    ]);

    return {
      adapter: "copilot",
      target: targetPath,
      changed,
      created,
      message: created
        ? "Copilot instructions created"
        : changed
          ? "Copilot instructions APS section updated"
          : "Copilot instructions already synchronized",
      warnings: []
    };
  }
};
