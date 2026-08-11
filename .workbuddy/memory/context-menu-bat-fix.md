---
name: context-menu-bat-fix
description: Right-click context menu bat script rewritten, format cleanup, lifecycle hooks added
metadata:
  type: project
---

Right-click context menu in `src/index.ts` was rewritten on 2026-05-21.

**Why:** Original bat script had critical bugs: directory right-click silently failed (folders have no extension), paths with spaces broke (`for %%F in (%~2)` splits by space), output hidden by `start /b cmd /c`, lowercase conversion syntax was completely broken (26 lines of invalid `call set`), PowerShell fallback unreliable.

**Changes made:**
- Bat script rewritten: handles both files and directories via `if exist "%~1\*"`, uses `shift` loop instead of space-splitting, calls cis directly, `pause` on error so user sees output
- Removed gif/heif/jp2 from output (sharp support poor)
- Same-format conversion uses `fs.copyFileSync` to avoid re-encoding
- PNG uses `compressionLevel: 6` instead of incorrect `quality`
- Default quality 85→90
- Unified `SUPPORTED_INPUT_EXTENSIONS` / `SUPPORTED_OUTPUT_FORMATS` constants
- Fixed hardcoded version, now reads from package.json
- npm lifecycle hooks: postinstall auto-registers menu, preuninstall auto-cleans
- `tsc --watch` as dev script, lint runs `tsc --noEmit`

**How to apply:** When modifying context menu or bat, test: file right-click, directory icon right-click, directory background right-click. Rebuild with `npm run build` after src changes.
