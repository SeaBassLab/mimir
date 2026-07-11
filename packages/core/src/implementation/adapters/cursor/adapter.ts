import path from "node:path";
import { upsertManagedSection } from "../managed-section";
import type { AgentAdapter } from "../types";

export const cursorAdapter: AgentAdapter = {
  name: "cursor",
  async sync(context) {
    const targetPath = path.join(context.cwd, ".cursor", "rules", "aps.mdc");
    const { changed, created } = await upsertManagedSection(targetPath, [
      "# APS Context",
      "",
      "Read generated APS knowledge:",
      "- .agents/aps/index.md"
    ]);

    return {
      adapter: "cursor",
      target: targetPath,
      changed,
      created,
      message: created
        ? "Cursor APS rule created"
        : changed
          ? "Cursor APS rule updated"
          : "Cursor APS rule already synchronized",
      warnings: []
    };
  }
};
