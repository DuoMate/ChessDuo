#!/usr/bin/env bash
set -euo pipefail

# Script: Patch GoogleProvider.java to skip unnecessary getAuthorizationResult()
# in online mode. The access token from this call is never used by Supabase auth
# (only the ID token from CredentialManager is needed). Skipping it avoids the
# "developer console not setup correctly" error from Google's authorization API,
# which requires OAuth project verification (weeks-long process).
#
# For OFFLINE mode, the authorization flow is preserved (needed for serverAuthCode).

PROVIDER_FILE="node_modules/@capgo/capacitor-social-login/android/src/main/java/ee/forgr/capacitor/social/login/GoogleProvider.java"

if [ ! -f "$PROVIDER_FILE" ]; then
  echo "[ERR] GoogleProvider.java not found at $PROVIDER_FILE"
  exit 1
fi

if grep -q "SKIP_AUTHORIZATION_PATCH" "$PROVIDER_FILE" 2>/dev/null; then
  echo "[OK]  GoogleProvider.java already patched"
  exit 0
fi

echo "[INFO] Patching GoogleProvider.java to skip getAuthorizationResult in online mode..."

# The old block: ListenableFuture line through the return statement
OLD='                    ListenableFuture<AuthorizationResult> future = getAuthorizationResult(forceRefreshToken);\
\
                    \/\/ Use ExecutorService to retrieve the access token\
                    ExecutorService executor = Executors.newSingleThreadExecutor();\
\
                    executor.execute(\
                        new Runnable() {\
                            @Override\
                            public void run() {\
                                try {\
                                    AuthorizationResult result = future.get();\
                                    if (GoogleProvider.this.mode == GoogleProviderLoginType.ONLINE) {\
                                        if (result.getAccessToken() != null) {\
                                            JSObject accessTokenObj = new JSObject();\
                                            accessTokenObj.put("token", result.getAccessToken());\
                                            \/\/ accessTokenObj.put("userId", accessToken.userId);\
\
                                            resultObj.put("accessToken", accessTokenObj);\
                                            resultObj.put("profile", user);\
                                            resultObj.put("idToken", googleIdTokenCredential.getIdToken());\
                                            resultObj.put("responseType", "online");\
                                            response.put("result", resultObj);\
                                            persistState(googleIdTokenCredential.getIdToken(), result.getAccessToken());\
                                            call.resolve(response);\
                                        } else {\
                                            call.reject("Failed to get access token");\
                                        }\
                                    } else {\
                                        if (result.getServerAuthCode() != null) {\
                                            resultObj.put("responseType", "offline");\
                                            resultObj.put("serverAuthCode", result.getServerAuthCode());\
                                            response.put("result", resultObj);\
                                            call.resolve(response);\
                                        } else {\
                                            call.reject("Failed to get serverAuthCode");\
                                        }\
                                    }\
                                } catch (Exception e) {\
                                    call.reject("Error retrieving access token: " + e.getMessage());\
                                } finally {\
                                    executor.shutdown();\
                                }\
                            }\
                        }\
                    );\
\
                    return; \/\/ The call will be resolved in the Runnable'

# The new block: bypass getAuthorizationResult for online mode
NEW='                    \/\/ SKIP_AUTHORIZATION_PATCH: bypass getAuthorizationResult for online mode\
                    \/\/ Supabase only needs the ID token from CredentialManager, not the access token\
                    if (GoogleProvider.this.mode == GoogleProviderLoginType.ONLINE) {\
                        resultObj.put("profile", user);\
                        resultObj.put("idToken", googleIdTokenCredential.getIdToken());\
                        resultObj.put("responseType", "online");\
                        response.put("result", resultObj);\
                        call.resolve(response);\
                        return;\
                    }\
\
                    ListenableFuture<AuthorizationResult> future = getAuthorizationResult(forceRefreshToken);\
\
                    \/\/ Use ExecutorService to retrieve the access token\
                    ExecutorService executor = Executors.newSingleThreadExecutor();\
\
                    executor.execute(\
                        new Runnable() {\
                            @Override\
                            public void run() {\
                                try {\
                                    AuthorizationResult result = future.get();\
                                    if (result.getServerAuthCode() != null) {\
                                        resultObj.put("responseType", "offline");\
                                        resultObj.put("serverAuthCode", result.getServerAuthCode());\
                                        response.put("result", resultObj);\
                                        call.resolve(response);\
                                    } else {\
                                        call.reject("Failed to get serverAuthCode");\
                                    }\
                                } catch (Exception e) {\
                                    call.reject("Error retrieving access token: " + e.getMessage());\
                                } finally {\
                                    executor.shutdown();\
                                }\
                            }\
                        }\
                    );\
\
                    return; \/\/ The call will be resolved in the Runnable'

# Use Python for robust multi-line replacement
python3 << PYTHON_SCRIPT
import re

with open("$PROVIDER_FILE", "r") as f:
    content = f.read()

old = '''                    ListenableFuture<AuthorizationResult> future = getAuthorizationResult(forceRefreshToken);

                    // Use ExecutorService to retrieve the access token
                    ExecutorService executor = Executors.newSingleThreadExecutor();

                    executor.execute(
                        new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    AuthorizationResult result = future.get();
                                    if (GoogleProvider.this.mode == GoogleProviderLoginType.ONLINE) {
                                        if (result.getAccessToken() != null) {
                                            JSObject accessTokenObj = new JSObject();
                                            accessTokenObj.put("token", result.getAccessToken());
                                            // accessTokenObj.put("userId", accessToken.userId);

                                            resultObj.put("accessToken", accessTokenObj);
                                            resultObj.put("profile", user);
                                            resultObj.put("idToken", googleIdTokenCredential.getIdToken());
                                            resultObj.put("responseType", "online");
                                            response.put("result", resultObj);
                                            persistState(googleIdTokenCredential.getIdToken(), result.getAccessToken());
                                            call.resolve(response);
                                        } else {
                                            call.reject("Failed to get access token");
                                        }
                                    } else {
                                        if (result.getServerAuthCode() != null) {
                                            resultObj.put("responseType", "offline");
                                            resultObj.put("serverAuthCode", result.getServerAuthCode());
                                            response.put("result", resultObj);
                                            call.resolve(response);
                                        } else {
                                            call.reject("Failed to get serverAuthCode");
                                        }
                                    }
                                } catch (Exception e) {
                                    call.reject("Error retrieving access token: " + e.getMessage());
                                } finally {
                                    executor.shutdown();
                                }
                            }
                        }
                    );

                    return; // The call will be resolved in the Runnable'''

new = '''                    // SKIP_AUTHORIZATION_PATCH: bypass getAuthorizationResult for online mode
                    // Supabase only needs the ID token from CredentialManager, not the access token
                    if (GoogleProvider.this.mode == GoogleProviderLoginType.ONLINE) {
                        resultObj.put("profile", user);
                        resultObj.put("idToken", googleIdTokenCredential.getIdToken());
                        resultObj.put("responseType", "online");
                        response.put("result", resultObj);
                        call.resolve(response);
                        return;
                    }

                    ListenableFuture<AuthorizationResult> future = getAuthorizationResult(forceRefreshToken);

                    // Use ExecutorService to retrieve the access token
                    ExecutorService executor = Executors.newSingleThreadExecutor();

                    executor.execute(
                        new Runnable() {
                            @Override
                            public void run() {
                                try {
                                    AuthorizationResult result = future.get();
                                    if (result.getServerAuthCode() != null) {
                                        resultObj.put("responseType", "offline");
                                        resultObj.put("serverAuthCode", result.getServerAuthCode());
                                        response.put("result", resultObj);
                                        call.resolve(response);
                                    } else {
                                        call.reject("Failed to get serverAuthCode");
                                    }
                                } catch (Exception e) {
                                    call.reject("Error retrieving access token: " + e.getMessage());
                                } finally {
                                    executor.shutdown();
                                }
                            }
                        }
                    );

                    return; // The call will be resolved in the Runnable'''

if old not in content:
    print("ERROR: Could not find the target block in GoogleProvider.java")
    print("This may mean the file has been modified upstream.")
    exit(1)

content = content.replace(old, new, 1)

with open("$PROVIDER_FILE", "w") as f:
    f.write(content)

print("Patch applied successfully")

PYTHON_SCRIPT

echo "[OK]  GoogleProvider.java patched to skip getAuthorizationResult in online mode"
