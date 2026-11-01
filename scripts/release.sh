#!/usr/bin/env bash
# Cut a ccradar release: ./scripts/release.sh 1.2.0
#
# 1. Checks you're on a clean, up-to-date main.
# 2. Runs `claude plugin validate` and `claude plugin test`.
# 3. Moves the "## Unreleased" notes in CHANGELOG.md under the new version.
# 4. Bumps "version" in .claude-plugin/plugin.json.
# 5. Commits, tags vX.Y.Z, pushes (never forced), and creates a GitHub release
#    with those notes when the gh CLI is signed in.
#
# Users then update with: claude plugin update ccradar
set -euo pipefail

die() { echo "release: $*" >&2; exit 1; }

version="${1:-}"
[[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || die "usage: scripts/release.sh X.Y.Z"
tag="v$version"

cd "$(git rev-parse --show-toplevel)"
manifest=".claude-plugin/plugin.json"
changelog="CHANGELOG.md"

# ── 1. state of the repo ──
[ "$(git branch --show-current)" = "main" ] || die "switch to main first"
[ -z "$(git status --porcelain)" ] || die "commit or stash your changes first"
git fetch --quiet --tags origin
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || die "main is not in sync with origin/main (pull or push first)"
git rev-parse -q --verify "refs/tags/$tag" >/dev/null && die "$tag already exists"

current="$(sed -n 's/.*"version": *"\([^"]*\)".*/\1/p' "$manifest" | head -1)"
newest="$(printf '%s\n%s\n' "$current" "$version" | sort -V | tail -1)"
[ "$version" != "$current" ] && [ "$newest" = "$version" ] || die "$version must be newer than $current"

# ── 2. checks ──
echo "› validating"
claude plugin validate . >/dev/null || die "validation failed (run: claude plugin validate .)"
echo "› testing"
claude plugin test . || die "tests failed"

# ── 3. changelog ──
notes="$(awk '/^## Unreleased/{f=1;next} /^## /{f=0} f' "$changelog" | sed '/^[[:space:]]*$/d')"
[ -n "$notes" ] || die "add notes under '## Unreleased' in $changelog first"
today="$(date +%Y-%m-%d)"
awk -v v="$version" -v d="$today" '
  /^## Unreleased/ && !done { print "## Unreleased\n\n## " v " - " d; done=1; next }
  { print }
' "$changelog" > "$changelog.tmp" && mv "$changelog.tmp" "$changelog"

# ── 4. version ──
sed -i.bak "s/\"version\": *\"$current\"/\"version\": \"$version\"/" "$manifest" && rm -f "$manifest.bak"
grep -q "\"version\": \"$version\"" "$manifest" || die "could not bump the version in $manifest"

# ── 5. commit, tag, push ──
git add "$manifest" "$changelog"
git commit --quiet -m "release $tag"
git tag -a "$tag" -m "ccradar $tag"
git push --quiet origin main
git push --quiet origin "$tag"
echo "› pushed $tag"

if command -v gh >/dev/null && gh auth status >/dev/null 2>&1; then
  gh release create "$tag" --title "ccradar $tag" --notes "$notes" >/dev/null
  echo "› GitHub release: $(gh release view "$tag" --json url -q .url)"
else
  echo "› gh not signed in: skipped the GitHub release (the tag is pushed)"
fi

echo "✻ released ccradar $tag. Users update with: claude plugin update ccradar"
