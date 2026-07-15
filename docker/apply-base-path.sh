#!/bin/sh
# Render the frontend dist for the configured BASE_PATH.
#
# The standalone image builds the frontend with a placeholder base path
# (/__WIREMOCK_HUB_BASE__/) baked into its assets, and keeps a pristine copy
# of the dist as a tarball. This script extracts that copy and replaces the
# placeholder with BASE_PATH ('' or '/' -> served at the root, '/hub' ->
# served under /hub/).
#
# It is a no-op when the dist is already rendered for the requested
# BASE_PATH (a marker file records the applied value), so the default
# container start performs no filesystem writes.
#
# It can also be run at image build time to bake a base path into a derived
# image (useful with read-only root filesystems). Keep the ENV so the backend
# also strips the prefix at runtime:
#   FROM ghcr.io/ykagano/wiremock-hub-standalone:latest
#   ENV BASE_PATH=/hub
#   RUN /app/apply-base-path.sh
set -e

PLACEHOLDER="/__WIREMOCK_HUB_BASE__"
FRONTEND_DIR="/app/packages/frontend"
DIST_DIR="$FRONTEND_DIR/dist"
TEMPLATE="/app/frontend-dist-template.tar.gz"
# The marker lives outside dist/ so it is never served as a static file
MARKER="$FRONTEND_DIR/.base-path"

# When BASE_PATH is not set at all, keep whatever is currently rendered
# (the root default, or a base path baked into a derived image at build time).
# The first render at image build time runs with BASE_PATH explicitly empty.
if [ -z "${BASE_PATH+x}" ] && [ -f "$MARKER" ]; then
  exit 0
fi

# Normalize to '' (root) or '/sub/path' without a trailing slash
BASE_PATH="${BASE_PATH:-}"
BASE_PATH=$(printf '%s' "$BASE_PATH" | sed 's|/*$||; s|^/*|/|; s|^/$||')

# Reject characters that would break the sed replacement below
case "$BASE_PATH" in
  *[!A-Za-z0-9/_.-]*)
    echo "ERROR: BASE_PATH may only contain letters, digits, '/', '_', '.' and '-' (got '$BASE_PATH')" >&2
    exit 1
    ;;
esac

if [ -f "$MARKER" ] && [ "$(cat "$MARKER")" = "$BASE_PATH" ]; then
  exit 0
fi

echo "Rendering frontend for base path '${BASE_PATH:-/}'..."
rm -f "$MARKER"
rm -rf "$DIST_DIR"
tar -xzf "$TEMPLATE" -C "$FRONTEND_DIR"
find "$DIST_DIR" -type f \
  \( -name '*.js' -o -name '*.css' -o -name '*.html' -o -name '*.json' \
  -o -name '*.svg' -o -name '*.map' -o -name '*.txt' -o -name '*.webmanifest' \) \
  -exec sed -i "s|$PLACEHOLDER|$BASE_PATH|g" {} +
printf '%s' "$BASE_PATH" > "$MARKER"
