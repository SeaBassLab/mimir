import { getAdapter } from "../adapters";
import { discoverProviders } from "../dependency-discovery/discover-providers";
import { generateContext } from "../synchronization/context-generator";

export async function runContextWorkflow(cwd: string) {
  const discovery = await discoverProviders(cwd);
  const context = await generateContext(cwd, discovery);

  const agentsAdapter = getAdapter("agents-md");
  if (!agentsAdapter) {
    throw new Error("agents-md adapter is not registered");
  }

  await agentsAdapter.sync({
    cwd,
    contextDir: context.outputDir,
    contextFiles: context.files,
    providers: discovery.providers
  });

  return context;
}
