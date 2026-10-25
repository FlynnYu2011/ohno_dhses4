package com.dhses4.campus;

import android.app.Activity;
import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebResourceResponse;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.widget.FrameLayout;
import java.io.InputStream;
import java.io.FilterInputStream;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

public final class MainActivity extends Activity {
    private WebView web;
    private FrameLayout root;
    private View fullScreenVideo;
    private WebChromeClient.CustomViewCallback videoCallback;
    private static final String ASSET_HOST = "appassets.androidplatform.net";
    private static final int PICK_IMAGE = 401;
    private static final int RECORD_PERMISSION = 402;
    private ValueCallback<Uri[]> imageCallback;
    private PermissionRequest microphoneRequest;

    private boolean trusted(Uri uri) {
        return uri != null && "https".equals(uri.getScheme()) && ASSET_HOST.equals(uri.getHost());
    }

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
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setSupportMultipleWindows(false);
        web.setBackgroundColor(Color.rgb(255, 253, 245));
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !trusted(request.getUrl());
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetResponse(request);
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (imageCallback != null) imageCallback.onReceiveValue(null);
                imageCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/*");
                try { startActivityForResult(intent, PICK_IMAGE); }
                catch (RuntimeException exception) { imageCallback.onReceiveValue(null); imageCallback = null; }
                return true;
            }
            @Override public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override public void run() {
                        boolean audioOnly = request.getResources().length == 1 && PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(request.getResources()[0]);
                        if (!trusted(request.getOrigin()) || !audioOnly) { request.deny(); return; }
                        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                            request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                            return;
                        }
                        if (microphoneRequest != null) microphoneRequest.deny();
                        microphoneRequest = request;
                        requestPermissions(new String[] { Manifest.permission.RECORD_AUDIO }, RECORD_PERMISSION);
                    }
                });
            }
            @Override public void onPermissionRequestCanceled(final PermissionRequest request) {
                runOnUiThread(new Runnable() { @Override public void run() { if (microphoneRequest == request) microphoneRequest = null; } });
            }
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
        boolean restored = state != null && web.restoreState(state) != null;
        if (!restored || !trusted(Uri.parse(String.valueOf(web.getUrl())))) web.loadUrl("https://" + ASSET_HOST + "/index.html");
    }

    private WebResourceResponse emptyResponse(int code, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", code, reason, new HashMap<String,String>(), new ByteArrayInputStream(new byte[0]));
    }

    private WebResourceResponse assetResponse(WebResourceRequest request) {
        if (!trusted(request.getUrl())) return emptyResponse(403, "Forbidden");
        String file = request.getUrl().getPath();
        if (file == null || file.equals("/")) file = "/index.html";
        if (file.contains("..") || file.contains("\\") || file.indexOf('\0') >= 0) return emptyResponse(403, "Forbidden");
        file = file.substring(1);
        InputStream input = null;
        try {
            input = getAssets().open(file);
            long length = input.available();
            long start = 0;
            long end = length - 1;
            String range = request.getRequestHeaders().get("Range");
            if (range == null) range = request.getRequestHeaders().get("range");
            boolean partial = range != null && range.startsWith("bytes=");
            if (partial) {
                String[] numbers = range.substring(6).split("-", -1);
                if (numbers.length != 2 || numbers[0].isEmpty()) { input.close(); return emptyResponse(416, "Range Not Satisfiable"); }
                start = Long.parseLong(numbers[0]);
                if (!numbers[1].isEmpty()) end = Math.min(end, Long.parseLong(numbers[1]));
                if (start < 0 || start > end || start >= length) { input.close(); return emptyResponse(416, "Range Not Satisfiable"); }
                long skipped = 0;
                while (skipped < start) { long step = input.skip(start - skipped); if (step <= 0) { input.close(); return emptyResponse(416, "Range Not Satisfiable"); } skipped += step; }
            }
            String mime = file.endsWith(".html") ? "text/html" : file.endsWith(".png") ? "image/png" : file.endsWith(".jpg") ? "image/jpeg" : file.endsWith(".mp4") ? "video/mp4" : "application/octet-stream";
            Map<String,String> headers = new HashMap<String,String>();
            headers.put("Accept-Ranges", "bytes");
            headers.put("Content-Length", Long.toString(end - start + 1));
            if (partial) headers.put("Content-Range", "bytes " + start + "-" + end + "/" + length);
            return new WebResourceResponse(mime, mime.equals("text/html") ? "UTF-8" : null, partial ? 206 : 200, partial ? "Partial Content" : "OK", headers, new LimitedInputStream(input, end - start + 1));
        } catch (IOException | IllegalArgumentException exception) {
            if (input != null) try { input.close(); } catch (IOException ignored) {}
            return emptyResponse(404, "Not Found");
        }
    }

    private static final class LimitedInputStream extends FilterInputStream {
        private long remaining;
        LimitedInputStream(InputStream input, long length) { super(input); remaining = length; }
        @Override public int read() throws IOException { if (remaining <= 0) return -1; int value = in.read(); if (value >= 0) remaining--; return value; }
        @Override public int read(byte[] buffer, int offset, int count) throws IOException {
            if (count == 0) return 0;
            if (remaining <= 0) return -1;
            int got = in.read(buffer, offset, (int)Math.min(count, remaining));
            if (got > 0) remaining -= got;
            return got;
        }
    }

    @Override protected void onActivityResult(int code, int result, Intent data) {
        super.onActivityResult(code, result, data);
        if (code == PICK_IMAGE && imageCallback != null) {
            Uri selected = result == RESULT_OK && data != null ? data.getData() : null;
            if (selected != null && !"content".equals(selected.getScheme())) selected = null;
            imageCallback.onReceiveValue(selected == null ? null : new Uri[] { selected });
            imageCallback = null;
        }
    }

    @Override public void onRequestPermissionsResult(int code, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(code, permissions, grants);
        if (code == RECORD_PERMISSION && microphoneRequest != null) {
            PermissionRequest request = microphoneRequest;
            microphoneRequest = null;
            if (grants.length > 0 && grants[0] == PackageManager.PERMISSION_GRANTED && trusted(request.getOrigin())) request.grant(new String[] { PermissionRequest.RESOURCE_AUDIO_CAPTURE });
            else request.deny();
        }
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
    @Override protected void onPause() {
        // A runtime microphone prompt can temporarily cover this activity.
        if (microphoneRequest == null) {
            web.evaluateJavascript("window.Class04Media && window.Class04Media.shutdown()", null);
            web.onPause();
        }
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() {
        if (microphoneRequest != null) microphoneRequest.deny();
        if (imageCallback != null) imageCallback.onReceiveValue(null);
        closeVideo(); root.removeView(web); web.destroy(); super.onDestroy();
    }
}

