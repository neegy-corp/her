# HER

A private female AI broadcast studio: character preview, scripted voice rehearsal, Tavus live video, a bounded response queue, and a server-side pump.fun chat adapter contract.

October 1 setup: the private hosted studio has its Tavus key, custom HER face, and HER PAL configured. The key is a server secret. A real stock-face audition passed video/audio transport, typed responses, uncensored delivery transcripts, and remote session cleanup. HER's custom Phoenix-4.5 face is still fine-tuning; its readiness gate remains enabled. No user coin or public broadcast has been launched.

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev
```

The empty environment runs rehearsal mode. Click **Start rehearsal**, type a message, and HER speaks a scripted response with a browser voice. This is a still portrait, not lip-synced video. Installed browser voices vary; a female voice is selected when available.

## Enable live video

Set `TAVUS_API_KEY`, `TAVUS_FACE_ID`, and `TAVUS_PAL_ID` as server secrets. Use a female face you have rights to use. The setup commands below install the natural-speech persona in `lib/her.ts`, including ordinary unbleeped swearing. The generated preview portrait does **not** automatically become a Tavus face; live appearance and voice come from your trained face. See [research and Griffin Live review](REALISM.md).

With Node 24+, put setup credentials in the ignored `.env` file and run from this directory:

```powershell
node --experimental-strip-types scripts/setup-her.mjs plan
# Upload the portrait in PAL Maker, or set HER_TRAIN_IMAGE_URL first:
node --experimental-strip-types scripts/setup-her.mjs create-face
node --experimental-strip-types scripts/setup-her.mjs status
# Only after the face has finished tuning:
node --experimental-strip-types scripts/setup-her.mjs create-pal
# To apply persona changes to an existing dedicated HER PAL:
node --experimental-strip-types scripts/setup-her.mjs update-pal
```

`plan` makes no provider calls. Creation can incur provider charges. IDs are cached in ignored `.sites-runtime/her-tavus.json`; put those IDs and the key into the Site's server environment before going live. A creation with unknown outcome is marked pending so a retry cannot silently create duplicates; recover its ID in Tavus before clearing pending. Updates use JSON Patch and never force-discard PAL Maker edits. A non-HER PAL or a still-tuning face is rejected at session start. The setup defaults to the face's voice; optionally pin `TAVUS_VOICE_ID` or a complete external voice configuration. **Test delivery** uses browser speech in rehearsal and the real connected voice during a live session.

The integration uses current `face_id` and `pal_id` parameters and Daily's call object. HER receives typed chat through `conversation.respond`; remote video/audio tracks are shown in the camera stage. No director microphone or camera is requested. API keys stay server-side. Private studio authentication, same-origin checks, signed session cookies, a ten-minute duration limit, and explicit end-session cleanup protect session operations. Session creation can incur Tavus usage costs once credentials are configured. The app doesn't start paid sessions automatically.

If the browser refreshes while a call is active, use **End any existing video session** in settings, then start again. This first version is a single-director private studio; don't make it public without adding durable per-user session limits and billing controls.

## Connect pump.fun chat

Paste a token URL into the studio settings. Configure `PUMP_CHAT_FEED_URL` to an HTTPS **read-only adapter you control or an authorized provider**. `PUMP_CHAT_FEED_TOKEN` is sent only server-to-server as a bearer token. The app requests `?mint=<Solana-address>&after=<Unix-milliseconds>` every four seconds.

The adapter must return:

```json
{"messages":[{"id":"unique-source-message-id","user":"viewer","text":"Hey HER","timestamp":1790884800000}]}
```

Use real source message IDs and timestamps in milliseconds. The studio deduplicates IDs, starts from connection time rather than replaying history, limits each message to 400 characters, and queues at most eight responses. Automatic mode can be paused; individual messages can be sent to HER manually. No messages are posted back to pump.fun.

The companion `../her-operations/pump-reader.mjs` supplies a read-only reader. Its real pump.fun handshake, anonymous room join, and three history messages were verified against a public livestream. Simulated new events passed through the actual relay. No user coin is selected yet, so the hosted feed remains unconfigured; receipt of a new live message from the eventual target coin still needs testing. Demo chat is labeled and never presented as live. Do not use PumpPortal token/trade events as a substitute for chat.

### Included inbound relay

`scripts/chat-relay.mjs` is an independently implemented, Griffin-compatible ingestion service. Run it on a persistent Node host, separately from the Site's serverless app:

```powershell
node --env-file=.env scripts/chat-relay.mjs
```

Set `HER_RELAY_MINT` and a random `HER_RELAY_TOKEN` of at least 32 characters. It listens on loopback port 4501 by default. Put it behind your authenticated HTTPS deployment/reverse proxy, then set `PUMP_CHAT_FEED_URL=https://your-relay.example/feed` and `PUMP_CHAT_FEED_TOKEN` to the same secret in the Site environment. This is an endpoint placeholder, not a deployed service.

Your reader POSTs to `/api/chat/incoming` with `Authorization: Bearer <token>` and JSON `{"id":"stable-source-id","author":"viewer","text":"What the fuck was that?"}`. It never sends messages to pump.fun. IDs are deduplicated across the latest 500 messages; receipt times are monotonic. Omit `id` only for manual messages that won't be retried. Storage is in memory and resets on process restart. The `/feed?mint=...&after=...` response matches the studio contract. The relay enforces authentication, a single configured token room, 8 KB request bodies, and bounded message lengths. It is not a durable message broker or a built-in pump.fun scraper.

## Go on camera in a stream

The audience watches HER directly in the pump.fun livestream. This private studio is the backstage controller, not a destination for viewers. Connect chat, then start live video; a connected session automatically switches to the clean **HER Camera** output. **Broadcast view** also previews it without starting a paid session. OBS should capture only that camera window and its audio. The output fills the viewport, preserves the face's framing, and removes the dashboard, chat panel, captions, large branding, shading, notifications, and mouse-hover controls. Only a small AI disclosure remains; a disconnected/preview state is labeled STANDBY. Press Escape to return to controls, or Tab to reveal the accessible exit button. Keep OBS on standby before returning to the backstage controls.

Use OBS Virtual Camera for a browser-based broadcasting flow, or the streaming destination provided by your streaming account. The studio itself does not create a pump.fun livestream, obtain a stream key, or transmit RTMP. Those actions need the target account and stream configuration. A clean browser output alone is not a completed pump.fun broadcast connection.

## Validation

```powershell
npx tsc --noEmit
node --experimental-strip-types --test tests/contracts.test.mjs tests/relay.test.mjs
npm run build
```

Browser QA covers desktop/mobile layouts, rehearsal, message input, mute, automatic-reply pause, settings validation, and broadcast view. The first real Tavus audition also verified 1280×720 video, active audio, two uncensored delivery transcripts, a correct response to fresh typed details, zero reported browser errors, and provider-confirmed session end. The finished custom face, actual target coin messages, sustained operation, and broadcast destination still need end-to-end testing before public use.

Sources: [Tavus create conversation](https://docs.tavus.io/api-reference/conversations/create-conversation), [official Tavus example](https://github.com/Tavus-Engineering/tavus-intake). The supplied X reference returned HTTP 403 and could not be inspected.

## Character asset

`public/her-host.png` was generated with the built-in imagegen tool. Prompt: “Original fictional adult female AI host, around 28, natural dark shoulder-length hair, direct friendly confident eye contact, simple dark crewneck top, seated at a microphone in an intimate dark charcoal streaming studio. Editorial photorealistic, cinematic webcam portrait with natural skin texture. Horizontal 3:2, chest-up, centered. Warm skin, soft studio key light, subtle warm red practical light behind her. One adult person, modest clothing, no text, UI, logos, watermark, or sexualization.”
