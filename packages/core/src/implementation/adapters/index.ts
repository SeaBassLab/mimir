import { agentsMdAdapter } from "./agents-md/adapter";
import { copilotAdapter } from "./copilot/adapter";
import { cursorAdapter } from "./cursor/adapter";
import type { AgentAdapter } from "./types";
import { AdapterRegistry } from "./registry";

export type { AgentAdapter, AgentContext, SyncResult } from "./types";

const adapterRegistry = new AdapterRegistry();

adapterRegistry.register(agentsMdAdapter, ["agents"]);
adapterRegistry.register(copilotAdapter);
adapterRegistry.register(cursorAdapter);

export function registerAdapter(adapter: AgentAdapter, aliases: string[] = []): void {
  adapterRegistry.register(adapter, aliases);
}

export function getAdapter(name: string): AgentAdapter | undefined {
  return adapterRegistry.get(name);
}

export function getConfiguredAdapters(adapterConfig: unknown): AgentAdapter[] {
  return adapterRegistry.resolve(adapterConfig);
}
