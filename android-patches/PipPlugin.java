package com.navron.chessduo;

import android.app.PictureInPictureParams;
import android.content.res.Configuration;
import android.os.Build;
import android.util.Log;
import android.util.Rational;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * ChessDuo live-game Picture-in-Picture bridge.
 *
 * PRESENTATION ONLY — this plugin owns no chess state, no timers, no game
 * logic. The web layer (React) remains the single source of truth for board
 * position, turn, and clock; this plugin only:
 *
 *  1. Tracks whether PiP is currently ELIGIBLE (set by the web layer while a
 *     match is actively PLAYING with no blocking modal open).
 *  2. Enters PiP with the official framework APIs (auto-enter on Android 12+
 *     via PictureInPictureParams.Builder.setAutoEnterEnabled).
 *  3. Forwards PiP mode changes back to the web layer (`pipModeChanged`
 *     event) so React can swap to the compact PiP presentation.
 *
 * Failure is always fail-silent: every method catches and resolves/rejects
 * without ever touching game state, so PiP can never block moves, clocks,
 * game-over, or navigation.
 */
@CapacitorPlugin(name = "Pip")
public class PipPlugin extends Plugin {
    private static final String TAG = "ChessDuoPip";

    /**
     * Compact PiP aspect ratio (board + turn status + timer). Kept as a
     * single source of truth next to PIP_ASPECT_* in gameConstants.ts.
     */
    private static final int ASPECT_NUM = 3;
    private static final int ASPECT_DEN = 4;

    private boolean eligible = false;
    private boolean inPip = false;
    /**
     * Set when setEligible arrives before the activity is attached. Applied
     * on the next onResume so a publish that raced plugin attach can never
     * leave auto-enter disabled for the rest of the game.
     */
    private boolean pendingApply = false;

    /**
     * Apply auto-enter params for the given eligibility value. Idempotent —
     * safe to call on every resume. Pre-12 devices use onUserLeaveHint
     * instead (no setAutoEnterEnabled API), so this is a no-op there.
     */
    private void applyAutoEnterParams(boolean value) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return;
        if (getActivity() == null) {
            pendingApply = true;
            Log.d(TAG, "applyAutoEnter deferred (activity null), eligible=" + value);
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                PictureInPictureParams params = new PictureInPictureParams.Builder()
                    .setAspectRatio(new Rational(ASPECT_NUM, ASPECT_DEN))
                    .setAutoEnterEnabled(value)
                    .setSeamlessResizeEnabled(true)
                    .build();
                getActivity().setPictureInPictureParams(params);
                Log.d(TAG, "auto-enter params applied, eligible=" + value);
            } catch (Exception e) {
                Log.w(TAG, "setAutoEnter failed (best-effort)", e);
            }
        });
    }

    @PluginMethod
    public void setEligible(PluginCall call) {
        boolean value = call.getBoolean("eligible", false);
        eligible = value;
        if (getActivity() == null) {
            pendingApply = true;
            Log.d(TAG, "setEligible(" + value + "): activity null, deferred to onResume");
            call.resolve();
            return;
        }
        // Android 12+ (API 31): smooth auto-enter on Home/swipe gestures while
        // eligible. Best-effort — never throws into game flow.
        applyAutoEnterParams(value);
        call.resolve();
    }

    @PluginMethod
    public void enter(PluginCall call) {
        if (getActivity() == null) {
            call.reject("Activity not available");
            return;
        }
        if (!eligible) {
            Log.d(TAG, "enter rejected: not eligible (no active game)");
            call.reject("PiP is not eligible (no active game)");
            return;
        }
        Log.d(TAG, "enter requested, eligible=true");
        try {
            PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder()
                .setAspectRatio(new Rational(ASPECT_NUM, ASPECT_DEN));
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                builder.setSeamlessResizeEnabled(true);
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getActivity().enterPictureInPictureMode(builder.build());
                call.resolve();
            } else {
                call.reject("Picture-in-Picture requires Android 8+");
            }
        } catch (Exception e) {
            Log.w(TAG, "enterPictureInPicture failed (best-effort)", e);
            call.reject("Could not enter Picture-in-Picture");
        }
    }

    @PluginMethod
    public void isInPip(PluginCall call) {
        JSObject result = new JSObject();
        result.put("inPip", inPip);
        call.resolve(result);
    }

    /**
     * Called by MainActivity.onPictureInPictureModeChanged (forwarded). Keeps
     * the cached flag and notifies web listeners so React can swap between
     * the full game shell and the compact PiP presentation.
     */
    public void onPipModeChanged(boolean isInPictureInPictureMode, Configuration newConfig) {
        inPip = isInPictureInPictureMode;
        // Leaving PiP revokes auto-enter eligibility until the web layer
        // re-asserts it (it only does so while PLAYING with no modal open).
        if (!inPip && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && getActivity() != null) {
            applyAutoEnterParams(eligible);
        }
        JSObject event = new JSObject();
        event.put("inPip", inPip);
        notifyListeners("pipModeChanged", event);
    }

    /** Read by MainActivity.onUserLeaveHint to gate auto-enter. */
    public boolean isEligible() {
        return eligible;
    }

    /** Read by MainActivity for diagnostics/tests. */
    public boolean isInPip() {
        return inPip;
    }

    /**
     * Re-assert auto-enter params on every resume (idempotent). Covers the
     * case where setEligible arrived before the activity was attached, and
     * any params lost across backgrounding. Presentation only — never
     * touches game state.
     */
    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        if (getActivity() == null) return;
        if (pendingApply) {
            pendingApply = false;
            Log.d(TAG, "onResume: applying deferred eligible=" + eligible);
        } else if (eligible) {
            Log.d(TAG, "onResume: re-asserting eligible=true");
        } else {
            return;
        }
        applyAutoEnterParams(eligible);
    }

    @Override
    protected void handleOnDestroy() {
        eligible = false;
        inPip = false;
        super.handleOnDestroy();
    }
}
