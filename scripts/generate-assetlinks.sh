#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────
# Generate public/.well-known/assetlinks.json
# Extracts SHA256 fingerprint from signing keystore
# for Android App Links verification.
#
# Required env vars (or set inline):
#   KEYSTORE_PASSWORD  — keystore password
#   KEY_ALIAS           — key alias (default: chessduo)
#
# Usage:
#   bash scripts/generate-assetlinks.sh [keystore-path]
# ──────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

KEYSTORE="${1:-chessduo.keystore}"
ALIAS="${KEY_ALIAS:-chessduo}"
PASS="${KEYSTORE_PASSWORD:-}"
DEST="public/.well-known/assetlinks.json"
PACKAGE="com.navron.chessduo"

if [ ! -f "$KEYSTORE" ]; then
  echo "[WARN] Keystore not found at $KEYSTORE — skipping assetlinks.json generation"
  echo "[WARN] App Links verification will fail until this file is generated with the correct fingerprint"
  exit 0
fi

if [ -z "$PASS" ]; then
  echo "[WARN] KEYSTORE_PASSWORD not set — skipping assetlinks.json generation"
  exit 0
fi

echo "[assetlinks] Extracting SHA256 fingerprint from $KEYSTORE..."

if ! command -v keytool &>/dev/null; then
  echo "[WARN] keytool not found — skipping assetlinks.json generation"
  exit 0
fi

SHA256=$(keytool -list -v -keystore "$KEYSTORE" \
  -storepass "$PASS" \
  -alias "$ALIAS" 2>&1 \
  | awk '/SHA256:/ {gsub(/^[[:space:]]*SHA256:[[:space:]]*/,""); gsub(/[[:space:]]/,""); print $0}')

if [ -z "$SHA256" ]; then
  echo "[ERR] Could not extract SHA256 fingerprint from keystore"
  echo "[ERR] Verify keystore path, password, and alias are correct"
  exit 1
fi

echo "[assetlinks] SHA256: $SHA256"

mkdir -p "$(dirname "$DEST")"

cat > "$DEST" <<- EOF
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "$PACKAGE",
    "sha256_cert_fingerprints": ["$SHA256"]
  }
}]
EOF

echo "[assetlinks] Written: $DEST"
echo "[assetlinks] Verify at: https://chessduo.chessdoubles27.workers.dev/.well-known/assetlinks.json"
