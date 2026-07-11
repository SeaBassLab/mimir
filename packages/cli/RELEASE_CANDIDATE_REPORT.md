# Release Candidate Report

Date: 2026-07-10
Candidate: aps-cli@1.0.0

## Build Status

- Command: npm run build
- Result: PASS

## Package Audit Summary

- Command: npm pack --dry-run
- Required files present: dist output, package.json, README.md
- Critical issues found:
1. Tarball self-inclusion (aps-cli-1.0.0.tgz inside package)
2. Over-inclusion of src and fixture content
3. No LICENSE file present

## Fresh Installation Test

- Temp workspace: /tmp/aps-cli-test
- Install command: npm install /Users/sebastianpulido/MyDocuments/my-projects/aps-cli/aps-cli-1.0.0.tgz
- Result: PASS
- Binary check: npx aps --help
- Result: PASS after rebuilding tarball from latest dist

## Installed Binary Command Verification

Fixture used:
- src/generation/examples/react-exports

Results:

1. aps discover
- Expected: no providers in fixture dependencies
- Actual: "No APS providers found."
- Exit code: 0

2. aps validate
- Expected: valid APS manifest in fixture
- Actual: valid true, warnings about declared resource paths
- Exit code: 0

3. aps governance
- Expected: governance validation completes
- Actual: valid true, coverage metrics reported
- Exit code: 0

4. aps doctor
- Expected: maturity below max for evidence-only generated component
- Actual: L0/3 with expected recommendations
- Exit code: 1

5. aps generate
- Expected: fails without --force when dist/aps already exists
- Actual: safety error message shown
- Exit code: 1

6. aps sync
- Expected: sync runs and preserves user content
- Actual: adapters reported OK
- Exit code: 0

## Repository Hygiene Audit

- .gitignore covers node_modules, coverage, logs, temp, editor and OS files.
- No tracked node_modules/coverage/log/temp artifacts found via git ls-files checks.
- Working tree is not clean (multiple modified/untracked files), including aps-cli-1.0.0.tgz.

## Release Metadata Check (package.json)

- name: present
- version: present
- description: present
- keywords: present
- repository: placeholder value still present (<org>)
- license: UNLICENSED placeholder
- bin: present

## Remaining Blockers

1. npm package includes aps-cli-1.0.0.tgz (self-inclusion, package bloat).
2. Package contents are not minimized for public npm release (src + fixtures + authoring files included).
3. LICENSE file is missing.
4. Repository and issue URLs are placeholders (<org>) and not release-ready.

## Final Recommendation

NOT_READY

The candidate is functionally installable and command execution is validated, but publication quality and package hygiene blockers must be resolved before npm release.
