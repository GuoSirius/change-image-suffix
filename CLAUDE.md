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
src/index.ts            # Main source — CLI parsing, conversion, context menu
dist/index.js           # Compiled output (not in git, shipped to npm)
scripts/release.js      # Interactive release script (bump version, tag, push)
scripts/postinstall.js  # npm hook: auto-register context menu on global install
scripts/preuninstall.js # npm hook: auto-cleanup context menu before uninstall
.github/workflows/      # CI: auto-publish to npm on release tag
.claude/                # Project memory & settings (committed, cross-device)
```

## Build & Test

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript |
| `npm run dev` | Watch mode (tsc --watch) |
| `npm run typecheck` | Type-check only (no emit) |
| `npm run clean` | Remove dist/ |
| `npm run lint` | Type-check alias (tsc --noEmit) |

## Key Patterns

- **Shebang**: `#!/usr/bin/env node` at top of `src/index.ts`
- **Dual bin name**: `change-image-suffix` and `cis` (short alias)
- **Output convention**: converted files go to `<source>/output/` subdirectory
- **Naming conflict resolution**: same basename + different extensions → `_01`, `_02` suffixes
- **Same-format copy**: if source ext matches target format, file is copied directly (no re-encode)
- **Committed files**: dist/ is gitignored (built on prepublishOnly), src/ is the source of truth

## Supported Formats

- **Input**: png, jpg, jpeg, gif, bmp, tiff, tif, webp, avif
- **Output**: webp, jpg, jpeg, png, avif, tiff, tif
- **Default quality**: 90 (webp/jpeg/avif/tiff), PNG uses compressionLevel 6
- Defined as `SUPPORTED_INPUT_EXTENSIONS` / `SUPPORTED_OUTPUT_FORMATS` constants

## Context Menu (Windows only)

- Installed via `cis install-menu` — writes to HKCU (no admin required)
- Uses `ExtendedSubCommandsKey` for cascading format submenu (webp/jpg/png/avif/tiff)
- Bat script stored in `%APPDATA%/change-image-suffix/cis_file.bat`
- `Directory\Background` → `-p "%V"` (direct CLI call)
- `Directory` and `*` (file) → bat script handles files and directories

## Commit Convention

Conventional Commits with commitlint: `type(scope): description`
Types: feat, fix, docs, style, refactor, perf, test, chore
