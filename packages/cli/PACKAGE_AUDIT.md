# Package Audit

Date: 2026-07-10
Package: aps-cli@1.0.0

## Command Used

- npm pack --dry-run

## Package Contents Summary

Observed in tarball:

- Required present:
- compiled CLI output under dist/
- package.json
- README.md
- Unexpectedly present:
- full src/ tree (including fixture sources)
- governance and generation example fixtures under src/
- .agents/ and AGENTS.md protocol context files
- generated tarball file itself: aps-cli-1.0.0.tgz

## Size and File Count

Latest dry-run summary:

- package size: 263.4 kB
- unpacked size: 596.3 kB
- total files: 318

Observed behavior: package size grew across repeated pack runs because aps-cli-1.0.0.tgz is included in package contents.

## Excluded Files Check

Correctly not included:

- node_modules
- coverage
- editor folders (.vscode, .idea)
- OS files (.DS_Store)

## Potential Issues

1. Self-inclusion of tarball
- aps-cli-1.0.0.tgz is included in the packed artifact.
- This can recursively bloat release artifacts and is release-blocking.

2. Over-inclusion of source and fixtures
- src/ and fixture packages are included in npm artifact.
- This is not strictly wrong, but undesirable for a CLI binary release candidate.

3. Context and local authoring files included
- .agents/ and AGENTS.md are included.
- Usually these should not ship in npm production package unless explicitly intended.

4. Missing LICENSE file
- package.json has a license value but there is no LICENSE file in repository.

## Recommendations

1. Add npm packaging controls before release:
- add a files allowlist in package.json (recommended)
- or add .npmignore with explicit excludes

2. Exclude generated tarballs from packaging:
- add *.tgz to ignore rules used by npm pack
- remove local tarballs before packing

3. Restrict published artifact to runtime essentials:
- dist/
- package.json
- README.md
- LICENSE (once added)

4. Re-run npm pack --dry-run after cleanup and confirm stable package size.
