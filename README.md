# Mimir

Mimir is a Software Knowledge Engine that discovers, structures, and publishes
software knowledge through APS.

It turns evidence from source code and development tooling into an in-memory
Knowledge Graph, applies an explicit persistence policy, and maintains
reviewable descriptors that `mimir generate` compiles into APS artifacts.

Mimir and APS have different responsibilities: Mimir builds and manages
software knowledge; APS is the independent protocol used to publish it.

## From library intent to agent context

Mimir combines facts discovered from code and tooling with knowledge that only
the library author can provide.

```text
Source code + Storybook + semantic evidence
                    ↓
           Knowledge Providers
                    ↓
        In-memory Knowledge Graph
                    ↓
          Persistence Policy
                    ↓
    Versioned descriptors (*.mimir.yaml)
                    ↓
             mimir generate
                    ↓
              APS artifacts
```

```bash
# Initialize APS in the library
mimir init

# Discover and structure knowledge, then synchronize persistent descriptors
mimir author

# Complete the generated YAML files

# Compile persistent descriptor knowledge into APS
mimir generate

# Validate the published knowledge
mimir validate

# In a consumer project, project the provider knowledge to every adapter
mimir sync
```

### 1. Author the knowledge

`mimir author` executes the knowledge providers over one shared TypeScript
workspace, organizes their facts in memory, and applies the descriptor
persistence policy. It creates one source file per resource, refreshes managed
`auto` knowledge, and never writes human content automatically.

```text
src/
  Button.mimir.yaml
```

Complete the generated YAML manually or with an AI agent:

```yaml
schemaVersion: 2
kind: component
name: Button
id: acme.ui.component.button
auto:
  source:
    file: src/Button.tsx
    symbol: Button
    public: true
  props: []
  api: { props: [], events: [], slots: [], methods: [], refs: [] }
  relationships: []
  examples: []
human:
  description: "Primary action control for submitting user intent."
  whenToUse:
    - "Use for the primary action in a form or dialog."
  whenNotToUse:
    - "Do not use for navigation; use a link instead."
```

These files are version-controlled source inputs. Generated artifacts under
`dist/aps` remain completely regenerable.

### 2. Generate the APS Manifest

`mimir generate` compiles only the persistent knowledge selected into authored
YAML descriptors. It does not rerun authoring providers or reconstruct the
Knowledge Graph. The resulting APS Manifest includes
`description`, `whenToUse`, and `whenNotToUse`, together with their Author
provenance.

```bash
mimir generate
mimir validate
```

### 3. Synchronize consumer context

After the provider is installed, run `mimir sync` from the consumer project.
Mimir projects the enriched APS Manifest into the shared context used by AGENTS,
Copilot, Cursor, and any configured adapter.

```bash
mimir sync
```

Generated `.agents/aps/components.md`:

```markdown
# APS Components

## Button

Provider: @acme/ui
Resource ID: acme.ui.component.button

Primary action control for submitting user intent.

### When to use

- Use for the primary action in a form or dialog.

### When not to use

- Do not use for navigation; use a link instead.
```

Non-component knowledge is projected to `.agents/aps/resources.md`, grouped by
kind with its import, public API summary, React patterns, relationships, and
authored usage guidance. Every adapter points to `.agents/aps/index.md`, which
references both files.

The author's intent now travels continuously from version-controlled source to
the context read by consumer agents:

```text
Code + Author Knowledge
          ↓
  APS Manifest
          ↓
      mimir sync
          ↓
AGENTS · Copilot · Cursor · custom adapters
```

Use `mimir --help` or `mimir help author` for command-level guidance.

## Workspace

- `packages/cli`: command-line interface for Mimir workflows.
- `packages/core`: Software Knowledge Engine, APS protocol models, and reusable services.
