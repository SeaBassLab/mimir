import path from "node:path";
import { upsertManagedSection } from "../managed-section";
import type { AgentAdapter } from "../types";

export const agentsMdAdapter: AgentAdapter = {
  name: "agents-md",
  async sync(context) {
    const targetPath = path.join(context.cwd, "AGENTS.md");
    const { changed, created } = await upsertManagedSection(targetPath, [
      "## APS Context",
      "",
      "Generated AI package knowledge:",
      "",
      "Read:",
      "- .agents/aps/index.md"
    ]);

    return {
      adapter: "agents-md",
      target: targetPath,
      changed,
      created,
      message: created
        ? "AGENTS.md created"
        : changed
          ? "AGENTS.md APS section updated"
          : "AGENTS.md already synchronized",
      warnings: []
    };
  }
};
