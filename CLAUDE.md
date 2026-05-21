# CLAUDE.md

This is a Node.js CLI tool for batch image format conversion using [sharp](https://sharp.pixel.glass/).

## Quick Setup

```bash
npm install
npm run build       # tsc → dist/
npm link            # register cis/change-image-suffix globally
```

## Architecture

```
src/index.ts          # Single-file source (832 lines) — CLI parsing, conversion, context menu
dist/index.js         # Compiled output (not in git, shipped to npm)
scripts/release.js    # Interactive release script (bump version, tag, push)
.github/workflows/    # CI: auto-publish to npm on release tag
```

## Build & Test

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript |
| `npm run typecheck` | Type-check only (no emit) |
| `npm run clean` | Remove dist/ |
| `npm run lint` | No-op (not configured) |
| `npm test` | Not configured |

## Key Patterns

- **Shebang**: `#!/usr/bin/env node` at top of `src/index.ts`
- **Dual bin name**: `change-image-suffix` and `cis` (short alias)
- **Output convention**: converted files go to `<source>/output/` subdirectory
- **Naming conflict resolution**: same basename + different extensions → `_01`, `_02` suffixes
- **Committed files**: dist/ is gitignored (built on prepublishOnly), src/ is the source of truth

## Context Menu (Windows only)

- Installed via `cis install-menu` — writes to HKCU (no admin required)
- Uses `ExtendedSubCommandsKey` for cascading format submenu
- Bat + PowerShell scripts stored in `%APPDATA%/change-image-suffix/`
- `Directory\Background` → `-p "%V"` (direct CLI call, no bat)
- `Directory` and `*` (file) → bat script (`cis_file.bat`)

## Commit Convention

Conventional Commits with commitlint: `type(scope): description`
Types: feat, fix, docs, style, refactor, perf, test, chore
