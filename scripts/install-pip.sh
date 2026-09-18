#!/usr/bin/env bash
set -euo pipefail

# Script: Install the ChessDuo live-game Picture-in-Picture Capacitor plugin.
# Copies android-patches/PipPlugin.java into the generated Android project.
# Safe to re-run. Presentation-only bridge — no game logic, no manifest IDs.
# Mirrors install-native-ad.sh (copy pattern) without env requirements.

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

JAVA_DIR="android/app/src/main/java/com/navron/chessduo"
PATCH="android-patches/PipPlugin.java"

if [ ! -f "$PATCH" ]; then
  echo "[ERR] $PATCH not found"
  exit 1
fi

if [ ! -d "android" ]; then
  echo "[ERR] android/ project not found — run setup-capacitor.sh / cap add android first"
  exit 1
fi

mkdir -p "$JAVA_DIR"
cp "$PATCH" "$JAVA_DIR/PipPlugin.java"

echo "[OK] PiP Capacitor plugin installed (PipPlugin.java)"
