package com.sevencoins.cryptostrategy;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.WebView;
import android.webkit.WebSettings;
import androidx.activity.EdgeToEdge;
import androidx.activity.OnBackPressedCallback;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String OAUTH_SCHEME = "cryptostrategy";
    private static final String PATH_SISTEMA = "/crypto/sistema";
    private static final String BASE = "/crypto";

    private boolean isProcessingOAuth = false;
    private boolean isClosingApp = false;

    /**
     * Só (auth) + (sys) + API Next + assets estáticos. Bloqueia landing pública (/crypto/pt, /en, /funcionalidade, …).
     */
    private static boolean isAllowedInAppWebView(String url) {
        if (url == null || url.isEmpty()) return false;
        try {
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme();
            if (scheme != null && (scheme.equals("file") || scheme.equals("data"))) return true;
            if (scheme != null && scheme.equals(OAUTH_SCHEME)) return true;
            String host = uri.getHost();
            if (host == null) return false;
            boolean dev = host.contains("localhost") || host.equals("10.0.2.2") || host.startsWith("192.168.");
            boolean prod = host.contains("sevencoins.com.br");
            if (!dev && !prod) return false;
            String path = uri.getPath();
            if (path == null) path = "";
            if (prod && !path.startsWith(BASE)) return false;
            if (dev && !path.startsWith(BASE) && !path.startsWith("/api")) return false;
            String rest = path.startsWith(BASE) ? path.substring(BASE.length()) : path;
            if (rest.isEmpty()) rest = "/";
            if (rest.equals("/")) return false;
            if (rest.startsWith("/api/")) return true;
            if (rest.startsWith("/_next/")) return true;
            if (rest.startsWith("/assets/")) return true;
            if (rest.startsWith("/manifest.json")) return true;
            if (rest.startsWith("/favicon")) return true;
            if (rest.startsWith("/icon") || rest.startsWith("/apple-icon")) return true;
            if (rest.startsWith("/robots.txt")) return true;
            // (auth)
            if (rest.startsWith("/login")) return true;
            if (rest.startsWith("/register")) return true;
            if (rest.startsWith("/reset-password")) return true;
            if (rest.startsWith("/oauth-return")) return true;
            if (rest.startsWith("/reativar")) return true;
            // (sys)
            if (rest.startsWith("/sistema")) return true;
            if (rest.startsWith("/conta")) return true;
            if (rest.startsWith("/plans")) return true;
            if (rest.startsWith("/historico")) return true;
            if (rest.startsWith("/admin")) return true;
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Play Store e outros sites redirecionam para {@code intent://} para abrir a app da loja.
     * O WebView não carrega esse esquema — trata aqui com {@link Intent#parseUri}.
     */
    private boolean tryStartIntentOrMarketUrl(String url) {
        if (url == null || url.isEmpty()) return false;
        if (url.startsWith("intent:")) {
            try {
                Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(intent);
                return true;
            } catch (ActivityNotFoundException e) {
                try {
                    Intent intent = Intent.parseUri(url, Intent.URI_INTENT_SCHEME);
                    String fallback = intent.getStringExtra("browser_fallback_url");
                    if (fallback != null && !fallback.isEmpty()) {
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(fallback))
                            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                        return true;
                    }
                } catch (Exception ignored) {
                }
                return true;
            } catch (Exception e) {
                return true;
            }
        }
        if (url.startsWith("market:")) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception ignored) {
            }
            return true;
        }
        return false;
    }

    /** Navegação do WebView: OAuth, domínio permitido, intent/market (Play Store). */
    private boolean bridgeShouldOverrideUrlLoading(WebView view, String url) {
        if (isClosingApp) return true;
        if (tryStartIntentOrMarketUrl(url)) return true;
        if (url.startsWith(OAUTH_SCHEME + "://oauth")) {
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
        if (isProcessingOAuth && url.contains(PATH_SISTEMA)) isProcessingOAuth = false;
        if (url.contains("sevencoins.com.br") || url.contains("localhost") || url.contains("10.0.2.2") || url.contains("192.168.")) {
            if (isAllowedInAppWebView(url)) {
                view.loadUrl(url);
                return true;
            }
            loadLoginOrServerFallback(view);
            return true;
        }
        return false;
    }

    /**
     * Oculta a status bar de sistema (relógio, bateria, etc.). Com edge-to-edge,
     * o plugin Capacitor StatusBar nem sempre esconde os ícones — aqui usamos API 30+ ou flags imersivas.
     */
    @SuppressWarnings("deprecation")
    private void applyStatusBarVisibility(boolean hidden) {
        runOnUiThread(() -> {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                WindowInsetsController controller = getWindow().getInsetsController();
                if (controller != null) {
                    if (hidden) {
                        controller.hide(WindowInsets.Type.statusBars());
                        controller.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                    } else {
                        controller.show(WindowInsets.Type.statusBars());
                    }
                    return;
                }
            }
            View decor = getWindow().getDecorView();
            int flags = View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN;
            if (hidden) {
                flags |= View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
            }
            decor.setSystemUiVisibility(flags);
        });
    }

    private void loadLoginOrServerFallback(WebView view) {
        String serverUrl = getBridge().getServerUrl();
        if (serverUrl == null) {
            view.loadUrl("https://sevencoins.com.br/crypto/login");
            return;
        }
        String u = serverUrl.replaceAll("/$", "");
        if (u.contains("/login")) {
            view.loadUrl(u);
            return;
        }
        if (u.endsWith("/crypto")) {
            view.loadUrl(u + "/login");
        } else {
            view.loadUrl(u + "/crypto/login");
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        /* Obrigatório antes de super: assim postSplashScreenTheme (styles.xml) aplica AppTheme.NoActionBar. */
        SplashScreen.installSplashScreen(this);
        /* Android 15+ (SDK 35+): ponta a ponta por defeito; compatível com versões anteriores. */
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                WebView webView = getBridge().getWebView();
                if (webView == null) {
                    finish();
                    return;
                }
                String currentUrl = webView.getUrl();
                boolean isOnSistema = currentUrl != null && currentUrl.contains(PATH_SISTEMA);
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
                    (data.getScheme() != null && data.getScheme().equals(OAUTH_SCHEME) &&
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

            webView.addJavascriptInterface(new Object() {
                @android.webkit.JavascriptInterface
                public void setStatusBarHidden(boolean hidden) {
                    applyStatusBarVisibility(hidden);
                }
            }, "AndroidStatusBar");

            webView.setWebViewClient(new android.webkit.WebViewClient() {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    if (isProcessingOAuth && url != null && url.contains(PATH_SISTEMA)) {
                        isProcessingOAuth = false;
                    }
                }

                @Override
                public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                    return bridgeShouldOverrideUrlLoading(view, request.getUrl().toString());
                }

                @SuppressWarnings("deprecation")
                @Override
                public boolean shouldOverrideUrlLoading(WebView view, String url) {
                    return bridgeShouldOverrideUrlLoading(view, url);
                }

                @Override
                public void onReceivedError(WebView view, android.webkit.WebResourceRequest request, android.webkit.WebResourceError error) {
                    super.onReceivedError(view, request, error);
                    String url = request.getUrl().toString();
                    boolean isMainDomain = url.contains("sevencoins.com.br") || url.contains("localhost") || url.contains("10.0.2.2") || url.contains("192.168.");
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
        if (data.getScheme() != null && data.getScheme().equals(OAUTH_SCHEME)) {
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
                    } else if (redirectUrl != null && isAllowedInAppWebView(redirectUrl)) {
                        webView.loadUrl(redirectUrl);
                    } else {
                        loadLoginOrServerFallback(webView);
                    }
                }
                return;
            }
        }
        if (url.contains("sevencoins.com.br") && url.contains("/crypto/")) {
            WebView webView = getBridge().getWebView();
            if (webView != null && isAllowedInAppWebView(url)) {
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
