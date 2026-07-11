# APS Governance Validation Fixtures

These canonical fixtures are used to validate governance scenarios:

1. `valid-aps-package`: governance-compliant package and manifest.
2. `missing-provenance`: policy field without evidence.
3. `conflicting-evidence`: conflict without selected candidate and explanation.
4. `deprecated-without-migration`: deprecated resource missing reason and migration/replacement.

Each fixture folder includes:

- `package.json`
- `dist/knowledge/manifest.json`
