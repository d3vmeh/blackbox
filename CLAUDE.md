# Blackbox — Working Agreement

Causal debugger for AI agents. **4 people, one repo.** These rules keep us from stepping on each other.
Claude Code reads this file automatically — follow it.

## 1. Never commit to `main`. Work only on your own branch.

| Person | Branch | Folders |
|--------|--------|---------|
| P1 | `p1/agent` | `agent/`, `replay/` |
| P2 | `p2/attribution` | `attribution/` |
| P3 | `p3/web` | `web/` |
| P4 | `p4/api` | `api/`, `eval/` |

- **First time:** switch to your branch — `git switch -c p1/agent` (creates it), or
  `git switch p1/agent` if it already exists.
- **Integrate only via Pull Request**, at the agreed checkpoints. Never push to `main`.
- If you ever find yourself on `main`, stop and switch:
  `git switch p1/agent` (or `git switch -c p1/agent`).

## 2. Stay in your own folder

Only edit files under your folder(s) above. The one shared file — **`shared/schema.py`** — is the
contract everyone depends on; change it only by quick team agreement, never silently.

## 3. Commit rules

- **Keep planning/spec/research docs OUT of this repo.** They live outside it. This repo is code only.
- Small, frequent commits on your branch; open a PR to integrate.

## 4. For Claude Code specifically

Before committing: confirm the current branch is **not** `main` (`git rev-parse --abbrev-ref HEAD`).
If it is, switch to the user's branch first. Do not push to `main` or to anyone else's branch.
