import { apsGenerator } from "./aps-generator";
import { GeneratorRegistry } from "./registry";
import type { MimirGenerator } from "./types";

const generatorRegistry = new GeneratorRegistry();
generatorRegistry.register(apsGenerator, true);

export type { MimirGenerator } from "./types";

export function registerGenerator(generator: MimirGenerator, makeDefault = false): void {
  generatorRegistry.register(generator, makeDefault);
}

export function resolveGenerator(name?: string): MimirGenerator {
  return generatorRegistry.resolve(name);
}
