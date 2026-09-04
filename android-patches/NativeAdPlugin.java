package com.navron.chessduo;

import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.ads.AdListener;
import com.google.android.gms.ads.AdLoader;
import com.google.android.gms.ads.AdRequest;
import com.google.android.gms.ads.LoadAdError;
import com.google.android.gms.ads.MobileAds;
import com.google.android.gms.ads.nativead.AdChoicesView;
import com.google.android.gms.ads.nativead.MediaView;
import com.google.android.gms.ads.nativead.NativeAd;
import com.google.android.gms.ads.nativead.NativeAdView;

@CapacitorPlugin(name = "NativeAd")
public class NativeAdPlugin extends Plugin {
    private NativeAd loadedAd;
    private NativeAdView visibleAdView;
    private String loadedAdUnitId;
    private boolean sdkInitialized;

    @PluginMethod
    public void preload(PluginCall call) {
        String adUnitId = call.getString("adUnitId", "");
        if (adUnitId == null || adUnitId.trim().isEmpty()) {
            call.reject("Native AdMob unit ID is missing");
            return;
        }

        getActivity().runOnUiThread(() -> {
            initializeSdk();
            if (loadedAd != null && adUnitId.equals(loadedAdUnitId)) {
                call.resolve();
                return;
            }

            AdLoader loader = new AdLoader.Builder(getContext(), adUnitId)
                .forNativeAd(ad -> {
                    destroyLoadedAd();
                    loadedAd = ad;
                    loadedAdUnitId = adUnitId;
                    call.resolve();
                })
                .withAdListener(new AdListener() {
                    @Override
                    public void onAdFailedToLoad(@NonNull LoadAdError error) {
                        call.reject("Native AdMob ad failed to load", String.valueOf(error.getCode()));
                    }
                })
                .build();
            loader.loadAd(new AdRequest.Builder().build());
        });
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (loadedAd == null) {
            call.reject("Native AdMob ad is not ready");
            return;
        }

        double x = call.getDouble("x", 0.0);
        double y = call.getDouble("y", 0.0);
        double width = call.getDouble("width", 0.0);
        double height = call.getDouble("height", 0.0);
        if (width <= 0 || height <= 0) {
            call.reject("Native AdMob bounds are invalid");
            return;
        }

        getActivity().runOnUiThread(() -> {
            View webView = getBridge().getWebView();
            ViewGroup adContainer = (ViewGroup) webView.getParent();
            hideVisibleAd();

            NativeAdView adView = buildAdView(loadedAd);
            float density = getActivity().getResources().getDisplayMetrics().density;
            ViewGroup.LayoutParams layout = new ViewGroup.LayoutParams(
                Math.round((float) width * density),
                Math.round((float) height * density)
            );
            adView.setX((float) x * density);
            adView.setY((float) y * density);
            adView.setLayoutParams(layout);
            adContainer.addView(adView);
            visibleAdView = adView;
            loadedAd = null;
            loadedAdUnitId = null;
            call.resolve();
        });
    }

    @PluginMethod
    public void hide(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            hideVisibleAd();
            call.resolve();
        });
    }

    @Override
    protected void handleOnDestroy() {
        hideVisibleAd();
        destroyLoadedAd();
        super.handleOnDestroy();
    }

    private void initializeSdk() {
        if (sdkInitialized) return;
        sdkInitialized = true;
        MobileAds.initialize(getContext(), status -> { });
    }

    private NativeAdView buildAdView(NativeAd ad) {
        NativeAdView adView = new NativeAdView(getContext());
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(24.0f);
        adView.setBackground(background);
        adView.setPadding(12, 12, 12, 12);

        LinearLayout content = new LinearLayout(getContext());
        content.setOrientation(LinearLayout.VERTICAL);

        MediaView media = new MediaView(getContext());
        content.addView(media, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1.0f
        ));

        LinearLayout details = new LinearLayout(getContext());
        details.setOrientation(LinearLayout.HORIZONTAL);
        details.setGravity(android.view.Gravity.CENTER_VERTICAL);

        ImageView icon = new ImageView(getContext());
        details.addView(icon, new LinearLayout.LayoutParams(48, 48));

        LinearLayout text = new LinearLayout(getContext());
        text.setOrientation(LinearLayout.VERTICAL);
        text.setPadding(10, 0, 8, 0);
        TextView headline = textView(15, Color.BLACK);
        TextView advertiser = textView(12, Color.DKGRAY);
        text.addView(headline);
        text.addView(advertiser);
        details.addView(text, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f));

        TextView cta = textView(13, Color.rgb(0, 92, 184));
        cta.setGravity(android.view.Gravity.CENTER);
        details.addView(cta, new LinearLayout.LayoutParams(72, 44));
        content.addView(details, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ));

        AdChoicesView adChoices = new AdChoicesView(getContext());
        FrameLayout root = new FrameLayout(getContext());
        root.addView(content, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ));
        FrameLayout.LayoutParams choicesLayout = new FrameLayout.LayoutParams(24, 24,
            android.view.Gravity.TOP | android.view.Gravity.END);
        root.addView(adChoices, choicesLayout);
        adView.addView(root, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT
        ));

        adView.setMediaView(media);
        adView.setHeadlineView(headline);
        adView.setAdvertiserView(advertiser);
        adView.setCallToActionView(cta);
        adView.setIconView(icon);
        adView.setAdChoicesView(adChoices);
        headline.setText(ad.getHeadline());
        advertiser.setText(ad.getAdvertiser());
        cta.setText(ad.getCallToAction());
        if (ad.getIcon() != null) icon.setImageDrawable(ad.getIcon().getDrawable());
        adView.setNativeAd(ad);
        return adView;
    }

    private TextView textView(int size, int color) {
        TextView view = new TextView(getContext());
        view.setTextSize(size);
        view.setTextColor(color);
        view.setMaxLines(2);
        return view;
    }

    private void hideVisibleAd() {
        if (visibleAdView == null) return;
        visibleAdView.destroy();
        ViewGroup parent = (ViewGroup) visibleAdView.getParent();
        if (parent != null) parent.removeView(visibleAdView);
        visibleAdView = null;
    }

    private void destroyLoadedAd() {
        if (loadedAd == null) return;
        loadedAd.destroy();
        loadedAd = null;
        loadedAdUnitId = null;
    }
}