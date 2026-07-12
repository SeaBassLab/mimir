# APS Release Checklist

## Build
- Install dependencies: `pnpm install --frozen-lockfile`
- Compile project: `pnpm build`

## Tests
- Run test suite (when available)
- Verify fixture-based command checks for author, discover, validate, governance, doctor, generate, context, and sync

## npm package validation
- Inspect publish contents: `npm pack --dry-run`
- Confirm package metadata completeness in `package.json`
- Confirm binary entry is correct (`bin.mimir`)

## README review
- Confirm APS Protocol positioning is clear
- Confirm CLI examples are accurate
- Confirm architecture overview and maturity levels are up to date

## License
- Confirm final license decision
- Confirm `license` field in `package.json` matches repository license file

## Versioning
- Select release bump strategy (`patch`, `minor`, `major`)
- Update version and tag policy

## Changelog
- Document user-facing changes
- Document migration notes and known limitations
- 0.2.0 summary (if included in release notes):
	- New `mimir author` command.
	- Support for Author Knowledge in `aps/knowledge`.
	- Full integration with `mimir generate`.
	- Enriched consumer context via `mimir sync` from APS Manifest.
	- No incompatible changes in APS Protocol.

## Example provider verification
- Validate example provider structure and generated APS artifacts
- Verify `mimir author`, `mimir generate`, `mimir validate`, and `mimir doctor` expected outcomes on fixtures
