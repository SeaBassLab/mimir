# APS Governance Regression Matrix

This matrix tracks canonical governance fixtures to prevent regressions while keeping validator behavior strict.

| Fixture | Purpose | Expected | Actual | Result |
|---|---|---|---|---|
| `valid-aps-package` | Baseline positive case | `valid: true`, `errors: 0` | `valid: true`, `errors: 0`, `warnings: 0` | pass |
| `missing-provenance` | Evidence/provenance enforcement | `valid: false` with provenance/evidence violations only | `valid: false`, errors: `APS_GOV_EVIDENCE_REQUIRED`, `APS_GOV_TRACEABLE_EVIDENCE_REQUIRED` | fail (expected) |
| `conflicting-evidence` | Conflict resolution enforcement | `valid: false` with conflict violations only | `valid: false`, error: `APS_GOV_CONFLICT_SELECTED_NOT_FOUND` (warning: `APS_GOV_CONFLICT_UNRESOLVED_CANDIDATES`) | fail (expected) |
| `deprecated-without-migration` | Lifecycle successor/migration enforcement | `valid: false` with lifecycle violation only | `valid: false`, error: `APS_GOV_DEPRECATION_SUCCESSOR_REQUIRED` | fail (expected) |

## Suggested Future Automated Test Layout

No framework is enforced in this step. The following structure is recommended for future automation:

```text
tests/
  governance/
    fixtures/
    governance.test.ts
```

### Intended usage

- `tests/governance/fixtures/`: immutable APS fixture inputs for regression runs.
- `tests/governance/governance.test.ts`: assertions for `valid/errors/warnings/metrics` per fixture.
- Keep fixture intent explicit: each negative fixture should fail for one primary reason category.
- Add one smoke assertion for `aps governance --json` to guarantee machine-readable CLI output stability.
