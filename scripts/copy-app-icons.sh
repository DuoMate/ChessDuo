#!/usr/bin/env bash
set -euo pipefail

# Script: Copy custom app icons and splash into Capacitor Android project
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

echo "[INFO] Copying adaptive-icon XML descriptors..."
ADAPTIVE_SRC="android-patches/mipmap-anydpi-v26"
ADAPTIVE_DST="android/app/src/main/res/mipmap-anydpi-v26"
if [ -d "$ADAPTIVE_SRC" ]; then
  mkdir -p "$ADAPTIVE_DST"
  cp "$ADAPTIVE_SRC/ic_launcher.xml" "$ADAPTIVE_DST/"
  cp "$ADAPTIVE_SRC/ic_launcher_round.xml" "$ADAPTIVE_DST/"
  echo "       Copied adaptive-icon XML descriptors"
fi

echo "[INFO] Copying custom splash screens..."

for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
  SRC_FILE="$ICON_SRC/$density/splash.png"
  if [ -f "$SRC_FILE" ]; then
    # Main fallback splash
    cp "$SRC_FILE" "$ANDROID_RES/drawable/splash.png"
    # Portrait splash
    cp "$SRC_FILE" "$ANDROID_RES/drawable-port-$density/splash.png"
    # Landscape splash (same icon, centered on dark background)
    cp "$SRC_FILE" "$ANDROID_RES/drawable-land-$density/splash.png"
    echo "       Copied $density splash"
  fi
done

echo "[OK]  App icons and splash installed"
