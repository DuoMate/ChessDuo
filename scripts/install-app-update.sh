#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

JAVA_DIR="android/app/src/main/java/com/navron/chessduo"
PATCH="android-patches/AppUpdatePlugin.java"
APP_BUILD_GRADLE="android/app/build.gradle"

if [ ! -f "$PATCH" ]; then
  echo "[ERR] $PATCH not found"
  exit 1
fi

if [ ! -d "android" ]; then
  echo "[ERR] android/ project not found — run setup-capacitor.sh / cap add android first"
  exit 1
fi

mkdir -p "$JAVA_DIR"
cp "$PATCH" "$JAVA_DIR/AppUpdatePlugin.java"

# Google Play In-App Updates (Flexible, per-account truth for update prompts).
# Idempotent — safe to re-run on every build.
if ! grep -q "play:app-update:" "$APP_BUILD_GRADLE"; then
  sed -i "/dependencies {/a\    implementation 'com.google.android.play:app-update:2.1.0'" "$APP_BUILD_GRADLE"
fi

echo "[OK] Google Play In-App Update plugin installed (AppUpdatePlugin.java)"