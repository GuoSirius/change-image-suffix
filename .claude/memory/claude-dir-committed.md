---
name: claude-dir-committed
description: .claude/ directory is committed to the repo and should always be staged with changes
metadata:
  type: project
---

.claude/ directory (including settings.local.json, settings.json, memory/) is committed to the repository for cross-device sharing. Always `git add` .claude/ changes alongside code changes during a commit.

**Why:** The user explicitly wants .claude/ changes committed to the repo so project settings, permissions, and memory are portable across devices.

**How to apply:** After making code changes that also modify .claude/ files, stage them together. Don't leave .claude/ changes unstaged.
