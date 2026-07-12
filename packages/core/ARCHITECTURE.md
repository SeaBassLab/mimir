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
- Neutral software knowledge model and orchestration: `src/implementation/knowledge/*`
- AST analyzers used by knowledge providers: `src/implementation/resource-discovery/*`
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

The knowledge model is implementation-neutral within Mimir: it must not depend
on Author, Generate, APS resources, or a specific extractor. APS protocol code
must not depend on the knowledge engine.

## Software Knowledge Engine

Mimir uses one language for automatically discovered knowledge:

- `KnowledgeFact` represents a subject, predicate, value, confidence, source,
  evidence, and optional metadata.
- `KnowledgeProvider` collects facts without writing descriptors or knowing APS.
- `KnowledgeWorkspace` owns the single TypeScript `Program` and `TypeChecker`
  shared by every provider in an authoring execution.
- `KnowledgeGraph` organizes facts in memory and provides pragmatic queries for
  resources, API, classification, relationships, and examples.
- `PersistencePolicy` selects the stable, reviewable facts allowed into a
  descriptor.

```text
Semantic Discovery ─┐
Public API ──────────┤
Storybook ───────────┤
Relationships ───────┼─> Knowledge Graph ─> Persistence Policy ─> Author
React Patterns ──────┤
Design Tokens ───────┘
```

The graph is never persisted or serialized. Derived knowledge such as resolved
design-token values and mechanical import/export edges can exist in memory
without becoming part of the descriptor or APS contract.

For exported objects, the persistence policy keeps their stable public surface
in `auto.api.members` (access paths and widened types), not their resolved
literal values. Extraction is bounded to four levels and 200 members per
resource so palettes, spacing scales, breakpoints, and public constant
namespaces remain useful without unbounded descriptor growth.
The TypeChecker is authoritative when it exposes a useful shape. A bounded AST
fallback covers direct literals, aliases, spreads, `as const`, `satisfies`,
`Object.freeze`, `Object.assign`, shorthand properties, and arrays when the
declared type collapses to `any` or otherwise loses member information.

Providers declare the predicates they require and produce. The engine validates
those dependencies while preserving one shared workspace.

## Author Knowledge Authoring

`mimir author` builds the in-memory Knowledge Graph and passes it through the
descriptor Persistence Policy. It creates missing YAML descriptor scaffolds
(`*.mimir.yaml`) near source files. These files are
version-controlled source inputs, separate from the regenerable APS artifacts
under `dist/aps`.
Descriptor discovery is workspace-relative and does not require a fixed source
root such as `src`.
The authoring command owns descriptor synchronization, not extraction or
retention decisions: it creates missing resources, writes the policy projection
to `auto`, and preserves `human` content.
During generation, `generate` compiles descriptor resources only and does not
perform resource discovery heuristics or execute authoring providers.
Components remain in the legacy-compatible `components` section and
`components.json`. Other semantic kinds are emitted with their real type in the
additive `resources` section and `resources.json`.

Authoring never overwrites human fields. The
canonical component resource ID is shared with generation through
`src/implementation/resource-identity.ts`, preventing identity drift between
the descriptor identities and generated APS Manifest resources.

Synchronization reads the enriched APS Manifest and renders component semantics
in `.agents/aps/components.md` plus typed semantic resources in
`.agents/aps/resources.md`. Adapters reference the shared `.agents/aps/index.md`
instead of implementing provider-specific knowledge projection.
