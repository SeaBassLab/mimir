import { discoverProviders } from "../dependency-discovery/discover-providers";

export async function runDiscovery(cwd: string) {
  return discoverProviders(cwd);
}
