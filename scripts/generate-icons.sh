#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────
# ChessDuo App Icon Generator
# Converts resources/icon.png to all required Android sizes
# Requires: ImageMagick (magick or convert)
# Run: bash scripts/generate-icons.sh
# ──────────────────────────────────────────────────

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

SOURCE="resources/icon.png"
ANDROID_RES="android/app/src/main/res"
BACKGROUND_COLOR="#0f1119"

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
    CONVERTER="magick"
elif command -v convert &>/dev/null; then
    CONVERTER="convert"
else
    echo "[ICONS] ImageMagick not found. Install with: sudo apt-get install imagemagick"
    echo "[ICONS] Skipping icon generation."
    exit 0
fi

# ─── Legacy launcher icons (square, each density) ───
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

# ─── Adaptive icon components (108dp per Android spec) ───
declare -A ADAPTIVE=(
    ["mdpi"]=108
    ["hdpi"]=162
    ["xhdpi"]=216
    ["xxhdpi"]=324
    ["xxxhdpi"]=432
)

for density in mdpi hdpi xhdpi xxhdpi xxxhdpi; do
    size=${ADAPTIVE[$density]}
    dir="$ANDROID_RES/mipmap-$density"
    mkdir -p "$dir"

    # Background: solid app color
    "$CONVERTER" -size "${size}x${size}" "xc:${BACKGROUND_COLOR}" "$dir/ic_launcher_background.png" 2>/dev/null

    # Foreground: center the icon at 72% of canvas size with transparency around it.
    # This gives Android's launcher room to mask the icon to squircle/circle shape
    # without clipping the chess piece.
    foreground_size=$(awk "BEGIN { printf \"%.0f\", $size * 0.72 }")
    "$CONVERTER" "$SOURCE" \
        -resize "${foreground_size}x${foreground_size}" \
        -gravity center -background none -extent "${size}x${size}" \
        "$dir/ic_launcher_foreground.png" 2>/dev/null
done

# ─── Copy adaptive icon XML descriptors ───
ADAPTIVE_XML_DIR="$ANDROID_RES/mipmap-anydpi-v26"
mkdir -p "$ADAPTIVE_XML_DIR"

cat > "$ADAPTIVE_XML_DIR/ic_launcher.xml" <<- 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XMLEOF

cat > "$ADAPTIVE_XML_DIR/ic_launcher_round.xml" <<- 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XMLEOF

# ─── Play Store listing icon (512x512) ───
"$CONVERTER" "$SOURCE" -resize 512x512 "resources/icon-playstore.png" 2>/dev/null

echo -e "${GREEN}[ICONS]${NC} Legacy icons:  android/app/src/main/res/mipmap-*/ic_launcher.png"
echo -e "${GREEN}[ICONS]${NC} Adaptive fg:  android/app/src/main/res/mipmap-*/ic_launcher_foreground.png"
echo -e "${GREEN}[ICONS]${NC} Adaptive bg:  android/app/src/main/res/mipmap-*/ic_launcher_background.png"
echo -e "${GREEN}[ICONS]${NC} Adaptive XML: android/app/src/main/res/mipmap-anydpi-v26/"
echo -e "${GREEN}[ICONS]${NC} Play Store:   resources/icon-playstore.png"
