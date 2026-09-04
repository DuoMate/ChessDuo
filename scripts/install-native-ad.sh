#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

APP_ID="${NEXT_PUBLIC_ADMOB_APP_ID:-}"
if [ -z "$APP_ID" ] && [ -f ".env.production" ]; then
  set -a
  source .env.production
  set +a
  APP_ID="${NEXT_PUBLIC_ADMOB_APP_ID:-}"
fi

if [ -z "$APP_ID" ]; then
  echo "[ERR] NEXT_PUBLIC_ADMOB_APP_ID is required for Android AdMob builds"
  exit 1
fi

JAVA_DIR="android/app/src/main/java/com/navron/chessduo"
mkdir -p "$JAVA_DIR"
cp android-patches/NativeAdPlugin.java "$JAVA_DIR/NativeAdPlugin.java"

APP_BUILD_GRADLE="android/app/build.gradle"
if ! grep -q "play-services-ads:" "$APP_BUILD_GRADLE"; then
  sed -i "/dependencies {/a\    implementation 'com.google.android.gms:play-services-ads:24.5.0'" "$APP_BUILD_GRADLE"
fi

MANIFEST="android/app/src/main/AndroidManifest.xml"
if ! grep -q 'com.google.android.gms.ads.APPLICATION_ID' "$MANIFEST"; then
  sed -i "/<application/a\        <meta-data android:name=\"com.google.android.gms.ads.APPLICATION_ID\" android:value=\"$APP_ID\" />" "$MANIFEST"
fi

echo "[OK] Native AdMob Android plugin installed"