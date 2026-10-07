'use strict';

/**
 * Best-effort table of app URL schemes / deep-link builders.
 *
 * Each entry has:
 *  - match(url): returns true if this app should handle the given destination URL
 *  - iosScheme(url): returns the custom URL scheme to try on iOS
 *  - androidPackage: the Android package name, used to build an `intent://` URL
 *  - androidScheme(url): returns the scheme/path portion used inside the intent:// URL
 *
 * Several of these (Instagram, TikTok, LinkedIn, Amazon) don't have officially
 * documented deep links to specific content, so they fall back to a generic
 * "open the app" scheme rather than deep-linking to the exact post/product/etc.
 */

function hostIncludes(url, ...hosts) {
  try {
    const { hostname } = new URL(url);
    return hosts.some((h) => hostname === h || hostname.endsWith(`.${h}`));
  } catch (err) {
    return false;
  }
}

const APPS = [
  {
    name: 'youtube',
    match: (url) => hostIncludes(url, 'youtube.com', 'youtu.be'),
    iosScheme: (url) => {
      try {
        const u = new URL(url);
        const id = u.hostname.endsWith('youtu.be')
          ? u.pathname.slice(1)
          : u.searchParams.get('v');
        return id ? `youtube://watch?v=${id}` : 'youtube://';
      } catch (err) {
        return 'youtube://';
      }
    },
    androidPackage: 'com.google.android.youtube',
    androidScheme: (url) => {
      try {
        const u = new URL(url);
        const id = u.hostname.endsWith('youtu.be')
          ? u.pathname.slice(1)
          : u.searchParams.get('v');
        return id ? `vnd.youtube://${id}` : 'vnd.youtube://';
      } catch (err) {
        return 'vnd.youtube://';
      }
    },
  },
  {
    name: 'spotify',
    match: (url) => hostIncludes(url, 'open.spotify.com', 'spotify.com'),
    iosScheme: (url) => {
      try {
        const u = new URL(url);
        return `spotify:${u.pathname.replace(/\//g, ':').replace(/^:/, '')}`;
      } catch (err) {
        return 'spotify://';
      }
    },
    androidPackage: 'com.spotify.music',
    androidScheme: (url) => {
      try {
        const u = new URL(url);
        return `spotify:${u.pathname.replace(/\//g, ':').replace(/^:/, '')}`;
      } catch (err) {
        return 'spotify://';
      }
    },
  },
  {
    name: 'instagram',
    match: (url) => hostIncludes(url, 'instagram.com'),
    iosScheme: () => 'instagram://app',
    androidPackage: 'com.instagram.android',
    androidScheme: () => 'instagram://app',
  },
  {
    name: 'amazon',
    match: (url) =>
      hostIncludes(url, 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.in'),
    iosScheme: (url) => `com.amazon.mobile.shopping.web://${url.replace(/^https?:\/\//, '')}`,
    androidPackage: 'com.amazon.mShop.android.shopping',
    androidScheme: (url) => url,
  },
  {
    name: 'twitter',
    match: (url) => hostIncludes(url, 'twitter.com', 'x.com'),
    iosScheme: (url) => {
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 3 && parts[1] === 'status') {
          return `twitter://status?id=${parts[2]}`;
        }
        if (parts.length >= 1) {
          return `twitter://user?screen_name=${parts[0]}`;
        }
        return 'twitter://';
      } catch (err) {
        return 'twitter://';
      }
    },
    androidPackage: 'com.twitter.android',
    androidScheme: (url) => {
      try {
        const u = new URL(url);
        const parts = u.pathname.split('/').filter(Boolean);
        if (parts.length >= 3 && parts[1] === 'status') {
          return `twitter://status?id=${parts[2]}`;
        }
        return 'twitter://';
      } catch (err) {
        return 'twitter://';
      }
    },
  },
  {
    name: 'facebook',
    match: (url) => hostIncludes(url, 'facebook.com', 'fb.com'),
    iosScheme: (url) => `fb://facewebmodal/f?href=${encodeURIComponent(url)}`,
    androidPackage: 'com.facebook.katana',
    androidScheme: (url) => `fb://facewebmodal/f?href=${encodeURIComponent(url)}`,
  },
  {
    name: 'whatsapp',
    match: (url) => hostIncludes(url, 'wa.me', 'whatsapp.com'),
    iosScheme: (url) => {
      try {
        const u = new URL(url);
        const phone = u.pathname.slice(1);
        return phone ? `whatsapp://send?phone=${phone}` : 'whatsapp://send';
      } catch (err) {
        return 'whatsapp://send';
      }
    },
    androidPackage: 'com.whatsapp',
    androidScheme: (url) => {
      try {
        const u = new URL(url);
        const phone = u.pathname.slice(1);
        return phone ? `whatsapp://send?phone=${phone}` : 'whatsapp://send';
      } catch (err) {
        return 'whatsapp://send';
      }
    },
  },
  {
    name: 'telegram',
    match: (url) => hostIncludes(url, 't.me', 'telegram.me'),
    iosScheme: (url) => {
      try {
        const u = new URL(url);
        const domain = u.pathname.slice(1);
        return domain ? `tg://resolve?domain=${domain}` : 'tg://';
      } catch (err) {
        return 'tg://';
      }
    },
    androidPackage: 'org.telegram.messenger',
    androidScheme: (url) => {
      try {
        const u = new URL(url);
        const domain = u.pathname.slice(1);
        return domain ? `tg://resolve?domain=${domain}` : 'tg://';
      } catch (err) {
        return 'tg://';
      }
    },
  },
  {
    name: 'tiktok',
    match: (url) => hostIncludes(url, 'tiktok.com'),
    iosScheme: () => 'tiktok://',
    androidPackage: 'com.zhiliaoapp.musically',
    androidScheme: () => 'tiktok://',
  },
  {
    name: 'linkedin',
    match: (url) => hostIncludes(url, 'linkedin.com'),
    iosScheme: () => 'linkedin://',
    androidPackage: 'com.linkedin.android',
    androidScheme: () => 'linkedin://',
  },
];

/**
 * Find the app config matching a given destination URL, if any.
 * @param {string} url
 * @returns {object|null}
 */
function findApp(url) {
  return APPS.find((app) => app.match(url)) || null;
}

/**
 * Build the Android `intent://` URL for a given destination URL and app config.
 * The intent URL bakes in a browser_fallback_url so Android handles the
 * "app installed or not" branching natively, without any client-side JS.
 */
function buildAndroidIntentUrl(url, app) {
  const scheme = app.androidScheme(url);
  // Split scheme into the scheme name and the rest, since intent:// URLs
  // expect the form intent://<path>#Intent;scheme=<scheme>;package=<pkg>;...;end
  const schemeMatch = scheme.match(/^([a-zA-Z0-9.+-]+):\/\/(.*)$/) || scheme.match(/^([a-zA-Z0-9.+-]+):(.*)$/);
  const schemeName = schemeMatch ? schemeMatch[1] : scheme;
  const rest = schemeMatch ? schemeMatch[2] : '';
  const fallback = encodeURIComponent(url);
  return `intent://${rest}#Intent;scheme=${schemeName};package=${app.androidPackage};S.browser_fallback_url=${fallback};end`;
}

module.exports = { APPS, findApp, buildAndroidIntentUrl };
