#!/usr/bin/env bash
set -euo pipefail

# Script: Copy custom app icons into Capacitor Android project
# Replaces the default Capacitor logo with ChessDuo branded icons

ANDROID_RES="android/app/src/main/res"
ICON_SRC="resources/android"

if [ ! -d "$ICON_SRC" ]; then
  echo "[ERR] Icon source directory not found: $ICON_SRC"
  exit 1
fi

if [ ! -d "$ANDROID_RES" ]; then
  echo "[ERR] Android res directory not found: $ANDROID_RES"
  exit 1
fi

echo "[INFO] Copying custom app icons..."

for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  DST_DIR="$ANDROID_RES/mipmap-$density"
  SRC_DIR="$ICON_SRC/$density"

  if [ -d "$SRC_DIR" ]; then
    for icon_file in "$SRC_DIR"/*.png; do
      if [ -f "$icon_file" ]; then
        cp "$icon_file" "$DST_DIR/"
      fi
    done
    echo "       Copied $density icons"
  fi
done

echo "[OK]  App icons installed"
