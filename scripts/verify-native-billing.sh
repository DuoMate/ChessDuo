#!/usr/bin/env bash
set -euo pipefail

echo "[VERIFY] Checking Capacitor native billing registration..."
grep -R "NativePurchases" android/app android/capacitor-cordova-android-plugins 2>/dev/null >/dev/null || {
  echo "[ERR] NativePurchases registration was not generated"
  exit 1
}

grep -R "capgo-native-purchases" android 2>/dev/null >/dev/null || {
  echo "[ERR] capgo-native-purchases Gradle module was not generated"
  exit 1
}

echo "[OK] NativePurchases registration and Gradle module are present"
