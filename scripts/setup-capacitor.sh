#!/usr/bin/env bash
set -eo pipefail

# ──────────────────────────────────────────────────
# ChessDuo Capacitor Setup Runbook
# One command to bootstrap Android build on any machine.
# Safe to re-run — skips steps that are already done.
# Run: bash scripts/setup-capacitor.sh
# ──────────────────────────────────────────────────

RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m'
log()    { echo -e "${CYAN}[SETUP]${NC} $1"; }
ok()     { echo -e "${GREEN}[OK]${NC}   $1"; }
warn()   { echo -e "${YELLOW}[WARN]${NC} $1"; }
fatal()  { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }
section(){ echo ""; echo -e "${CYAN}───${NC} $1 ${CYAN}───${NC}"; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo "  ♟  ChessDuo Capacitor Setup"
echo "  ────────────────────────────"
echo ""

# ─── 1. Check / Install Java ────────────────────
section "1. Java"
if command -v java &>/dev/null; then
    ok "Java found: $(java -version 2>&1 | head -1)"
else
    warn "Java not found. Installing OpenJDK 17..."
    sudo apt-get update -qq && sudo apt-get install -y -qq openjdk-17-jdk || fatal "Failed to install Java"
    ok "Java 17 installed"
fi

export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
ok "JAVA_HOME=$JAVA_HOME"

# ─── 2. Check / Install Android SDK ─────────────
section "2. Android SDK"
SDK_ROOT="${ANDROID_HOME:-$HOME/android-sdk}"
export ANDROID_HOME="$SDK_ROOT"
mkdir -p "$SDK_ROOT"

CMDTOOLS_BIN="$SDK_ROOT/cmdline-tools/latest/bin"
ADB="$SDK_ROOT/platform-tools/adb"
ANDROID_PLATFORM="$SDK_ROOT/platforms/android-34"
BUILD_TOOLS="$SDK_ROOT/build-tools/34.0.0"

need_cmdtools=false
need_platform_tools=false
need_platform=false
need_build_tools=false

[ -x "$CMDTOOLS_BIN/sdkmanager" ] || need_cmdtools=true
[ -x "$ADB" ]                     || need_platform_tools=true
[ -d "$ANDROID_PLATFORM" ]        || need_platform=true
[ -d "$BUILD_TOOLS" ]             || need_build_tools=true

if ! $need_cmdtools && ! $need_platform_tools && ! $need_platform && ! $need_build_tools; then
    ok "Android SDK complete at $ANDROID_HOME"
else
    if $need_cmdtools; then
        warn "Command-line tools not found. Downloading (~120MB)..."
        CMDTOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
        CMDTOOLS_ZIP="/tmp/android-cmdline-tools.zip"
        curl -sL "$CMDTOOLS_URL" -o "$CMDTOOLS_ZIP" || fatal "Failed to download cmdline-tools"
        mkdir -p "$SDK_ROOT/cmdline-tools"
        unzip -qo "$CMDTOOLS_ZIP" -d /tmp/android-cmdtools
        mv /tmp/android-cmdtools/cmdline-tools "$SDK_ROOT/cmdline-tools/latest"
        rm -f "$CMDTOOLS_ZIP"
        ok "Command-line tools installed"
    else
        ok "Command-line tools: already present"
    fi

    export PATH="$CMDTOOLS_BIN:$SDK_ROOT/platform-tools:$PATH"

    # Accept licenses (feed explicit y inputs — newer cmdline-tools requires this)
    if $need_cmdtools || $need_platform_tools || $need_platform || $need_build_tools; then
        log "Accepting SDK licenses..."
        echo -e "y\ny\ny\ny\ny\ny\ny\ny" | sdkmanager --sdk_root="$SDK_ROOT" --licenses > /tmp/sdk-licenses.log 2>&1 || {
            warn "License acceptance had issues (see /tmp/sdk-licenses.log). Continuing..."
        }
        ok "Licenses accepted"
    fi

    # Install platform-tools
    if $need_platform_tools; then
        log "Installing platform-tools..."
        sdkmanager --sdk_root="$SDK_ROOT" "platform-tools" || fatal "Failed to install platform-tools"
        ok "platform-tools installed"
    else
        ok "platform-tools: already present"
    fi

    # Install Android platform
    if $need_platform; then
        log "Installing Android 34 platform (~200MB)..."
        sdkmanager --sdk_root="$SDK_ROOT" "platforms;android-34" || fatal "Failed to install android-34 platform"
        ok "Android platform 34 installed"
    else
        ok "Android platform 34: already present"
    fi

    # Install build-tools
    if $need_build_tools; then
        log "Installing build-tools 34.0.0 (~100MB)..."
        sdkmanager --sdk_root="$SDK_ROOT" "build-tools;34.0.0" || fatal "Failed to install build-tools"
        ok "build-tools 34.0.0 installed"
    else
        ok "build-tools 34.0.0: already present"
    fi
fi

export PATH="$CMDTOOLS_BIN:$SDK_ROOT/platform-tools:$PATH"
ok "ANDROID_HOME=$ANDROID_HOME"

# ─── 3. Check / Install Gradle ──────────────────
section "3. Gradle"
if command -v gradle &>/dev/null; then
    ok "Gradle found: $(gradle --version 2>/dev/null | head -1 || echo 'installed')"
elif [ -f "$HOME/.sdkman/bin/sdkman-init.sh" ]; then
    source "$HOME/.sdkman/bin/sdkman-init.sh" 2>/dev/null || true
    if ! command -v gradle &>/dev/null; then
        warn "Installing Gradle via sdkman..."
        sdk install gradle || fatal "Failed to install Gradle"
    fi
    ok "Gradle installed via sdkman"
else
    warn "Installing sdkman + Gradle..."
    curl -s "https://get.sdkman.io" | bash || fatal "Failed to install sdkman"
    source "$HOME/.sdkman/bin/sdkman-init.sh" 2>/dev/null || true
    sdk install gradle || fatal "Failed to install Gradle"
    ok "Gradle installed"
fi

# ─── 4. Install npm dependencies ────────────────
section "4. Capacitor npm packages"
log "Installing @capacitor/core @capacitor/cli @capacitor/android..."
npm install --save @capacitor/core @capacitor/cli @capacitor/android || fatal "npm install failed"
ok "Capacitor npm packages installed"

# ─── 5. Initialize Capacitor ────────────────────
section "5. Capacitor Android project"
if [ -d "android" ]; then
    ok "Android project already exists (android/ directory found)"
else
    log "Creating Android project..."
    npx cap add android || fatal "Failed to create Android project"
    ok "Android project created"
fi

# ─── 6. Generate keystore ───────────────────────
log "Checking keystore..."
if [ -f "chessduo.keystore" ]; then
    ok "chessduo.keystore already exists"
else
    echo ""
    echo "  ─── Generate Signing Keystore ───"
    echo "  This key identifies your app on the Play Store."
    echo "  ⚠️  SAVE your password — if lost, you can NEVER update the app."
    echo ""

    read -p "  Organization name (e.g., ChessDuo): " ORG_NAME
    read -p "  Organizational unit (e.g., Dev): " ORG_UNIT
    read -p "  City: " ORG_CITY
    read -p "  State/Province: " ORG_STATE
    read -p "  Country code (2 letters, e.g., US): " ORG_COUNTRY
    read -sp "  Keystore password (min 6 chars): " KS_PASSWORD
    echo ""
    read -sp "  Confirm password: " KS_CONFIRM
    echo ""

    if [ "$KS_PASSWORD" != "$KS_CONFIRM" ]; then
        err "Passwords don't match"
    fi

    keytool -genkey -v \
        -keystore chessduo.keystore \
        -alias chessduo \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -dname "CN=${ORG_NAME}, OU=${ORG_UNIT}, O=${ORG_NAME}, L=${ORG_CITY}, ST=${ORG_STATE}, C=${ORG_COUNTRY}" \
        -storepass "$KS_PASSWORD" \
        -keypass "$KS_PASSWORD" 2>/dev/null

    ok "Keystore generated: chessduo.keystore"
fi

# ─── 7. Create keystore.properties ──────────────
if [ -f "android/keystore.properties" ]; then
    ok "android/keystore.properties already exists"
else
    # If we just created the keystore, we already have the password
    if [ -z "${KS_PASSWORD:-}" ]; then
        read -sp "  Enter your keystore password: " KS_PASSWORD
        echo ""
    fi

    cat > android/keystore.properties << PROPS
storeFile=../../chessduo.keystore
storePassword=${KS_PASSWORD}
keyAlias=chessduo
keyPassword=${KS_PASSWORD}
PROPS

    ok "android/keystore.properties created"
fi

# ─── 8. Persist env vars ────────────────────────
for RC_FILE in "$HOME/.bashrc" "$HOME/.zshrc"; do
    if [ -f "$RC_FILE" ]; then
        grep -q "ANDROID_HOME" "$RC_FILE" 2>/dev/null || \
            echo "export ANDROID_HOME=$ANDROID_HOME" >> "$RC_FILE"
        grep -q "JAVA_HOME" "$RC_FILE" 2>/dev/null || \
            echo "export JAVA_HOME=$JAVA_HOME" >> "$RC_FILE"
    fi
done
ok "Environment variables persisted"

# ─── Done ───────────────────────────────────────
echo ""
echo "  ────────────────────────────────────────"
echo -e "  ${GREEN}✅ Setup complete!${NC}"
echo "  ────────────────────────────────────────"
echo ""
echo "  Next steps:"
echo "    1. Commit & deploy latest web code to Render"
echo "    2. Run:  bash scripts/build-apk.sh"
echo "    3. Download APK → sideload to phone"
echo ""
if [ -n "${KS_PASSWORD:-}" ]; then
    echo -e "  ${YELLOW}⚠️  SAVE THIS PASSWORD: ${KS_PASSWORD}${NC}"
    echo "  Email it to yourself or store in a password manager."
    echo "  Without it, you can NEVER update this app on Play Store."
    echo ""
fi
