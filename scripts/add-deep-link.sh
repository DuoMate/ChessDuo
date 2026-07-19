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

if grep -q "com.navron.chessduo" "$MANIFEST" 2>/dev/null && grep -q "android:autoVerify" "$MANIFEST" 2>/dev/null; then
  echo "[OK]  All deep link intent filters already exist in AndroidManifest.xml"
  exit 0
fi

SITE_URL="${NEXT_PUBLIC_SITE_URL:-chessduo.chessdoubles27.workers.dev}"
SITE_HOST=$(echo "$SITE_URL" | sed 's|https\?://||' | sed 's|/.*||')

echo "[INFO] Adding deep link intent filters (OAuth + App Links + Custom Scheme) ..."

awk -v site_host="$SITE_HOST" '
  /<\/activity>/ && !done {
    print "            <!-- OAuth callback: com.navron.chessduo:// -->"
    print "            <intent-filter>"
    print "                <action android:name=\"android.intent.action.VIEW\" />"
    print "                <category android:name=\"android.intent.category.DEFAULT\" />"
    print "                <category android:name=\"android.intent.category.BROWSABLE\" />"
    print "                <data android:scheme=\"com.navron.chessduo\" />"
    print "            </intent-filter>"
    print ""
    print "            <!-- Android App Links: https://site_host/* (verified deep links with browser fallback) -->"
    print "            <intent-filter android:autoVerify=\"true\">"
    print "                <action android:name=\"android.intent.action.VIEW\" />"
    print "                <category android:name=\"android.intent.category.DEFAULT\" />"
    print "                <category android:name=\"android.intent.category.BROWSABLE\" />"
    print "                <data android:scheme=\"https\" android:host=\"" site_host "\" />"
    print "            </intent-filter>"
    print ""
    print "            <!-- Custom scheme: chessduo://challenge/* (bypasses browser, app-only) -->"
    print "            <intent-filter>"
    print "                <action android:name=\"android.intent.action.VIEW\" />"
    print "                <category android:name=\"android.intent.category.DEFAULT\" />"
    print "                <category android:name=\"android.intent.category.BROWSABLE\" />"
    print "                <data android:scheme=\"chessduo\" />"
    print "            </intent-filter>"
    done=1
  }
  { print }
' "$MANIFEST" > "${MANIFEST}.tmp" && mv "${MANIFEST}.tmp" "$MANIFEST"

echo "[OK]  All deep link intent filters added"
