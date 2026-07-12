# Extension Points

Mimir core exposes two lightweight extension points:

- Adapters: sync generated context to consumer-specific targets.
- Generators: produce machine-readable artifacts from project evidence.

## Adapter Extension Point

Adapter contract lives in `src/implementation/adapters/types.ts`.

```ts
export interface AgentAdapter {
  name: string;
  sync(context: AgentContext): Promise<SyncResult>;
}
```

Register adapters through:

- `registerAdapter(adapter, aliases?)`
- `getConfiguredAdapters(config)`

### Add a new adapter package

Example target packages:

- `@mimir-labs/copilot`
- `@mimir-labs/cursor`
- `@mimir-labs/agents`

Steps:

1. Implement `AgentAdapter` in the package.
2. Register it during composition/bootstrap using `registerAdapter`.
3. Add its name to `aps.adapters` in provider/consumer `package.json` if selective sync is desired.

No switch statements are required. Resolution is registry-based.

## Generator Extension Point

Generator contract lives in `src/implementation/generators/types.ts`.

```ts
export interface MimirGenerator<TOptions = unknown, TResult = unknown> {
  name: string;
  generate(cwd: string, options?: TOptions): Promise<TResult>;
}
```

Register generators through:

- `registerGenerator(generator, makeDefault?)`
- `resolveGenerator(name?)`

### Add a new generator package

Example target packages:

- `@mimir-labs/markdown`
- `@mimir-labs/json`

Steps:

1. Implement `MimirGenerator` in the package.
2. Register it during composition/bootstrap using `registerGenerator`.
3. Invoke by name from service orchestration when needed.

Current default generator remains `aps`, preserving existing behavior.
