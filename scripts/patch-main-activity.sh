#!/usr/bin/env bash
set -euo pipefail

# Script: Patch MainActivity.java for Google auth intents, Native AdMob,
# edge-to-edge, and live-game Picture-in-Picture (PiP).
# The default BridgeActivity doesn't route Google's authorization intents
# (dynamic request codes in GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN range)
# to the SocialLoginPlugin.handleGoogleLoginIntent() method.
# Without this, the consent flow hangs after SHA-1 is fixed.

MAIN_ACTIVITY="android/app/src/main/java/com/navron/chessduo/MainActivity.java"

if [ ! -f "$MAIN_ACTIVITY" ]; then
  echo "[ERR] MainActivity.java not found at $MAIN_ACTIVITY"
  exit 1
fi

# Check if already patched. A file from an older version without edge-to-edge
# or PiP is deliberately re-patched so all generated builds converge on this
# version.
if grep -q "EdgeToEdge.enable" "$MAIN_ACTIVITY" 2>/dev/null \
    && grep -q "registerPlugin(NativeAdPlugin.class)" "$MAIN_ACTIVITY" 2>/dev/null \
    && grep -q "registerPlugin(PipPlugin.class)" "$MAIN_ACTIVITY" 2>/dev/null \
    && grep -q "onPictureInPictureModeChanged" "$MAIN_ACTIVITY" 2>/dev/null; then
  echo "[OK]  MainActivity.java already patched"
  exit 0
fi

echo "[INFO] Patching MainActivity.java (Google auth intents + Native AdMob + edge-to-edge + PiP)..."

cat > "$MAIN_ACTIVITY" << 'JAVA'
package com.navron.chessduo;

import android.app.PictureInPictureParams;
import android.content.Intent;
import android.content.res.Configuration;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(NativeAdPlugin.class);
        registerPlugin(AppUpdatePlugin.class);
        registerPlugin(PipPlugin.class);
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

    // ── Live-game Picture-in-Picture ──────────────────────────────
    // Presentation only: the web game state (board, turn, clock) remains the
    // single source of truth. These callbacks only gate entry and forward
    // mode changes to the PipPlugin so the web layer can swap to its compact
    // PiP presentation. They never touch game state, timers, or navigation.

    @Override
    public void onPictureInPictureModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig);
        try {
            PluginHandle pluginHandle = getBridge() != null ? getBridge().getPlugin("Pip") : null;
            if (pluginHandle != null && pluginHandle.getInstance() instanceof PipPlugin) {
                ((PipPlugin) pluginHandle.getInstance())
                    .onPipModeChanged(isInPictureInPictureMode, newConfig);
            }
        } catch (Exception ignored) {
            // PiP mode forwarding is best-effort and must never affect gameplay.
        }
    }

    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        // Pre-Android-12 path: no setAutoEnterEnabled exists, so enter here
        // when (and only when) the web layer flagged an active game. On
        // Android 12+ the auto-enter params set by PipPlugin.setEligible own
        // the transition and this manual enter is skipped.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        try {
            PluginHandle pluginHandle = getBridge() != null ? getBridge().getPlugin("Pip") : null;
            if (pluginHandle != null
                    && pluginHandle.getInstance() instanceof PipPlugin
                    && ((PipPlugin) pluginHandle.getInstance()).isEligible()) {
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(3, 4))
                    .build();
                enterPictureInPictureMode(params);
            }
        } catch (Exception ignored) {
            // Entering PiP is best-effort and must never affect gameplay.
        }
    }
}
JAVA

echo "[OK]  MainActivity.java patched"
