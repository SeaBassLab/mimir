# APS Resource Model Evolution Notes

## Scope

This update introduces a generic APS resource model while keeping APS version 1 payloads valid.

## Compatibility Strategy

- Existing APS v1 payloads remain valid.
- New fields are optional.
- Unknown fields are allowed and should be ignored by consumers.
- `version: 1` manifests stay valid.
- New generic resources can be introduced incrementally through `resources` and typed arrays.

## Migration from v1 to Generic Resources

1. Keep `components`, `rules`, `examples`, `patterns`, `migrations` unchanged.
2. Optionally add `resources` with typed entries (`component`, `api`, `service`, `model`, `event`, `pattern`, `rule`, `migration`, `example`).
3. Add richer optional fields for AI decision support:
   - decision context (`whenToUse`, `whenNotToUse`, `alternatives`)
   - implementation hints (`import`, `props`, `variants`, `states`)
   - guidance links (`rules`, `examples`, `antiExamples`)
   - compatibility (`deprecated`, `migrations`, `versionConstraints`)

## Recommended Adoption Path

1. Keep shipping v1-compatible manifests.
2. Start enriching component, rule, and example entries with optional fields.
3. Introduce `api`, `service`, `model`, and `event` resources as needed.
4. Use `schemaVersion: 2` only when ecosystem support is ready.
