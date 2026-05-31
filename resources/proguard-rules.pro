# ChessDuo ProGuard Rules
# Production release — minify + optimize + security hardening

# ─── Keep Capacitor ──────────────────────────────
-keep class com.getcapacitor.** { *; }
-keep class org.apache.cordova.** { *; }

# ─── Keep Supabase / WebView bridges ─────────────
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ─── Keep Android entry points ──────────────────
-keep class * extends android.app.Activity
-keep class * extends android.app.Application
-keep class * extends android.app.Service

# ─── Obfuscate everything else ───────────────────
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
