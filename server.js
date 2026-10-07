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
  const platform = detectPlatform(req.get('user-agent'));
  const app_ = findApp(url);

  if (platform === 'desktop' || !app_) {
    return res.redirect(302, url);
  }

  if (platform === 'android') {
    return res.redirect(302, buildAndroidIntentUrl(url, app_));
  }

  // iOS: no reliable OS-level fallback without Universal Links, so attempt
  // the custom scheme client-side and fall back to the original URL after a
  // short timeout if the app didn't take over.
  const iosScheme = app_.iosScheme(url);
  return res.send(renderIosRedirectPage(iosScheme, url));
});

function renderIosRedirectPage(appUrl, fallbackUrl) {
  const escape = (s) => String(s).replace(/"/g, '&quot;');
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Redirecting…</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <p>Redirecting…</p>
  <script>
    (function () {
      var appUrl = "${escape(appUrl)}";
      var fallbackUrl = "${escape(fallbackUrl)}";
      var fellBack = false;

      function goToFallback() {
        if (fellBack) return;
        fellBack = true;
        window.location.href = fallbackUrl;
      }

      document.addEventListener('visibilitychange', function () {
        if (document.hidden) fellBack = true; // app likely opened
      });

      window.location.href = appUrl;
      setTimeout(goToFallback, 1500);
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
