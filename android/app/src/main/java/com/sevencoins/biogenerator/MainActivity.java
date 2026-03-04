package com.sevencoins.biogenerator;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebSettings;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean isProcessingOAuth = false;
    private boolean isClosingApp = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Build.VERSION.SDK_INT >= 35) {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        }

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView == null) {
                    finish();
                    return;
                }
                String currentUrl = webView.getUrl();
                boolean isOnSistema = currentUrl != null && currentUrl.contains("/biogenerator/sistema");
                if (isOnSistema) {
                    return;
                }
                if (webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent);
    }

    @Override
    public void onStart() {
        super.onStart();
        Intent intent = getIntent();
        if (intent != null && intent.getData() != null) {
            Uri data = intent.getData();
            String url = data.toString();
            String oauthRedirectUrl = data.getQueryParameter("url");
            boolean isOAuthDeepLink = url.contains("/api/auth/google/complete") ||
                    (data.getScheme() != null && data.getScheme().equals("biogenerator") &&
                     data.getHost() != null && data.getHost().equals("oauth") &&
                     oauthRedirectUrl != null && oauthRedirectUrl.contains("/api/auth/google/complete"));
            if (isOAuthDeepLink) {
                isProcessingOAuth = true;
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.stopLoading();
                    webView.loadDataWithBaseURL(null, "<html><head><style>body{background:#fff;margin:0;padding:0;}</style></head><body></body></html>", "text/html", "UTF-8", null);
                }
                handleIntent(intent);
                return;
            }
        }
        handleIntent(intent);

        WebView webView = getBridge().getWebView();
        if (webView != null) {
            WebSettings webSettings = webView.getSettings();
            webSettings.setJavaScriptEnabled(true);
            webView.addJavascriptInterface(new Object() {
                @android.webkit.JavascriptInterface
                public void doHardReload() {
                    runOnUiThread(() -> {
                        String currentUrl = webView.getUrl();
                        if (currentUrl != null) {
                            webView.clearCache(true);
                            java.util.Map<String, String> headers = new java.util.HashMap<>();
                            headers.put("Cache-Control", "no-cache, no-store, must-revalidate");
                            headers.put("Pragma", "no-cache");
                            headers.put("Expires", "0");
                            webView.loadUrl(currentUrl, headers);
                        }
                    });
                }
            }, "AndroidHardReload");

            webView.addJavascriptInterface(new Object() {
                @android.webkit.JavascriptInterface
                public void forceExitApp() {
                    isClosingApp = true;
                    runOnUiThread(() -> {
                        webView.stopLoading();
                        finish();
                    });
                }
            }, "AndroidForceExit");

            webView.setWebViewClient(new android.webkit.WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    if (isProcessingOAuth && url != null && url.contains("/biogenerator/sistema")) {
                        isProcessingOAuth = false;
                    }
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                    if (isClosingApp) return true;
                    String url = request.getUrl().toString();
                    if (url.startsWith("biogenerator://oauth")) {
                        Uri uri = Uri.parse(url);
                        String redirectUrl = uri.getQueryParameter("url");
                        WebView wv = getBridge().getWebView();
                        if (wv != null && redirectUrl != null && redirectUrl.contains("/api/auth/google/complete")) {
                            isProcessingOAuth = true;
                            wv.stopLoading();
                            wv.clearCache(true);
                            wv.loadDataWithBaseURL(null, "<!DOCTYPE html><html><body></body></html>", "text/html", "UTF-8", null);
                            wv.postDelayed(() -> wv.loadUrl(redirectUrl), 100);
                        }
                        return true;
                    }
                    if (url.contains("accounts.google.com") || url.contains("oauth2.googleapis.com")) {
                        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        startActivity(i);
                        return true;
                    }
                    if (isProcessingOAuth && url.contains("/login")) return true;
                    if (isProcessingOAuth && url.contains("/biogenerator/sistema")) isProcessingOAuth = false;
                    if (url.contains("sevencoins.com.br") || url.contains("localhost") || url.contains("10.0.2.2")) {
                        view.loadUrl(url);
                        return true;
                    }
                    return false;
                }

                @Override
                public void onReceivedError(WebView view, android.webkit.WebResourceRequest request, android.webkit.WebResourceError error) {
                    super.onReceivedError(view, request, error);
                    String url = request.getUrl().toString();
                    boolean isMainDomain = url.contains("sevencoins.com.br") || url.contains("localhost") || url.contains("10.0.2.2");
                    if (isMainDomain && (error.getErrorCode() == android.webkit.WebViewClient.ERROR_HOST_LOOKUP ||
                        error.getErrorCode() == android.webkit.WebViewClient.ERROR_CONNECT ||
                        error.getErrorCode() == android.webkit.WebViewClient.ERROR_TIMEOUT)) {
                        String html = "<html><body style='font-family:sans-serif;padding:20px;text-align:center'>" +
                            "<h2>Servidor não acessível</h2><p>URL: " + url + "</p></body></html>";
                        view.loadDataWithBaseURL(null, html, "text/html", "UTF-8", null);
                    }
                }
            });
        }
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        Uri data = intent.getData();
        if (data == null) return;
        String url = data.toString();
        if (data.getScheme() != null && data.getScheme().equals("biogenerator")) {
            if (data.getHost() != null && data.getHost().equals("oauth")) {
                String redirectUrl = data.getQueryParameter("url");
                if (redirectUrl == null && intent.getExtras() != null) {
                    redirectUrl = intent.getExtras().getString("url");
                }
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    if (redirectUrl != null && redirectUrl.contains("/api/auth/google/complete")) {
                        isProcessingOAuth = true;
                        webView.stopLoading();
                        webView.clearCache(true);
                        String whiteScreen = "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>body{margin:0;padding:0;background:#fff;}</style></head><body></body></html>";
                        webView.loadDataWithBaseURL(null, whiteScreen, "text/html", "UTF-8", null);
                        final String finalUrl = redirectUrl;
                        webView.postDelayed(() -> webView.loadUrl(finalUrl), 100);
                    } else if (redirectUrl != null) {
                        webView.loadUrl(redirectUrl);
                    } else {
                        String serverUrl = getBridge().getServerUrl();
                        if (serverUrl == null) serverUrl = "https://sevencoins.com.br/biogenerator";
                        webView.loadUrl(serverUrl.replaceAll("/$", "") + "/");
                    }
                }
                return;
            }
        }
        if (url.contains("sevencoins.com.br") && url.contains("/biogenerator")) {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                if (url.contains("/api/auth/google/complete")) {
                    isProcessingOAuth = true;
                    webView.stopLoading();
                    webView.clearCache(true);
                    String whiteScreen = "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>body{margin:0;padding:0;background:#fff;}</style></head><body></body></html>";
                    webView.loadDataWithBaseURL(null, whiteScreen, "text/html", "UTF-8", null);
                    webView.postDelayed(() -> webView.loadUrl(url), 100);
                } else {
                    webView.loadUrl(url);
                }
            }
        }
    }
}
