#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────
# ChessDuo App Icon Generator
# Converts resources/icon.png to all required Android sizes
# Requires: ImageMagick (convert or magick)
# Run: bash scripts/generate-icons.sh
# ──────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

SOURCE="resources/icon.png"
ANDROID_RES="android/app/src/main/res"

if [ ! -f "$SOURCE" ]; then
    echo "[ICONS] No icon.png found in resources/, skipping."
    exit 0
fi

if [ ! -d "$ANDROID_RES" ]; then
    echo "[ICONS] Android project not found (run cap:setup first), skipping."
    exit 0
fi

GREEN='\033[0;32m' NC='\033[0m'
echo -e "${GREEN}[ICONS]${NC} Generating Android app icons from $SOURCE..."

# Find available converter
if command -v magick &>/dev/null; then
    CONVERTER="magick"  # ImageMagick v7+
elif command -v convert &>/dev/null; then
    CONVERTER="convert"  # ImageMagick v6
else
    echo "[ICONS] ImageMagick not found. Install with: sudo apt-get install imagemagick"
    echo "[ICONS] Skipping icon generation. Source is ready in $SOURCE"
    exit 0
fi

# Android icon sizes: mdpi (48), hdpi (72), xhdpi (96), xxhdpi (144), xxxhdpi (192)
declare -A SIZES=(
    ["mdpi"]=48
    ["hdpi"]=72
    ["xhdpi"]=96
    ["xxhdpi"]=144
    ["xxxhdpi"]=192
)

for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    size=${SIZES[$density]}
    dir="$ANDROID_RES/mipmap-$density"
    mkdir -p "$dir"

    "$CONVERTER" "$SOURCE" -resize "${size}x${size}" "$dir/ic_launcher.png" 2>/dev/null
    "$CONVERTER" "$SOURCE" -resize "${size}x${size}" "$dir/ic_launcher_round.png" 2>/dev/null
done

# Adaptive icon components (108dp)
declare -A ADAPTIVE=(
    ["mdpi"]=108
    ["hdpi"]=162
    ["xhdpi"]=216
    ["xxhdpi"]=324
    ["xxxhdpi"]=432
)

for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    size=${ADAPTIVE[$density]}
    dir="$ANDROID_RES/mipmap-anydpi-v26"
    mkdir -p "$dir"

    "$CONVERTER" "$SOURCE" -resize "${size}x${size}" "$dir/ic_launcher_foreground.png" 2>/dev/null
done

# Play Store listing icon (512x512)
"$CONVERTER" "$SOURCE" -resize 512x512 "resources/icon-playstore.png" 2>/dev/null

echo -e "${GREEN}[ICONS]${NC} App icons generated in android/app/src/main/res/mipmap-*"
echo -e "${GREEN}[ICONS]${NC} Play Store icon: resources/icon-playstore.png"
