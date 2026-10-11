'use strict';

const path = require('path');
const express = require('express');
const store = require('./src/store');
const { findApp, buildAndroidIntentUrl } = require('./src/deepLinks');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function detectPlatform(userAgent = '') {
  const ua = userAgent.toLowerCase();
  if (/android/.test(ua)) return 'android';
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  return 'desktop';
}

/**
 * Detect whether the request is coming from a social app's in-app browser
 * (WebView), as opposed to a regular mobile browser (Safari/Chrome).
 * This matters because several in-app browsers deliberately block
 * programmatic (JS-triggered) navigation to custom URL schemes/intents to
 * keep users inside their app, which is exactly the scenario this tool
 * exists to work around.
 */
function detectInAppBrowser(userAgent = '') {
  if (/Instagram/i.test(userAgent)) return 'instagram';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(userAgent)) return 'facebook';
  if (/LinkedInApp/i.test(userAgent)) return 'linkedin';
  if (/BytedanceWebview|musical_ly|TikTok/i.test(userAgent)) return 'tiktok';
  if (/Twitter/i.test(userAgent)) return 'twitter';
  return null;
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch (err) {
    return false;
  }
}

app.post('/api/create', (req, res) => {
  const { url } = req.body || {};
  if (typeof url !== 'string' || !isValidHttpUrl(url)) {
    return res.status(400).json({ error: 'A valid http(s) URL is required.' });
  }
  const code = store.createLink(url);
  const shortUrl = `${req.protocol}://${req.get('host')}/${code}`;
  return res.json({ shortUrl, code });
});

app.get('/:code', (req, res, next) => {
  const { code } = req.params;
  const entry = store.getLink(code);
  if (!entry) return next();

  store.incrementClicks(code);

  const { url } = entry;
  const userAgent = req.get('user-agent') || '';
  const platform = detectPlatform(userAgent);
  const inAppBrowser = detectInAppBrowser(userAgent);
  const app_ = findApp(url);

  if (platform === 'desktop' || !app_) {
    return res.redirect(302, url);
  }

  if (platform === 'android') {
    const intentUrl = buildAndroidIntentUrl(url, app_);
    // Outside an in-app browser, a plain redirect to an intent:// URL is
    // reliable (Chrome/the OS resolve it directly). Inside an in-app
    // browser (Instagram, Facebook, TikTok, etc.), a server-side redirect
    // to intent:// is frequently swallowed/blocked, so serve the escape
    // page instead — it gives the WebView a real link to follow and a
    // tappable fallback button.
    if (!inAppBrowser) {
      return res.redirect(302, intentUrl);
    }
    return res.send(renderEscapePage(intentUrl, url, inAppBrowser));
  }

  // iOS: no reliable OS-level fallback without Universal Links, so attempt
  // the custom scheme client-side and fall back to the original URL after a
  // short timeout if the app didn't take over. Always include a tappable
  // button too, since many in-app browsers block the automatic attempt but
  // allow navigation triggered by a real user gesture (a tap).
  const iosScheme = app_.iosScheme(url);
  return res.send(renderEscapePage(iosScheme, url, inAppBrowser));
});

function renderEscapePage(appUrl, fallbackUrl, inAppBrowser) {
  const escapeHtml = (s) => String(s).replace(/"/g, '&quot;');
  const appLabel = inAppBrowser
    ? inAppBrowser.charAt(0).toUpperCase() + inAppBrowser.slice(1)
    : null;
  const noticeText = appLabel
    ? `Opened from ${appLabel}'s in-app browser. Tap below if nothing happens automatically.`
    : 'Redirecting…';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Redirecting…</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background:#0f172a; color:#e2e8f0; display:flex; min-height:100vh; align-items:center; justify-content:center; margin:0; }
    .box { text-align:center; padding:24px; max-width: 320px; }
    a.btn { display:inline-block; margin-top:16px; padding:12px 24px; background:#6366f1; color:white; text-decoration:none; border-radius:8px; font-weight:600; }
  </style>
</head>
<body>
  <div class="box">
    <p>${escapeHtml(noticeText)}</p>
    <a class="btn" id="open-btn" href="${escapeHtml(appUrl)}">Continue</a>
  </div>
  <script>
    (function () {
      var appUrl = "${escapeHtml(appUrl)}";
      var fallbackUrl = "${escapeHtml(fallbackUrl)}";
      var fellBack = false;

      function goToFallback() {
        if (fellBack) return;
        fellBack = true;
        window.location.href = fallbackUrl;
      }

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) fellBack = true; // app likely opened
      });

      // Attempt an automatic redirect first; this works in regular mobile
      // browsers. Several in-app browsers (Instagram, Facebook, TikTok,
      // LinkedIn, X) block this kind of programmatic navigation, which is
      // why the visible "Continue" button above exists as a guaranteed
      // manual escape hatch (tapping it is a real user gesture, which those
      // in-app browsers are more likely to allow through).
      window.location.href = appUrl;
      setTimeout(goToFallback, 1500);

      document.getElementById('open-btn').addEventListener('click', function () {
        fellBack = false;
        setTimeout(goToFallback, 1500);
      });
    })();
  </script>
</body>
</html>`;
}

app.use((req, res) => {
  res.status(404).send('Link not found.');
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`LinkTwin MVP server listening on http://localhost:${PORT}`);
});
