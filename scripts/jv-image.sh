#!/usr/bin/env bash
# Fork: builds the "ntfy jv" image from a committed revision (never the working tree).
# Usage: scripts/jv-image.sh <rev>    e.g. scripts/jv-image.sh HEAD
# Deploy and rollback steps are in scripts/jv-fork-deploy.md; this script only builds and tags.
set -euo pipefail

# Last upstream release this fork is based on. Bump it when merging an upstream release.
UPSTREAM_VERSION=2.34.0

if [ $# -ne 1 ]; then
  echo "Usage: $0 <rev>" >&2
  exit 2
fi

repo=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel)
if ! sha=$(git -C "$repo" rev-parse --verify --quiet "$1^{commit}"); then
  echo "Unknown revision: $1" >&2
  exit 1
fi
short=$(git -C "$repo" rev-parse --short "$sha")
version="${UPSTREAM_VERSION}-jv"
tag="ntfy-jv:${short}"

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
git -C "$repo" archive "$sha" | tar -x -C "$tmp"

echo "VERSION=${version} COMMIT=${short} files=$(find "$tmp" -type f | wc -l) tag=${tag}"
docker build -f "$tmp/Dockerfile-build" \
  --build-arg VERSION="$version" \
  --build-arg COMMIT="$short" \
  -t "$tag" "$tmp"
echo "Built ${tag}"
