#!/usr/bin/env bash
# Build a demo from src/<name> and publish it to site/demos/<name>.
#
#   bash publish.sh oralpilot|soma
#
# The live copy is replaced only after the build succeeds, so a failed or
# in-progress build never shows on the site.
set -euo pipefail
cd "$(dirname "$0")"

name="${1:-}"
case "$name" in
  oralpilot | soma) ;;
  *) echo "usage: bash publish.sh oralpilot|soma" >&2; exit 1 ;;
esac

src="src/$name"
out="$(mktemp -d)"
trap 'rm -rf "$out"' EXIT

(cd "$src" && npm run build:static -- "$out")

# brand/ (OralPilot's logo files) is not used by the demo pages.
rsync -a --delete --delete-excluded --exclude 'brand/' "$out/" "site/demos/$name/"
chmod -R a+rX "site/demos/$name"
echo "published $name -> site/demos/$name/"
