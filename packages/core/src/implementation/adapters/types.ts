import type { DiscoveredProvider } from "../configuration/manifest-loader";

export type AgentContext = {
  cwd: string;
  contextDir: string;
  contextFiles: string[];
  providers: DiscoveredProvider[];
};

export type SyncResult = {
  adapter: string;
  target: string;
  changed: boolean;
  created: boolean;
  message: string;
  warnings: string[];
};

export interface AgentAdapter {
  name: string;
  sync(context: AgentContext): Promise<SyncResult>;
}
