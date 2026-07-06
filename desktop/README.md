# Nova Desktop Companion

A minimal Electron companion app that executes the **desktop-only** actions Nova suggests from the web app:

- 🖥️ Computer control (open / close apps)
- 📁 File operations (create folder, move, rename, list, search)
- 🌐 Browser automation (Playwright — navigate, click, type, extract)

**Every action requires explicit user approval** via a system dialog before running. Nothing executes silently.

---

## Architecture

```
Nova web app  ──(emits action JSON)──▶  Nova Desktop Companion
                                          │
                                          ├─ Shows approval dialog
                                          ├─ Executes on user OK
                                          └─ Returns result
```

The companion runs locally and polls (or receives via WebSocket — see "Pairing" below) the user's Nova account for pending actions. For this minimal build it accepts actions via:

1. **Local HTTP** on `http://127.0.0.1:43117` — the Nova web app (or any client) can POST an action.
2. **Clipboard paste** — paste a Nova action JSON into the companion window and click Run.

---

## Quick start

```bash
cd desktop
npm install
npm start
```

This launches the Electron window. Try the built-in **Test action** buttons.

To package a distributable:

```bash
npm run package        # current platform
npm run package:mac    # macOS
npm run package:win    # Windows
npm run package:linux  # Linux
```

Output appears in `desktop/out/`.

---

## Action schema

```jsonc
// computer control
{ "type": "open_app",  "name": "Slack" }
{ "type": "close_app", "name": "Slack" }

// file ops
{ "type": "file_op", "op": "create_folder", "path": "~/Documents/Nova" }
{ "type": "file_op", "op": "list",          "path": "~/Downloads" }
{ "type": "file_op", "op": "rename",        "path": "~/old.txt", "to": "~/new.txt" }
{ "type": "file_op", "op": "search",        "path": "~/Documents", "query": "invoice" }

// browser automation (Playwright)
{ "type": "automate_browser", "goal": "Open github.com and screenshot the homepage",
  "steps": [
    { "action": "goto",       "url": "https://github.com" },
    { "action": "screenshot", "path": "~/Desktop/github.png" }
  ]
}
```

Supported Playwright steps: `goto`, `click` (selector), `type` (selector, text), `wait` (ms), `screenshot` (path), `extract` (selector → returns text).

---

## Approval flow

For every incoming action:

1. Window comes to front with a yellow banner: **"Nova wants to: <summary>"**
2. User sees the exact command / path / URL.
3. **Approve** runs it. **Deny** discards. **Always-allow this type** (optional) whitelists for the session only.

No allow-list persists across restarts in this minimal build.

---

## Security notes

- Companion only listens on `127.0.0.1` (loopback).
- An auto-generated session token (`~/.nova-companion/token`) must accompany each HTTP request as `Authorization: Bearer <token>`.
- File ops are confined to the user's home directory by default; configurable in `config.json`.
- App open/close uses platform commands (`open` on macOS, `start` on Windows, `xdg-open` on Linux) — no shell injection (args are passed as arrays).
- Playwright runs headed by default so you can see what it does.

---

## Pairing with the Nova web app

The web app currently emits desktop actions and tags them `requires_desktop: true`. To wire them through:

1. In the web app, when an action is `requires_desktop`, POST it to `http://127.0.0.1:43117/action` with the session token.
2. The companion will pop the approval dialog and return the result.

A future version will use a WebSocket relay so the companion works across networks without exposing local ports.
