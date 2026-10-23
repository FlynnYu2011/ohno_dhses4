package com.dhses4.campus;

import android.app.Activity;
import android.graphics.Color;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

public final class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private View fullScreenVideo;
    private WebChromeClient.CustomViewCallback videoCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(255, 253, 245));
        root.setOnApplyWindowInsetsListener(new View.OnApplyWindowInsetsListener() {
          @Override public WindowInsets onApplyWindowInsets(View view, WindowInsets insets) {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            }
            return insets;
          }
        });
        web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        web.setBackgroundColor(Color.rgb(255, 253, 245));
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !request.getUrl().toString().startsWith("file:///android_asset/");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullScreenVideo != null) { callback.onCustomViewHidden(); return; }
                fullScreenVideo = view;
                videoCallback = callback;
                web.setVisibility(View.GONE);
                root.addView(view, new FrameLayout.LayoutParams(-1, -1));
            }
            @Override public void onHideCustomView() { closeVideo(); }
        });
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (state == null || web.restoreState(state) == null) web.loadUrl("file:///android_asset/index.html");
    }

    private void closeVideo() {
        if (fullScreenVideo == null) return;
        root.removeView(fullScreenVideo);
        fullScreenVideo = null;
        web.setVisibility(View.VISIBLE);
        if (videoCallback != null) videoCallback.onCustomViewHidden();
        videoCallback = null;
    }

    @Override public void onBackPressed() {
        if (fullScreenVideo != null) closeVideo();
        else if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }
    @Override protected void onSaveInstanceState(Bundle state) { web.saveState(state); super.onSaveInstanceState(state); }
    @Override protected void onPause() { web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { closeVideo(); root.removeView(web); web.destroy(); super.onDestroy(); }
}

