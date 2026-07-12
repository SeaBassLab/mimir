# Mimir

Mimir is the reference implementation of APS Protocol.

This repository is implementation-only and organized as a pnpm workspace.

## Provider workflow

```text
mimir init
  -> mimir author
  -> mimir generate
  -> mimir validate
  -> mimir governance
  -> mimir doctor
  -> publish provider package
```

`mimir author` discovers provider resources and creates missing human-knowledge
templates under `aps/knowledge`. These YAML files are source inputs intended to
be versioned with the library. The command never modifies existing authoring
files or generated output under `dist/aps`.

The current command prepares these sources only; manifest enrichment remains a
separate generation-stage integration.

Example:

```bash
mimir author
mimir author --dry-run
mimir author --json
```

Generated authoring source:

```text
aps/
  knowledge/
    components/
      acme.ui.component.button.yaml
```

Use `mimir --help` or `mimir help author` for command-level guidance.

## Workspace

- `packages/cli`: APS reference CLI implementation.
- `packages/core`: APS protocol models and reusable Mimir implementation services.
