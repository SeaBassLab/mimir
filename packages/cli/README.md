# Mimir CLI

Reference implementation CLI for APS Protocol.

[![npm version](https://img.shields.io/npm/v/%40mimir%2Fcli.svg)](https://www.npmjs.com/package/%40mimir/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

Formal docs:

- [APS Protocol Specification v1](https://github.com/SeaBassLab/aps-protocol/blob/main/docs/specification.md)
- [APS Protocol Rationale](https://github.com/SeaBassLab/aps-protocol/blob/main/docs/rationale.md)

## Introduction

Software knowledge exists everywhere: component APIs, compatibility rules, lifecycle policies, usage constraints, and architectural conventions.

Today, each library and platform documents that knowledge differently. The result is fragmented metadata that is hard to validate, hard to govern, and hard to consume across tools.

Without an interoperable format, IDEs, automation pipelines, documentation generators, static analysis tools, and assistants must infer behavior from source code and prose.

APS defines a software knowledge protocol for publishing structured software knowledge consistently. It standardizes how providers describe knowledge and how consumers validate, govern, and synchronize it.

AI coding assistants are one possible consumer of APS knowledge, but APS is not limited to AI workflows.

Traditional software packages publish:

- Source code
- Type definitions
- Documentation

APS providers additionally publish:

- Structured software knowledge

## What is APS?

APS is an open protocol for publishing structured software knowledge.

Like OpenAPI standardizes HTTP API descriptions and SPDX standardizes software bill-of-materials metadata, APS standardizes software knowledge artifacts and governance metadata.

| Standard | Standardizes |
|----------|--------------|
| OpenAPI | HTTP APIs |
| SPDX | Software bill of materials |
| OCI | Container images |
| APS | Software knowledge |

APS is protocol-first:

- Vendor-neutral and tooling-agnostic.
- Designed for interoperability across ecosystems.
- Compatible with package registries and private distribution channels.
- Focused on machine-readable, reviewable, and governable knowledge artifacts.

APS does not replace source code or human documentation. It complements them with a consistent protocol that automation and developer tooling can consume.

## Why APS exists

Software libraries already contain knowledge.

That knowledge is spread across:

- source code
- README files
- Storybook
- Architecture Decision Records
- wiki pages
- onboarding documents
- tribal knowledge

APS gives software a single, structured, machine-readable representation of that knowledge.

## Conceptual Model

```text
Source Code --mimir author--> Author Knowledge (*.mimir.yaml descriptors)
   |                                      |
   +-------------------+------------------+
           |
           v
         mimir generate
           |
           v
    APS Knowledge Base (APS Manifest + Resources)
         |                          |
         |                          +--> mimir validate / governance / doctor
         |
         +--> mimir discover -> mimir sync -> AGENTS / Copilot / Cursor adapters
```

## Core Concepts

| Concept | Producer | Purpose |
| --- | --- | --- |
| Knowledge Provider | Library or platform package | Publishes structured software knowledge. |
| Consumer | Application or platform toolchain | Consumes knowledge published by providers. |
| Author Knowledge | Knowledge Provider | Provider-authored source knowledge in versioned `*.mimir.yaml` descriptors for intent that cannot be inferred automatically. |
| APS Manifest | Knowledge Provider | Entry point of a provider package. |
| Resource | Knowledge Provider | Knowledge unit such as a component, API, service, rule, or example. |
| Governance | Knowledge Provider | Trust metadata covering provenance, evidence, lifecycle, applicability, and policy consistency. |
| Adapter | Consumer environment | Converts APS knowledge into consumer-specific formats. |

## Design Principles

APS is designed around a few core principles.

- Protocol-first
- Tooling-agnostic
- Incrementally adoptable
- Evidence-based
- Human-governed
- Machine-readable

## Why APS?

APS benefits multiple consumers, not only assistants:

- IDEs: enrich project context with structured, versioned knowledge.
- Documentation generators: build consistent docs from protocol artifacts.
- Static analysis: validate policy and compatibility metadata systematically.
- Internal platforms: standardize publish/consume workflows across teams.
- AI coding assistants: reduce inference ambiguity with explicit metadata.
- Enterprise governance: enforce provenance, lifecycle, and policy consistency.

## Who uses APS?

APS has two primary personas.

Providers:

- Component libraries
- SDKs
- Backend frameworks
- Internal platforms

Consumers:

- Application teams
- Monorepos
- Automation pipelines
- IDE integrations
- Documentation systems
- Code assistants and AI agents

## Installation

Node.js 18+ is recommended.

Global install:

```bash
npm install -g @mimir-labs/cli
```

Temporary execution:

```bash
npx @mimir-labs/cli --help
```

## Quick Start (Provider)

Create your first APS Knowledge Provider:

```bash
cd my-library

mimir init
mimir author
mimir generate

# output
# Generated:
# ✓ manifest.json
# ✓ components.json
# ✓ rules.json
#
# Provider ready for validation.

mimir validate
mimir governance
mimir doctor
# publish provider package
```

Step summary:

- `mimir init`: prepares APS configuration in package metadata.
- `mimir author`: synchronizes descriptor `auto` blocks from project evidence and preserves `human` blocks.
- `mimir generate`: compiles APS resources exclusively from `*.mimir.yaml` descriptors.
- `mimir validate`: verifies APS structural compliance.
- `mimir governance`: validates governance metadata and policy consistency.
- `mimir doctor`: evaluates maturity level before release.
- Publish provider package: distributes the provider through a package registry.

Complete the generated descriptor scaffolds manually or with an AI agent before generation when human intent is required. Mimir does not write that content.

Descriptor-first workflow notes:

- Mimir no longer depends on a fixed source root such as `src`.
- `mimir init` is bootstrap-only and does not discover resources or create descriptors.
- `mimir author` discovers resources, creates missing descriptors, and refreshes only `auto` fields.
- `mimir generate` reads only `*.mimir.yaml` descriptors as the provider contract source.

Minimal descriptor shape:

```yaml
schemaVersion: 1
resources:
  - kind: component
    name: "Button"
    id: "@acme/ui.component.button"
    auto:
      source:
        file: "app/ui/Button.tsx"
        symbol: "Button"
        public: true
      props: []
      variants: []
      storyFiles: []
    human:
      description: ""
      whenToUse: []
      whenNotToUse: []
```

`mimir generate` composes completed `description`, `whenToUse`, and
`whenNotToUse` fields into the APS Manifest. `mimir sync` projects those fields
from the APS Manifest into the shared context used by all configured adapters.

## Example

Generated provider structure:

```text
dist/
  aps/
    manifest.json
    components.json
    rules.json
    examples.json
```

Minimal APS Manifest example:

```json
{
  "version": 1,
  "components": [
    {
      "type": "component",
      "id": "acme.ui.component.button",
      "name": "Button",
      "package": "@acme/ui",
      "import": "Button",
      "description": "Primary action button"
    }
  ]
}
```

## APS in Practice

Provider project:

```text
my-ui-library/
  aps/
    knowledge/
      components/
        acme.ui.component.button.yaml
  dist/
    aps/
      manifest.json
      components.json
      rules.json
      examples.json
```

Consumer project:

```text
consumer/
  package.json

npm install my-ui-library
mimir discover
mimir sync

AGENTS.md generated
```

In practice, the provider publishes structured software knowledge once, and consumer projects discover and synchronize that knowledge into their local tooling context.

## Provider Workflow

```text
mimir init
  -> mimir author
  -> mimir generate
  -> mimir validate
  -> mimir governance
  -> mimir doctor
  -> Publish provider package
```

Why each step exists:

- Author -> discovers resources, creates missing descriptors, and synchronizes only `auto` fields while preserving `human` authoring.
- Author -> updates only descriptor `auto` fields and preserves `human` authoring.
- Generate -> compiles descriptor-authored knowledge into machine-readable APS artifacts.
- Validate -> ensures protocol compliance.
- Governance -> ensures trust, provenance, and policy consistency.
- Doctor -> evaluates provider maturity and release readiness.

`mimir governance` validates governance metadata such as provenance, evidence, lifecycle, applicability and policy consistency.

Governance makes APS knowledge trustworthy by validating where information comes from, how it is maintained, and whether it remains consistent over time.

Use `mimir governance` when:

- preparing a release that must meet internal trust or compliance standards
- introducing new evidence sources or policy rules
- verifying that governance metadata remains consistent after refactors

Example:

```bash
mimir governance --json
```

## Consumer Workflow

```text
Install provider
  -> mimir discover
  -> mimir validate
  -> mimir sync
```

Important:

- `mimir sync` is not part of provider publication.
- `mimir sync` belongs to the consumer side and synchronizes knowledge from the APS Manifest to adapters such as AGENTS.md, Copilot Instructions, Cursor Rules, and future integrations.

Example:

```text
Consumer project

mimir sync

Generated

✓ AGENTS.md
✓ copilot-instructions.md
✓ cursor-rules.mdc
```

Discovery example:

```text
$ mimir discover

Found providers

✓ @acme/ui
  Components: 42
  Rules: 18
  Examples: 63
```

## Validate vs Governance

`mimir validate` checks structural compliance.

Typical checks include:

- APS Manifest shape
- JSON validity
- resource declarations
- reference integrity

`mimir governance` checks governance semantics.

Definition:

"Validates governance metadata such as provenance, evidence, lifecycle, applicability and policy consistency."

Use `mimir governance` when:

- preparing a release that must meet internal trust or compliance standards
- introducing new evidence sources or policy rules
- verifying that governance metadata remains consistent after refactors

Example:

```bash
mimir governance --json
```

## Commands

| Command | Role | Description | Example |
| --- | --- | --- | --- |
| `mimir init` | Provider | Initialize APS support in package metadata (bootstrap only). | `mimir init` |
| `mimir author` | Provider | Sync descriptor `auto` blocks, preserve `human`, and report/delete orphans. | `mimir author --delete-orphans` |
| `mimir generate` | Provider | Compile APS resources from descriptor contracts only. | `mimir generate --force` |
| `mimir discover` | Consumer | Discover APS-enabled dependencies/providers. | `mimir discover` |
| `mimir validate` | Both | Validate APS Manifest and declared resources. | `mimir validate` |
| `mimir governance` | Provider | Validate provenance, evidence, lifecycle, applicability and policy consistency metadata. | `mimir governance --json` |
| `mimir doctor` | Provider | Evaluate provider maturity (L0-L3). | `mimir doctor --json` |
| `mimir context` | Consumer | Generate local AI-agent context from discovered providers. | `mimir context --dry-run` |
| `mimir sync` | Consumer | Synchronize discovered APS Manifest knowledge to configured consumer adapters. | `mimir sync` |
| `mimir about` | Both | Show APS Protocol overview, workflows, and references. | `mimir about --json` |
| `mimir help` | Both | Show command help and usage. | `mimir help governance` |
| `mimir completion` | Utility | Print shell completion scripts. | `mimir completion zsh` |

### Command Groups

| Group | Commands |
| --- | --- |
| Provider Commands | `init`, `author`, `generate`, `validate`, `governance`, `doctor` |
| Consumer Commands | `discover`, `context`, `sync` |
| Utility Commands | `help`, `about`, `completion` |

## Doctor

The doctor command evaluates provider maturity and highlights gaps to reach stronger governance levels.

Doctor is a release-readiness assessment, not a protocol validator.

Example:

```text
$ mimir doctor

Provider maturity: L2 (Governed)

✔ Manifest
✔ Resources
✔ Provenance
✔ Lifecycle

Recommendation

Complete ownership metadata to reach L3.
```

## Why not README, JSON Schema, or OpenAPI?

| Technology | Primary purpose |
| --- | --- |
| README | Human documentation |
| JSON Schema | Data shape validation |
| OpenAPI | HTTP API description |
| APS | Software knowledge exchange across providers and consumers |

These technologies are complementary. APS does not replace them; it standardizes machine-readable software knowledge and governance metadata for interoperability.

## Philosophy

> Documentation is written for humans.
>
> APS artifacts are written for machines.
>
> Both are necessary.

Documentation provides context and intent, while APS provides interoperable, machine-readable software knowledge for agents and automation tooling.

## Roadmap

### Protocol

- [ ] Provider minimum contract
- [ ] Governance profiles

### CLI

- [x] Discovery
- [x] Validation
- [x] Governance
- [x] Generate v1
- [x] Descriptor-driven Author Knowledge authoring (`*.mimir.yaml`)
- [x] Context generation
- [x] Adapter sync

### Reference Providers

- [ ] React provider
- [ ] Nest provider
- [ ] Next provider
- [ ] Vue provider
- [ ] Angular provider
- [ ] Express provider

### Reference Consumers

- [ ] AGENTS.md consumer adapter
- [ ] Copilot Instructions consumer adapter
- [ ] Cursor Rules consumer adapter

### Registry

- [ ] Private registries
- [ ] Federated providers

### Ecosystem

- [ ] GitHub Action
- [ ] VS Code Extension

## FAQ

**Does APS replace documentation?**

No. APS complements documentation by adding structured software knowledge artifacts for automation and tooling.

**Does APS require MCP?**

No. APS is protocol-level and can be consumed with or without MCP.

**Does APS work only with React?**

No. APS is technology-agnostic and can model frontend and backend knowledge.

**Can I use APS in backend projects?**

Yes. APS supports broader resource families and backend-oriented governance patterns.

**Can I publish private providers?**

Yes. Providers can be distributed privately, including internal registries and private package infrastructures.

## Contributing

Contributions are welcome. Open an issue for proposals or submit a pull request with a focused change and clear rationale.

## License

MIT
