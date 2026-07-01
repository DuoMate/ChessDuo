#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m' GREEN='\033[0;32m' CYAN='\033[0;36m' NC='\033[0m'
log()  { echo -e "${CYAN}[BUMP]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
err()  { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

VERSION_FILE="android-version.properties"
PACKAGE_JSON="package.json"

[ -f "$VERSION_FILE" ] || err "$VERSION_FILE not found"
[ -f "$PACKAGE_JSON" ] || err "$PACKAGE_JSON not found"

source "$VERSION_FILE"

OLD_VERSION_CODE=$versionCode
OLD_VERSION_NAME=$versionName

NEW_VERSION_CODE=$((OLD_VERSION_CODE + 1))

BASE_VERSION=$(echo "$OLD_VERSION_NAME" | sed 's/\.[0-9]*$//')
LAST_SEGMENT=$(echo "$OLD_VERSION_NAME" | sed 's/.*\.//')
NEW_LAST_SEGMENT=$((LAST_SEGMENT + 1))
NEW_VERSION_NAME="${BASE_VERSION}.${NEW_LAST_SEGMENT}"

cat > "$VERSION_FILE" << EOF
versionCode=$NEW_VERSION_CODE
versionName=$NEW_VERSION_NAME
EOF

sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION_NAME\"/" "$PACKAGE_JSON"

ok "Version bumped: $OLD_VERSION_NAME ($OLD_VERSION_CODE) → $NEW_VERSION_NAME ($NEW_VERSION_CODE)"
