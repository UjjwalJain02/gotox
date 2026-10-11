# LinkTwin MVP — Deep Link Shortener

A minimal clone of [LinkTwin](https://linktw.in)'s core feature: shorten a URL,
and when someone opens the short link, try to open the matching native app
(YouTube, Spotify, Instagram, Amazon, X/Twitter, Facebook, WhatsApp,
Telegram, TikTok, LinkedIn) instead of getting stuck in a limited in-app
browser. Falls back to the normal URL on desktop or when the app isn't
matched/installed.

The main use case: links shared in bios/posts on Instagram, LinkedIn,
Facebook, TikTok, and X/Twitter get opened inside that app's **in-app
browser** (a WebView), not the system browser — so the user isn't logged in
anywhere and loses native app features/conversions. This tool detects that
in-app browser via the User-Agent and tries to break the user out into the
matching app.

No database — links are stored in a local JSON file (`data/links.json`).

## Features

- Paste a URL, get a short link (`/api/create`)
- Visiting a short link (`GET /:code`):
  - **Desktop** → redirects straight to the destination URL
  - **Android, regular browser** → redirects to an `intent://` URL, which
    lets Android open the matching app if installed, or fall back to the
    browser automatically
  - **iOS, regular browser** → serves a small page that tries the app's
    custom URL scheme, then falls back to the normal URL after ~1.5s if the
    app didn't open
  - **Opened from an in-app browser** (Instagram, Facebook, LinkedIn,
    TikTok, X/Twitter — detected via User-Agent) → serves an escape page
    that attempts the same automatic redirect, but also shows a visible
    "Continue" button. Many in-app browsers block programmatic navigation
    to app schemes/intents to keep users inside their app, but allow it once
    triggered by a real tap, so the button is the guaranteed fallback.
- Click counts tracked per link in `data/links.json`

## Running locally

```bash
npm install
npm start
```

The server listens on `http://localhost:3000` (override with the `PORT` env var).

## Deploying anywhere

This is a plain Node.js + Express app with no cloud-provider-specific APIs, so
it runs the same way everywhere:

```bash
npm install --production
node server.js
```

- **Docker / VPS**: run the two commands above inside a container or on the
  box directly. Make sure the `data/` directory is writable and, ideally,
  backed by a persistent volume so links survive restarts/redeploys.
- **Render / Railway / Fly.io / similar PaaS**: set the start command to
  `node server.js` (or `npm start`), and attach a persistent disk/volume
  mounted at the project root if the platform's filesystem is otherwise
  ephemeral. Without a persistent volume, `data/links.json` will reset on
  every redeploy.

## Known limitations (MVP scope)

- No accounts, custom aliases, custom domains, analytics dashboard, pixels,
  geo/language targeting, QR codes, A/B testing, or rate limiting.
- App URL schemes for Instagram, TikTok, LinkedIn, and Amazon aren't
  officially documented for deep-linking to specific content, so those open
  the app generically rather than jumping straight to the exact post/listing.
- In-app browser detection is based on known User-Agent substrings
  (`Instagram`, `FBAN`/`FBAV`, `LinkedInApp`, `BytedanceWebview`/`musical_ly`,
  `Twitter`); these apps can change their UA strings over time, which would
  require updating `detectInAppBrowser` in `server.js`.
- Even with the "Continue" button, some in-app browsers may still block
  navigation entirely for certain schemes — there's no 100% guaranteed
  escape without the destination site also supporting Universal
  Links/App Links, which is out of scope for this MVP.
- File-based storage is fine for a single instance; it isn't safe for
  multiple concurrent instances writing to the same file.
