import type { MimirGenerator } from "./types";

export class GeneratorRegistry {
  private readonly generatorsByName = new Map<string, MimirGenerator>();
  private defaultName?: string;

  register(generator: MimirGenerator, makeDefault = false): void {
    const normalized = this.normalize(generator.name);
    this.generatorsByName.set(normalized, generator);

    if (!this.defaultName || makeDefault) {
      this.defaultName = normalized;
    }
  }

  resolve(name?: string): MimirGenerator {
    const requested = typeof name === "string" && name.trim() !== "" ? this.normalize(name) : this.defaultName;

    if (!requested) {
      throw new Error("No generators registered.");
    }

    const generator = this.generatorsByName.get(requested);
    if (!generator) {
      throw new Error(`Unknown generator '${name}'.`);
    }

    return generator;
  }

  private normalize(value: string): string {
    return value.trim().toLowerCase();
  }
}
