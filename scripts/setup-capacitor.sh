#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────
# ChessDuo Capacitor Setup Runbook
# One command to bootstrap Android build on any machine
# Run: bash scripts/setup-capacitor.sh
# ──────────────────────────────────────────────────

RED='\033[0;31m' GREEN='\033[0;32m' YELLOW='\033[1;33m' CYAN='\033[0;36m' NC='\033[0m'
log()  { echo -e "${CYAN}[SETUP]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC}   $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC}  $1"; exit 1; }

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo ""
echo "  ♟  ChessDuo Capacitor Setup"
echo "  ────────────────────────────"
echo ""

# ─── 1. Check / Install Java ────────────────────
log "Checking Java..."
if command -v java &>/dev/null; then
    JAVA_VER=$(java -version 2>&1 | head -1)
    ok "Java found: $JAVA_VER"
else
    warn "Java not found. Installing OpenJDK 17..."
    sudo apt-get update -qq && sudo apt-get install -y -qq openjdk-17-jdk
    ok "Java 17 installed"
fi

export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))
ok "JAVA_HOME=$JAVA_HOME"

# ─── 2. Check / Install Android SDK ─────────────
log "Checking Android SDK..."
if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME" ]; then
    ok "ANDROID_HOME=$ANDROID_HOME"
else
    warn "Android SDK not found. Installing..."
    SDK_ROOT="$HOME/android-sdk"
    mkdir -p "$SDK_ROOT"

    CMDTOOLS_URL="https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip"
    CMDTOOLS_ZIP="/tmp/android-cmdline-tools.zip"

    log "Downloading Android command-line tools (~120MB)..."
    curl -sL "$CMDTOOLS_URL" -o "$CMDTOOLS_ZIP"

    log "Extracting..."
    mkdir -p "$SDK_ROOT/cmdline-tools"
    unzip -qo "$CMDTOOLS_ZIP" -d /tmp/android-cmdtools
    mv /tmp/android-cmdtools/cmdline-tools "$SDK_ROOT/cmdline-tools/latest"
    rm -f "$CMDTOOLS_ZIP"

    export ANDROID_HOME="$SDK_ROOT"
    export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"

    # Accept licenses
    log "Accepting SDK licenses..."
    yes | "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses > /dev/null 2>&1

    # Install required packages
    log "Installing Android SDK packages (~500MB)..."
    "$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
        "platform-tools" \
        "platforms;android-34" \
        "build-tools;34.0.0" > /dev/null 2>&1

    ok "Android SDK installed at $ANDROID_HOME"
fi

export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools:$PATH"
ok "ANDROID_HOME=$ANDROID_HOME"

# ─── 3. Check / Install Gradle ──────────────────
log "Checking Gradle..."
if command -v gradle &>/dev/null; then
    ok "Gradle found: $(gradle --version 2>/dev/null | head -1)"
elif [ -f "$HOME/.sdkman/bin/sdkman-init.sh" ]; then
    source "$HOME/.sdkman/bin/sdkman-init.sh"
    if ! command -v gradle &>/dev/null; then
        sdk install gradle > /dev/null 2>&1
    fi
    ok "Gradle installed via sdkman"
else
    warn "Gradle not found. Installing via sdkman..."
    curl -s "https://get.sdkman.io" | bash
    source "$HOME/.sdkman/bin/sdkman-init.sh"
    sdk install gradle > /dev/null 2>&1
    ok "Gradle installed via sdkman"
fi

# ─── 4. Install npm dependencies ────────────────
log "Installing Capacitor packages..."
npm install --save @capacitor/core @capacitor/cli @capacitor/android 2>&1 | tail -1
ok "Capacitor npm packages installed"

# ─── 5. Initialize Capacitor ────────────────────
if [ -d "android" ]; then
    ok "Android project already exists (android/ directory found)"
else
    log "Initializing Capacitor Android project..."
    npx cap add android
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
