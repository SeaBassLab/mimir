# @mimir-labs/core

Software Knowledge Engine and reusable services for the Mimir CLI.

Mimir discovers software facts through Knowledge Providers, organizes them in
an in-memory Knowledge Graph, and applies an explicit Persistence Policy before
`author` writes versioned descriptors. `generate` remains independent: it
compiles persistent descriptor knowledge into APS without consulting authoring
providers.

Public workflows include discovery, authoring, generation, validation,
governance, context generation, synchronization, initialization, and doctor
assessment. Author Knowledge sources live in versioned `*.mimir.yaml`
descriptors maintained by `mimir author`; generated APS artifacts remain under
`dist/aps`.

The knowledge model is intentionally separate from APS. Knowledge extraction
can evolve without expanding the descriptor or protocol contract with every
derived fact.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the knowledge pipeline and
[EXTENSIONS.md](./EXTENSIONS.md) for public extension guidance.
