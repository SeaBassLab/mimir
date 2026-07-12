# Mimir

Mimir is the reference implementation of APS Protocol.

This repository is implementation-only and organized as a pnpm workspace.

## From library intent to agent context

Mimir combines what can be discovered from code with knowledge that only the
library author can provide.

```bash
# Initialize APS in the library
mimir init

# Discover resources and create Author Knowledge templates
mimir author

# Complete the generated YAML files

# Compose code evidence and Author Knowledge into the APS Manifest
mimir generate

# Validate the published knowledge
mimir validate

# In a consumer project, project the provider knowledge to every adapter
mimir sync
```

### 1. Author the knowledge

`mimir author` creates one source file per resource. It never overwrites an
existing file and never writes human content automatically.

```text
aps/
  knowledge/
    components/
      acme.ui.component.button.yaml
```

Complete the generated YAML manually or with an AI agent:

```yaml
description: "Primary action control for submitting user intent."
# Describe brevemente qué hace este recurso.

whenToUse:
  - "Use for the primary action in a form or dialog."
# ¿Cuándo recomendarías utilizar este recurso?

whenNotToUse:
  - "Do not use for navigation; use a link instead."
# ¿En qué casos elegirías otra alternativa?
```

These files are version-controlled source inputs. Generated artifacts under
`dist/aps` remain completely regenerable.

### 2. Generate the APS Manifest

`mimir generate` combines observable evidence from TypeScript, Storybook, and
README files with Author Knowledge from authored YAML. The resulting APS Manifest includes
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

- `packages/cli`: APS reference CLI implementation.
- `packages/core`: APS protocol models and reusable Mimir implementation services.
