#!/usr/bin/env bash
set -euo pipefail

# Script: Add deep link intent filter to Android manifest for OAuth callback
# This is required for the in-app Capacitor Browser OAuth flow.
# The custom scheme "com.navron.chessduo://" is used as the Supabase OAuth redirect
# target. When Google redirects to this scheme after sign-in, Android opens the app
# and Supabase intercepts the URL to complete authentication.

MANIFEST="android/app/src/main/AndroidManifest.xml"

if [ ! -f "$MANIFEST" ]; then
  echo "[ERR] AndroidManifest.xml not found at $MANIFEST"
  exit 1
fi

if grep -q "com.navron.chessduo" "$MANIFEST" 2>/dev/null; then
  echo "[OK]  Deep link intent filter already exists in AndroidManifest.xml"
  exit 0
fi

echo "[INFO] Adding OAuth deep link intent filter (com.navron.chessduo://) ..."

awk '
  /<\/activity>/ && !done {
    print "            <intent-filter>"
    print "                <action android:name=\"android.intent.action.VIEW\" />"
    print "                <category android:name=\"android.intent.category.DEFAULT\" />"
    print "                <category android:name=\"android.intent.category.BROWSABLE\" />"
    print "                <data android:scheme=\"com.navron.chessduo\" />"
    print "            </intent-filter>"
    done=1
  }
  { print }
' "$MANIFEST" > "${MANIFEST}.tmp" && mv "${MANIFEST}.tmp" "$MANIFEST"

echo "[OK]  Deep link intent filter added"
