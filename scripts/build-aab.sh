 #!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────
# ChessDuo AAB Builder (Google Play Store)
# Builds a signed release AAB for Play Console upload
# Prerequisite: Run scripts/setup-capacitor.sh first
# Run: bash scripts/build-aab.sh
# ──────────────────────────────────────────────────

RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m'
log()  { echo -e "${CYAN}[BUILD]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
err()  { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Clean old build outputs ─────────────────────
log "Cleaning old build outputs..."
rm -rf android/app/build/outputs
ok "Old build outputs cleaned"

# ─── Use Java 21 for Gradle compatibility ─────────
if [ -f /usr/lib/jvm/java-21-openjdk-amd64/bin/java ]; then
    export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
elif [ -d /usr/local/sdkman/candidates/java/21.0.10-ms ]; then
    export JAVA_HOME=/usr/local/sdkman/candidates/java/21.0.10-ms
elif [ -f /usr/lib/jvm/java-17-openjdk-amd64/bin/java ]; then
    export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
fi
if [ -n "${JAVA_HOME:-}" ]; then
    export PATH="$JAVA_HOME/bin:$PATH"
    ok "Java: $($JAVA_HOME/bin/java -version 2>&1 | head -1)"
fi

# ─── Android SDK ───────────────────────────────
if [ -z "${ANDROID_HOME:-}" ]; then
    if [ -d "$HOME/android-sdk" ]; then
        export ANDROID_HOME="$HOME/android-sdk"
    elif [ -d "$HOME/Android/Sdk" ]; then
        export ANDROID_HOME="$HOME/Android/Sdk"
    fi
fi
if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "$ANDROID_HOME" ]; then
    err "ANDROID_HOME not set. Run: npm run cap:setup"
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

# ─── Verify keystore fingerprint (CI only) ──────
if [ -n "${EXPECTED_KEYSTORE_SHA1:-}" ]; then
  ACTUAL_SHA1=$(keytool -list -v -keystore "$PROJECT_ROOT/chessduo.keystore" -storepass "$storePassword" 2>&1 | grep "SHA1:" | awk '{print $NF}') || true
  if [ "$ACTUAL_SHA1" != "$EXPECTED_KEYSTORE_SHA1" ]; then
    err "Keystore fingerprint mismatch! Expected $EXPECTED_KEYSTORE_SHA1, got $ACTUAL_SHA1"
  fi
  ok "Keystore fingerprint verified: $ACTUAL_SHA1"
fi

# ─── Validate environment variables ──────────────
# Required vars must be set in the environment (CI) or in .env.production.
# Next.js auto-loads .env.production during build, but we check here for
# fast failure. Copy .env.example to .env.production and fill in real values.
REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID"
  "NEXT_PUBLIC_SITE_URL"
  "NEXT_PUBLIC_ADMOB_APP_ID"
  "NEXT_PUBLIC_ADMOB_NATIVE_ID"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
  if [ -z "${!var:-}" ]; then
    MISSING_VARS+=("$var")
  fi
done

if [ "${#MISSING_VARS[@]}" -gt 0 ]; then
  if [ -f ".env.production" ]; then
    set -a; source .env.production; set +a
    MISSING_VARS=()
    for var in "${REQUIRED_VARS[@]}"; do
      [ -z "${!var:-}" ] && MISSING_VARS+=("$var")
    done
  fi
fi

if [ "${#MISSING_VARS[@]}" -gt 0 ]; then
  err "Missing required env var(s): ${MISSING_VARS[*]}. Set the corresponding GitHub secrets or create .env.production (see .env.example)."
fi

ok "All required env vars are set"

# ─── Build Next.js static export ─────────────────
log "Building Next.js static export..."
rm -rf .next

# Copy Stockfish WASM for in-device engine
log "Copying Stockfish WASM assets..."
mkdir -p public/stockfish
cp node_modules/stockfish/bin/stockfish-18-lite-single.js public/stockfish/
cp node_modules/stockfish/bin/stockfish-18-lite-single.wasm public/stockfish/
ok "Stockfish WASM assets copied"

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

# ─── Sync web assets ───────────────────────────
log "Syncing Capacitor web assets..."
echo "sdk.dir=$ANDROID_HOME" > android/local.properties
npx cap sync android
ok "Sync complete"

# ─── Install bounded Native AdMob plugin ─────────
bash "$PROJECT_ROOT/scripts/install-native-ad.sh"

# ─── Add deep link intent filters (App Links + custom schemes) ──
bash scripts/add-deep-link.sh
ok "Deep link intent filters added"

# ─── Disable unused social login providers (only Google/Gmail) ──
echo "" >> android/gradle.properties
echo "# Disable social login providers not in use (only Google/Gmail is used)" >> android/gradle.properties
echo "socialLogin.facebook.include=false" >> android/gradle.properties
echo "socialLogin.apple.include=false" >> android/gradle.properties
echo "socialLogin.twitter.include=false" >> android/gradle.properties
ok "Unused social login providers disabled"

# ─── Patch MainActivity.java for Google auth intent forwarding ──
bash "$PROJECT_ROOT/scripts/patch-main-activity.sh"

# ─── Copy custom app icons ──
bash "$PROJECT_ROOT/scripts/copy-app-icons.sh"

# ─── AdMob permissions and metadata are applied by install-native-ad.sh ──
ok "AdMob permissions and metadata handled by native plugin setup"

# ─── Ensure POST_NOTIFICATIONS permission for push (Android 13+) ──
MANIFEST="android/app/src/main/AndroidManifest.xml"
if [ -f "$MANIFEST" ] && ! grep -q 'POST_NOTIFICATIONS' "$MANIFEST" 2>/dev/null; then
  sed -i '/<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/a\    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />' "$MANIFEST"
  ok "POST_NOTIFICATIONS permission added (required for Android 13+)"
fi

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

# ─── Generate app icons ────────────────────────
if [ -f "scripts/generate-icons.sh" ]; then
    log "Generating app icons..."
    bash scripts/generate-icons.sh
fi

# ─── Configure Google Services for Firebase/FCM ──
GOOGLE_SERVICES_JSON="android/app/google-services.json"
PROJECT_BUILD_GRADLE="android/build.gradle"
APP_BUILD_GRADLE="android/app/build.gradle"
if [ -f "$GOOGLE_SERVICES_JSON" ]; then
  if ! grep -q "google-services" "$PROJECT_BUILD_GRADLE" 2>/dev/null; then
    sed -i "/classpath 'com.android.tools.build:gradle:/a \        classpath 'com.google.gms:google-services:4.4.2'" "$PROJECT_BUILD_GRADLE"
    ok "Google Services classpath added to project build.gradle"
  fi
  if ! grep -q "google-services" "$APP_BUILD_GRADLE" 2>/dev/null; then
    echo '' >> "$APP_BUILD_GRADLE"
    echo 'apply plugin: "com.google.gms.google-services"' >> "$APP_BUILD_GRADLE"
    ok "Google Services plugin applied to app build.gradle"
  fi
else
  log "Skipping Google Services config (google-services.json not found — push notifications won't work)"
fi

# ─── Enable R8 minification + resource shrinking (release) ──
# Capacitor's generated app/build.gradle always ships `minifyEnabled false`
# inside its own `buildTypes { release { ... } }` block, so a "only inject if
# buildTypes absent" check would be skipped and R8 would never run (leaving the
# release DEX effectively unobfuscated — Play Console flags this). Force it on
# idempotently against the existing block instead of appending a new one.
BUILD_GRADLE="android/app/build.gradle"
sed -i 's/minifyEnabled false/minifyEnabled true/' "$BUILD_GRADLE"
if ! grep -q 'shrinkResources true' "$BUILD_GRADLE" 2>/dev/null; then
    sed -i '/minifyEnabled true/a\            shrinkResources true' "$BUILD_GRADLE"
fi
sed -i "s/getDefaultProguardFile('proguard-android.txt')/getDefaultProguardFile('proguard-android-optimize.txt')/" "$BUILD_GRADLE"
ok "R8 minification + resource shrinking enabled for release"

# ─── Inject signing config ──────────────────────
if ! grep -q "keystore.properties" "$BUILD_GRADLE" 2>/dev/null; then
    log "Injecting signing config into build.gradle..."
    cat >> "$BUILD_GRADLE" << 'GRADLE'

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
fi

# ─── Override GoogleProvider.java with patched version ──
PATCH_SRC="android-patches/GoogleProvider.java"
PATCH_DST="node_modules/@capgo/capacitor-social-login/android/src/main/java/ee/forgr/capacitor/social/login/GoogleProvider.java"
if [ -f "$PATCH_SRC" ]; then
    cp "$PATCH_SRC" "$PATCH_DST"
    ok "GoogleProvider.java overridden with patched version"
else
    err "Patched GoogleProvider.java not found at $PATCH_SRC"
fi

# ─── Exclude androidbrowserhelper from the release DEX ──
# @capgo/capacitor-social-login pulls androidbrowserhelper:2.5.0 in as an
# `implementation` dependency (Google provider block). The actual Google
# sign-in path (patched GoogleProvider.java) does NOT use it — the only
# reference is an unused `TwaLauncher` import in the disabled AppleProvider.
# androidbrowserhelper's WebViewFallbackActivity/Utils call the deprecated
# Window.setStatusBarColor/setNavigationBarColor/getStatusBarColor APIs that
# Play Console flags under Android 15 edge-to-edge. Demote it to compileOnly
# so it is kept off the compile classpath only and excluded from the AAB.
SL_GRADLE="node_modules/@capgo/capacitor-social-login/android/build.gradle"
sed -i "s/implementation('com.google.androidbrowserhelper:androidbrowserhelper:2.5.0')/compileOnly('com.google.androidbrowserhelper:androidbrowserhelper:2.5.0')/" "$SL_GRADLE"
ok "androidbrowserhelper demoted to compileOnly (excluded from release DEX)"

# ─── Build AAB ──────────────────────────────────
log "Building release AAB (this may take 3-5 minutes)..."
cd android
./gradlew --stop 2>/dev/null || true
./gradlew bundleRelease
cd ..

AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB_PATH" ]; then
    AAB_SIZE=$(du -h "$AAB_PATH" | cut -f1)
    ok "AAB built successfully!"
    echo ""
    echo "  ────────────────────────────────────────"
    echo -e "  ${GREEN}📦 AAB Ready for Play Store${NC}"
    echo "  ────────────────────────────────────────"
    echo ""
    echo "  Location: $AAB_PATH"
    echo "  Size:     $AAB_SIZE"
    echo ""
    echo "  Next steps:"
    echo "    1. Go to Google Play Console → Create release"
    echo "    2. Upload app-release.aab"
    echo "    3. Fill in store listing (see store/ directory)"
    echo "    4. Submit for review"
    echo ""
else
    err "AAB build failed. Check gradle output above for errors."
fi
