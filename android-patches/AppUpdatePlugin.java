package com.navron.chessduo;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;

import androidx.annotation.NonNull;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.tasks.Task;
import com.google.android.play.core.appupdate.AppUpdateInfo;
import com.google.android.play.core.appupdate.AppUpdateManager;
import com.google.android.play.core.appupdate.AppUpdateManagerFactory;
import com.google.android.play.core.appupdate.AppUpdateOptions;
import com.google.android.play.core.install.InstallState;
import com.google.android.play.core.install.InstallStateUpdatedListener;
import com.google.android.play.core.install.model.AppUpdateType;
import com.google.android.play.core.install.model.InstallStatus;
import com.google.android.play.core.install.model.UpdateAvailability;

/**
 * ChessDuo Google Play In-App Updates bridge (flexible flow).
 *
 * PRESENTATION ONLY — this plugin owns no game, auth, billing, or navigation
 * state. The web layer (React) decides WHETHER to prompt; this plugin answers
 * "is an update actually available on Play for this device/account" via
 * {@link AppUpdateManager} (the per-account source of truth — a hand-synced
 * version.json can never be authoritative for rollout), starts the official
 * FLEXIBLE download flow, streams install-state events to the web layer
 * (`stateChanged`), and finalizes with {@link AppUpdateManager#completeUpdate()}.
 *
 * Fail-silent by contract: every method resolves/rejects without ever gating
 * game flow, and a missing/degraded Play environment reports `available=false`
 * instead of crashing. v1 policy is OPTIONAL-only (FLEXIBLE, never IMMEDIATE),
 * mirroring `decideUpdate` in src/features/app-update/appVersion.ts.
 */
@CapacitorPlugin(name = "AppUpdate")
public class AppUpdatePlugin extends Plugin {

    private static final String TAG = "ChessDuoAppUpdate";

    /**
     * Request code for the flexible-update confirmation activity. Forwarded
     * from MainActivity.onActivityResult (see scripts/patch-main-activity.sh).
     * Kept out of the GoogleProvider auth range and NativeAd/ad request codes.
     */
    public static final int UPDATE_REQUEST_CODE = 11001;

    private AppUpdateManager appUpdateManager;
    private boolean listenerRegistered = false;
    private InstallStateUpdatedListener installListener;

    @Override
    public void load() {
        super.load();
        registerInstallListener();
    }

    private synchronized AppUpdateManager manager() {
        if (appUpdateManager == null) {
            appUpdateManager = AppUpdateManagerFactory.create(getContext());
        }
        return appUpdateManager;
    }

    private synchronized void registerInstallListener() {
        if (listenerRegistered) return;
        installListener = new InstallStateUpdatedListener() {
            @Override
            public void onStateUpdate(@NonNull InstallState state) {
                emitState(state);
            }
        };
        try {
            manager().registerListener(installListener);
            listenerRegistered = true;
        } catch (Exception e) {
            // Best-effort — a listener failure should never affect game flow.
            Log.w(TAG, "registerListener failed (best-effort)", e);
        }
    }

    private void emitState(InstallState state) {
        JSObject event = new JSObject();
        event.put("status", state.installStatus());
        event.put("statusName", installStatusName(state.installStatus()));
        event.put("bytesDownloaded", state.bytesDownloaded());
        event.put("totalBytesToDownload", state.totalBytesToDownload());
        event.put("installErrorCode", state.installErrorCode());
        notifyListeners("stateChanged", event);
    }

    private String installStatusName(int status) {
        switch (status) {
            case InstallStatus.DOWNLOADED:
                return "downloaded";
            case InstallStatus.DOWNLOADING:
                return "downloading";
            case InstallStatus.INSTALLED:
                return "installed";
            case InstallStatus.INSTALLING:
                return "installing";
            case InstallStatus.PENDING:
                return "pending";
            case InstallStatus.FAILED:
                return "failed";
            case InstallStatus.CANCELED:
                return "canceled";
            default:
                return "unknown";
        }
    }

    /**
     * Answers "is an update genuinely available for THIS device/account?".
     * Per-account truth from Play (rollout-aware) — never from a remote
     * manifest. Fail-silent: any Play/API/network problem reports
     * available=false so the UI simply doesn't prompt.
     */
    @PluginMethod
    public void check(PluginCall call) {
        registerInstallListener();
        Task<AppUpdateInfo> task;
        try {
            task = manager().getAppUpdateInfo();
        } catch (Exception e) {
            Log.w(TAG, "getAppUpdateInfo unavailable (best-effort)", e);
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("availableVersionCode", 0);
            result.put("stalenessDays", 0);
            result.put("flexibleAllowed", false);
            result.put("immediateAllowed", false);
            result.put("updateAvailability", UpdateAvailability.UNKNOWN);
            call.resolve(result);
            return;
        }

        task.addOnSuccessListener(info -> {
            int availability = info.updateAvailability();
            boolean flexible = info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE);
            JSObject result = new JSObject();
            result.put("available", availability == UpdateAvailability.UPDATE_AVAILABLE);
            result.put("availableVersionCode", info.availableVersionCode());
            result.put("stalenessDays", info.clientVersionStalenessDays());
            result.put("flexibleAllowed", flexible);
            result.put("immediateAllowed", info.isUpdateTypeAllowed(AppUpdateType.IMMEDIATE));
            result.put("updateAvailability", availability);
            Log.d(TAG, "check: availability=" + availability
                + " availableVersionCode=" + info.availableVersionCode()
                + " flexibleAllowed=" + flexible);
            call.resolve(result);
        }).addOnFailureListener(e -> {
            // Play Core unavailable / Play services degraded / sideload build —
            // never crash, never nag. Treat as no-update.
            Log.w(TAG, "getAppUpdateInfo failed (best-effort)", e);
            JSObject result = new JSObject();
            result.put("available", false);
            result.put("availableVersionCode", 0);
            result.put("stalenessDays", 0);
            result.put("flexibleAllowed", false);
            result.put("immediateAllowed", false);
            result.put("updateAvailability", UpdateAvailability.UNKNOWN);
            call.resolve(result);
        });
    }

    /**
     * Starts Google's official FLEXIBLE in-app update flow. Guarded by
     * eligibility + type-allowed so a stale call can never spawn a flow the
     * device can't run. Cancellation (RESULT_CANCELED) is treated as a normal
     * user choice — the app stays fully usable, exactly like "Later".
     */
    @PluginMethod
    public void startFlexibleUpdate(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity not available");
            return;
        }
        Task<AppUpdateInfo> task;
        try {
            task = manager().getAppUpdateInfo();
        } catch (Exception e) {
            Log.w(TAG, "getAppUpdateInfo unavailable before start (best-effort)", e);
            call.reject("Could not start update");
            return;
        }

        task.addOnSuccessListener(info -> {
            if (info.updateAvailability() != UpdateAvailability.UPDATE_AVAILABLE
                    || !info.isUpdateTypeAllowed(AppUpdateType.FLEXIBLE)) {
                Log.d(TAG, "startFlexibleUpdate skipped: no flexible update available");
                JSObject result = new JSObject();
                result.put("started", false);
                result.put("reason", "update_not_available");
                call.resolve(result);
                return;
            }
            try {
                registerInstallListener();
                AppUpdateOptions options = AppUpdateOptions.newBuilder(AppUpdateType.FLEXIBLE).build();
                manager().startUpdateFlowForResult(info, options, activity, UPDATE_REQUEST_CODE);
                Log.d(TAG, "startFlexibleUpdate: flow started");
                JSObject result = new JSObject();
                result.put("started", true);
                call.resolve(result);
            } catch (Exception e) {
                Log.w(TAG, "startUpdateFlowForResult failed (best-effort)", e);
                call.reject("Could not start update");
            }
        }).addOnFailureListener(e -> {
            Log.w(TAG, "getAppUpdateInfo failed before start (best-effort)", e);
            call.reject("Could not start update");
        });
    }

    /**
     * Finalizes an already-downloaded flexible update (restart-to-install).
     * Only valid once the install listener has observed
     * InstallStatus.DOWNLOADED; otherwise Play throws — surfaced as a reject
     * so the web layer can keep the not-ready UI and never crash.
     */
    @PluginMethod
    public void completeUpdate(PluginCall call) {
        try {
            manager().completeUpdate();
            Log.d(TAG, "completeUpdate issued");
            call.resolve();
        } catch (Exception e) {
            Log.w(TAG, "completeUpdate unavailable (not downloaded yet)", e);
            call.reject("Update is not downloaded yet");
        }
    }

    @PluginMethod
    public void cleanup(PluginCall call) {
        synchronized (this) {
            if (listenerRegistered && installListener != null) {
                try {
                    manager().unregisterListener(installListener);
                } catch (Exception e) {
                    // Best-effort teardown.
                    Log.w(TAG, "unregisterListener failed (best-effort)", e);
                }
                listenerRegistered = false;
                installListener = null;
            }
        }
        call.resolve();
    }

    /**
     * Android forwards the update confirmation result here via
     * Capacitor's bridge. FLEXIBLE flow: RESULT_OK simply means the user
     * accepted the download; cancellation (RESULT_CANCELED) is a normal user
     * choice and must NEVER be treated as a crash/error — the app stays fully
     * usable, exactly like "Later". We forward a diagnostic event so the web
     * layer can log result codes without gating the game.
     */
    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != UPDATE_REQUEST_CODE) return;
        Log.d(TAG, "update flow result: requestCode=" + requestCode + " resultCode=" + resultCode);
        JSObject event = new JSObject();
        event.put("requestCode", requestCode);
        event.put("resultCode", resultCode);
        event.put("cancelled", resultCode == Activity.RESULT_CANCELED);
        notifyListeners("flowResult", event);
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (this) {
            if (listenerRegistered && installListener != null) {
                try {
                    manager().unregisterListener(installListener);
                } catch (Exception e) {
                    // Best-effort teardown during destroy.
                }
                listenerRegistered = false;
                installListener = null;
            }
        }
        appUpdateManager = null;
        super.handleOnDestroy();
    }
}