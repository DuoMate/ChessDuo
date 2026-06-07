#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────
# ChessDuo APK Builder
# Builds a signed release APK ready for sideload
# Prerequisite: Run scripts/setup-capacitor.sh first
# Run: bash scripts/build-apk.sh
# ──────────────────────────────────────────────────

RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m'
log()  { echo -e "${CYAN}[BUILD]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
err()  { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Use Java 21 for Gradle compatibility ─────────
if [ -f /usr/lib/jvm/java-21-openjdk-amd64/bin/java ]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
    export PATH="$JAVA_HOME/bin:$PATH"
    ok "Using Java 21 for Gradle build"
elif [ -f /usr/lib/jvm/java-17-openjdk-amd64/bin/java ]; then
    export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
    export PATH="$JAVA_HOME/bin:$PATH"
    ok "Using Java 17 for Gradle build"
fi

# ─── Set Android SDK path ─────────────────────────
if [ -z "${ANDROID_HOME:-}" ]; then
    if [ -d "$HOME/android-sdk" ]; then
        export ANDROID_HOME="$HOME/android-sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    fi
fi
if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "$ANDROID_HOME" ]; then
    err "ANDROID_HOME not set and no SDK found at ~/android-sdk or ~/Android/Sdk. Run: npm run cap:setup"
fi
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
ok "ANDROID_HOME=$ANDROID_HOME"

# ─── Verify prerequisites ────────────────────────
if [ ! -d "android" ]; then
    err "android/ directory not found. Run: bash scripts/setup-capacitor.sh"
fi

if [ ! -f "chessduo.keystore" ]; then
    err "chessduo.keystore not found. Run: bash scripts/setup-capacitor.sh"
fi

if [ ! -f "android/keystore.properties" ]; then
    err "android/keystore.properties not found. Run: bash scripts/setup-capacitor.sh"
fi

# Load properties
source android/keystore.properties

# ─── Build Next.js static export ─────────────────
log "Building Next.js static export..."
rm -rf .next
# Move API routes out of src/app so they don't break static export
if [ -d "src/app/api" ]; then
  mv src/app/api /tmp/chessduo-api-routes
  ok "API routes excluded for static build"
fi
NEXT_OUTPUT=export npx next build
ok "Next.js build complete"
# Restore API routes
if [ -d "/tmp/chessduo-api-routes" ]; then
  mv /tmp/chessduo-api-routes src/app/api
  ok "API routes restored"
fi

# ─── Sync web assets ─────────────────────────────
log "Syncing Capacitor web assets..."
echo "sdk.dir=$ANDROID_HOME" > android/local.properties

npx cap sync android
ok "Sync complete"

# ─── Disable unused social login providers (only Google/Gmail) ──
echo "" >> android/gradle.properties
echo "# Disable social login providers not in use (only Google/Gmail is used)" >> android/gradle.properties
echo "socialLogin.facebook.include=false" >> android/gradle.properties
echo "socialLogin.apple.include=false" >> android/gradle.properties
echo "socialLogin.twitter.include=false" >> android/gradle.properties
ok "Unused social login providers disabled"

# ─── Source manifest has tools:node="remove" for ads permissions ──
# No additional patching needed — the source manifest is already correct.
ok "Ads permissions handled via tools:node=remove in source manifest"

# ─── Apply version from android-version.properties ──
VERSION_FILE="android-version.properties"
if [ -f "$VERSION_FILE" ]; then
  source "$VERSION_FILE"
  sed -i "s/versionCode [0-9]*/versionCode $versionCode/" android/app/build.gradle
  sed -i "s/versionName \".*\"/versionName \"$versionName\"/" android/app/build.gradle
  ok "Version set to $versionName ($versionCode)"
else
  warn "android-version.properties not found, using defaults"
fi

# ─── Copy ProGuard rules ────────────────────────
if [ -f "resources/proguard-rules.pro" ]; then
    cp resources/proguard-rules.pro android/app/proguard-rules.pro
    ok "ProGuard rules copied"
fi

# ─── Inject signing config into build.gradle ─────
BUILD_GRADLE="android/app/build.gradle"
if ! grep -q "keystore.properties" "$BUILD_GRADLE" 2>/dev/null; then
    log "Injecting signing config into build.gradle..."
    cat >> "$BUILD_GRADLE" << 'GRADLE'

// ChessDuo signing config
def keystorePropertiesFile = rootProject.file("keystore.properties")
def keystoreProperties = new Properties()
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            storeFile file(keystoreProperties['storeFile'])
            storePassword keystoreProperties['storePassword']
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
GRADLE
    ok "Signing config injected"
else
    ok "Signing config already present"
fi

# ─── Build APK ──────────────────────────────────
log "Building release APK (this may take 3-5 minutes on first run)..."
cd android
./gradlew --stop 2>/dev/null || true
./gradlew assembleRelease
cd ..

APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
if [ -f "$APK_PATH" ]; then
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    ok "APK built successfully!"
    echo ""
    echo "  ────────────────────────────────────────"
    echo -e "  ${GREEN}📦 APK Ready${NC}"
    echo "  ────────────────────────────────────────"
    echo ""
    echo "  Location: $APK_PATH"
    echo "  Size:     $APK_SIZE"
    echo ""
    echo "  To sideload to your phone:"
    echo "    1. Download the APK file to your machine"
    echo "    2. Transfer to your Android phone"
    echo "    3. On phone: Settings → Security → Install from unknown sources"
    echo "    4. Open the APK file → Install"
    echo ""
else
    err "APK build failed. Check gradle output above for errors."
fi
