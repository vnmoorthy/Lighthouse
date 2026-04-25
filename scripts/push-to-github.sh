#!/usr/bin/env bash
#
# push-to-github.sh — one-shot script to publish Lighthouse to GitHub.
#
# Usage:
#   ./scripts/push-to-github.sh                # uses `gh` to create the repo
#   ./scripts/push-to-github.sh git@github.com:you/lighthouse.git   # manual remote
#
# What it does:
#   1. Initialize a clean git repo if .git/ doesn't exist (or is broken).
#   2. Make a single, clean initial commit.
#   3. If `gh` is installed and authenticated, create the GitHub repo as
#      public and push. Otherwise, expect a remote URL as the first arg
#      and just push.
#
# Safe to re-run: if the repo is already pushed, this just re-pushes any
# new commits.
set -euo pipefail

REPO_NAME="lighthouse"
REPO_DESCRIPTION="Self-hosted Gmail receipt and subscription tracker. Privacy-first. AI-powered. MIT."
DEFAULT_BRANCH="main"

REPO_URL="${1:-}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$HERE"

say() { printf '\033[36m▸\033[0m %s\n' "$*"; }
ok()  { printf '\033[32m✓\033[0m %s\n' "$*"; }
warn(){ printf '\033[33m!\033[0m %s\n' "$*"; }
die() { printf '\033[31m✗\033[0m %s\n' "$*" >&2; exit 1; }

# --- 1. Sanity ---------------------------------------------------------------
command -v git >/dev/null || die "git is not installed."
[[ -f package.json ]] || die "Run this from the lighthouse repo root."

# --- 2. (Re-)initialize a clean .git -----------------------------------------
needs_fresh_init=0
if [[ ! -d .git ]]; then
  needs_fresh_init=1
elif ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  warn "Existing .git/ looks corrupt; reinitializing."
  rm -rf .git
  needs_fresh_init=1
fi

if [[ $needs_fresh_init -eq 1 ]]; then
  say "Initializing fresh git repository..."
  git init -b "$DEFAULT_BRANCH" >/dev/null
  ok "Initialized."
fi

# Set a default identity if the user hasn't configured one.
if ! git config user.email >/dev/null 2>&1; then
  warn "git user.email is not set globally; using a placeholder."
  git config user.email "lighthouse@local"
fi
if ! git config user.name >/dev/null 2>&1; then
  git config user.name "Lighthouse"
fi

# --- 3. Stage and commit -----------------------------------------------------
say "Staging files..."
git add -A
if git diff --cached --quiet; then
  warn "Nothing to commit (working tree matches HEAD)."
else
  if git rev-parse HEAD >/dev/null 2>&1; then
    git commit -m "chore: refresh tree" >/dev/null
    ok "Committed updates."
  else
    git commit -m "Initial commit: Lighthouse v0.1.0

Self-hosted Gmail receipt and subscription tracker.

- TypeScript end-to-end (apps/cli + apps/web + packages/core)
- SQLite via better-sqlite3, argon2id+AES-GCM vault
- Gmail desktop OAuth, MIME parser, incremental fetch
- LLM extraction pipeline (classifier → receipt/subscription → merchant normalize)
- Fastify API + React/Vite/Tailwind dashboard
- Hand-curated rules for 70+ merchants; LLM fallback
- Dedupe + alerts engine: trial endings, price changes, dupes
- ~6,600 lines, 12 unit tests, MIT licensed" >/dev/null
    ok "Initial commit created."
  fi
fi

# --- 4. Push -----------------------------------------------------------------
if [[ -n "$REPO_URL" ]]; then
  say "Using remote URL provided on command line: $REPO_URL"
  if git remote get-url origin >/dev/null 2>&1; then
    git remote set-url origin "$REPO_URL"
  else
    git remote add origin "$REPO_URL"
  fi
  git push -u origin "$DEFAULT_BRANCH"
  ok "Pushed to $REPO_URL."
  exit 0
fi

if command -v gh >/dev/null 2>&1; then
  if ! gh auth status >/dev/null 2>&1; then
    say "gh is installed but not authenticated. Running 'gh auth login'..."
    gh auth login
  fi
  # If origin already points somewhere, just push.
  if git remote get-url origin >/dev/null 2>&1; then
    say "Pushing to existing origin..."
    git push -u origin "$DEFAULT_BRANCH"
    ok "Done."
    exit 0
  fi

  say "Creating GitHub repo and pushing..."
  gh repo create "$REPO_NAME" \
    --public \
    --description "$REPO_DESCRIPTION" \
    --source . \
    --remote origin \
    --push
  ok "Repo created and pushed."
  url="$(gh repo view --json url -q .url)"
  ok "Open it: $url"
  exit 0
fi

cat >&2 <<EOF
✗ Neither a remote URL was provided nor is 'gh' installed.

Two options:

  Option A — install GitHub CLI (recommended):
      brew install gh && gh auth login
      ./scripts/push-to-github.sh

  Option B — create the repo manually at https://github.com/new
      then re-run with the URL:
      ./scripts/push-to-github.sh git@github.com:YOUR-USERNAME/lighthouse.git
EOF
exit 1
