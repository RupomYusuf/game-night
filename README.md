# Game Night 🌙

A private, real-time game hub for couples who are apart but spending the evening "together" online.

- One partner creates a night, gets a code like `LOVE-42`, and shares it.
- The other joins by code or link — no accounts, no sign-up.
- Games, chat, photos, and video mirror live between the two screens.
- **Nothing is ever stored.** Rooms, chat, media and scores live in server memory for the life of the session and vanish when it ends.

## Play from anywhere

**Option A — one-click cloud deploy (always on):**

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/RupomYusuf/game-night)

Click the button, confirm, and you get a permanent `https://<app>.onrender.com` link. The free tier sleeps after ~15 idle minutes and wakes on the first request. The `PORT` env var is picked up automatically.

**Option B — tunnel from your own machine (while it's running):**

```bash
node server.js
# in a second terminal:
cloudflared tunnel --url http://localhost:8787
```

Share the printed `https://…trycloudflare.com` URL. HTTPS out of the box, no account needed — the night lives as long as your terminal does.

## Run it locally

```bash
node server.js
```

Open **http://localhost:8787** in two browser tabs (or two devices) — one creates a night, the other joins with the code.

- `PORT=9000 node server.js` to change the port.
- **Same Wi-Fi:** the other partner opens `http://<your-computer-ip>:8787` (allow Node through your firewall).
- **Camera & microphone** (photo/video in chat) require a secure context: `localhost` or any HTTPS/tunneled URL. Over plain LAN HTTP, photo/video upload still works from files; live capture is blocked by the browser.

## Architecture

| Piece | What it does |
|---|---|
| `server.js` | Zero-dependency Node server. Serves the app, plus a tiny REST + SSE (Server-Sent Events) API. Rooms are plain in-memory objects: two members max, a 60-second reconnect grace window, and a session-only chat buffer. Deleted the moment the night ends. |
| `public/` | Vanilla ES-module frontend — no build step. |

**Sync model:** one partner (the room creator) is the *state owner* for the active game. Every tap is applied optimistically on both screens (the reducer is deterministic), and the owner broadcasts an authoritative state snapshot after every action, which corrects any drift and restores reconnecting devices. The server stores only the latest snapshot so a refresh mid-game resumes exactly where you left off — until the session ends, and then it's all gone.
