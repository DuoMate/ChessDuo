#!/usr/bin/env bash
set -euo pipefail

# Script: Patch MainActivity.java for Google auth intents + Android 15 edge-to-edge.
# (1) The default BridgeActivity doesn't route Google's authorization intents
#     (dynamic request codes in GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN range)
#     to the SocialLoginPlugin.handleGoogleLoginIntent() method.
#     Without this, the consent flow hangs after SHA-1 is fixed.
# (2) Android 15 (SDK 35+) enforces edge-to-edge by default; enable it explicitly
#     (with backward-compat via androidx EdgeToEdge) so the WebView draws behind the
#     system bars and the web layer's env(safe-area-inset-*) padding resolves.

MAIN_ACTIVITY="android/app/src/main/java/com/navron/chessduo/MainActivity.java"

if [ ! -f "$MAIN_ACTIVITY" ]; then
  echo "[ERR] MainActivity.java not found at $MAIN_ACTIVITY"
  exit 1
fi

# Check if already patched (use the newest marker so a file patched by an older
# version of this script without the edge-to-edge onCreate still gets re-patched).
if grep -q "EdgeToEdge.enable" "$MAIN_ACTIVITY" 2>/dev/null; then
  echo "[OK]  MainActivity.java already patched"
  exit 0
fi

echo "[INFO] Patching MainActivity.java (Google auth intents + edge-to-edge)..."

cat > "$MAIN_ACTIVITY" << 'JAVA'
package com.navron.chessduo;

import android.content.Intent;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN
                && requestCode <= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle pluginHandle = getBridge().getPlugin("SocialLogin");
            if (pluginHandle != null) {
                SocialLoginPlugin plugin = (SocialLoginPlugin) pluginHandle.getInstance();
                plugin.handleGoogleLoginIntent(requestCode, data);
            }
        }
    }
}
JAVA

echo "[OK]  MainActivity.java patched"
