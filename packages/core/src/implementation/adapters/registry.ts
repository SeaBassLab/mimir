import type { AgentAdapter } from "./types";

export class AdapterRegistry {
  private readonly adaptersByName = new Map<string, AgentAdapter>();
  private readonly aliasToName = new Map<string, string>();
  private readonly defaultOrder: string[] = [];

  register(adapter: AgentAdapter, aliases: string[] = []): void {
    const canonicalName = this.normalize(adapter.name);
    this.adaptersByName.set(canonicalName, adapter);

    if (!this.defaultOrder.includes(canonicalName)) {
      this.defaultOrder.push(canonicalName);
    }

    this.aliasToName.set(canonicalName, canonicalName);
    for (const alias of aliases) {
      this.aliasToName.set(this.normalize(alias), canonicalName);
    }
  }

  get(name: string): AgentAdapter | undefined {
    const canonical = this.resolveCanonical(name);
    return canonical ? this.adaptersByName.get(canonical) : undefined;
  }

  resolve(config: unknown): AgentAdapter[] {
    if (!Array.isArray(config)) {
      return this.defaultOrder
        .map((name) => this.adaptersByName.get(name))
        .filter((adapter): adapter is AgentAdapter => Boolean(adapter));
    }

    const selected = [...new Set(config)]
      .filter((item): item is string => typeof item === "string")
      .map((item) => this.resolveCanonical(item))
      .filter((name): name is string => Boolean(name));

    if (selected.length === 0) {
      return this.defaultOrder
        .map((name) => this.adaptersByName.get(name))
        .filter((adapter): adapter is AgentAdapter => Boolean(adapter));
    }

    return selected
      .map((name) => this.adaptersByName.get(name))
      .filter((adapter): adapter is AgentAdapter => Boolean(adapter));
  }

  private resolveCanonical(name: string): string | undefined {
    return this.aliasToName.get(this.normalize(name));
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }
}
