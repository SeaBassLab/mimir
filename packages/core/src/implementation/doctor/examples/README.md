# APS Doctor Maturity Fixtures

This directory contains four standalone APS provider fixtures used to validate
`mimir doctor` maturity evaluation.

- `level-0`: manifest and schema-valid resources, but missing Level 1 contract fields.
- `level-1`: includes Level 1 contract fields, missing Level 2 governance fields.
- `level-2`: includes Level 2 governance metadata and valid governance evidence.
- `level-3`: includes Level 3 operational metadata.
