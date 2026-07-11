# APS Release Checklist

## Build
- Install dependencies: `npm ci`
- Compile project: `npm run build`

## Tests
- Run test suite (when available)
- Verify fixture-based command checks for discover, validate, governance, doctor, generate, and sync

## npm package validation
- Inspect publish contents: `npm pack --dry-run`
- Confirm package metadata completeness in `package.json`
- Confirm binary entry is correct (`bin.aps`)

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

## Example provider verification
- Validate example provider structure and generated APS artifacts
- Verify `aps generate`, `aps validate`, and `aps doctor` expected outcomes on fixtures

