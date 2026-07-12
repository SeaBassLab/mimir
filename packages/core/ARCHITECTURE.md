# Core Architecture

## Namespace Split

`@mimir-labs/core` is split into two explicit namespaces:

- `src/protocol/*`: APS domain concepts and protocol logic.
- `src/implementation/*`: runtime/infrastructure and implementation concerns.

## Protocol Namespace

`src/protocol/*` contains APS concepts:

- Manifest and resource model types: `src/protocol/manifest/*`
- Governance, evidence, lifecycle, compatibility rules: `src/protocol/governance/*`
- Manifest compatibility schema validation: `src/protocol/compatibility/*`

This namespace should stay focused on protocol semantics, not CLI/runtime details.

## Implementation Namespace

`src/implementation/*` contains implementation concerns:

- CLI-invoked services: `src/implementation/services/*`
- Filesystem and config handling: `src/implementation/io/*`, `src/implementation/configuration/*`
- Author Knowledge authoring orchestration: `src/implementation/services/authoring-service.ts`
- Dependency discovery and sync orchestration: `src/implementation/dependency-discovery/*`, `src/implementation/synchronization/*`
- Adapters and extension points: `src/implementation/adapters/*`, `src/implementation/generators/*`
- Validation engine and runtime workflows: `src/implementation/validation-engine/*`, `src/implementation/generation/*`, `src/implementation/doctor/*`

## Shared Utilities

`src/shared/*` is for neutral helpers used by both namespaces.

## Boundary Rule

Protocol code must not depend on CLI or runtime-specific modules.
Implementation code can depend on protocol modules.

## Author Knowledge Authoring

`mimir author` reuses the TypeScript resource extractor and creates missing YAML
templates under `aps/knowledge/components`. These files are version-controlled
source inputs, separate from the regenerable APS artifacts under `dist/aps`.
The authoring command does not invoke or modify generation. During its own
workflow, `generate` loads these inputs and composes their three supported
fields into the generated component resources.

Authoring is create-only: existing Author Knowledge files are never modified. The
canonical component resource ID is shared with generation through
`src/implementation/resource-identity.ts`, preventing identity drift between
the authoring filenames and generated APS Manifest resources.

Synchronization reads the enriched APS Manifest and renders component semantics in
the shared `.agents/aps/components.md` context. Adapters reference that shared
context rather than implementing provider-specific knowledge projection.
