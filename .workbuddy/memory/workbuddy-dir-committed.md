---
name: workbuddy-dir-committed
description: .workbuddy/ memory directory is committed to the repo and should always be staged with code changes
metadata:
  type: project
---

`.workbuddy/` memory directory (including `memory/`) is committed to the repository for cross-device / tool sharing. Always `git add` `.workbuddy/` changes alongside code changes during a commit.

**Why:** Project memory, settings, and notes should be portable across devices and AI tools. Migrated from the old `.claude/` directory on 2026-08-11.

**How to apply:** After making code changes that also modify `.workbuddy/` files (e.g. `memory/MEMORY.md`, daily logs under `memory/`), stage them together. Don't leave `.workbuddy/` changes unstaged.
