# HER local operations

## Latest status — October 1, 2026, 23:42 ET

This section supersedes the earlier setup notes below. The user selected the existing PumpTalk mint `38A2GgZU9BKFNNnqGgeDjtxH2eTUZHqVH4MVSCeFpump`; no coin or wallet transaction was created. The dedicated OBS **HER Test** profile has the supplied WHIP destination stored in OBS, with no desktop or microphone capture. OBS's browser source captures the local studio's video and voice.

The custom HER face finished tuning. A public test ran from 23:31:55 to 23:34:43 ET, with 1920×1080 playback visibly verified on the target pump.fun page. Actual public messages, including one explicitly labeled HER test message posted by the signed-in user account, reached the authenticated local relay. The user reported black side bars and incorrect lip sync; this test is not a production-quality acceptance.

Fixed the chat route's unsupported Worker fetch redirect mode (`error` → `manual`, while rejecting non-OK responses). Added development-only loopback relay support. Changed broadcast video to fill the frame, combined voice and picture in one media element, and stopped recreating streams on unchanged participant updates. Type checking and six existing contract/relay tests passed; build and private deployment succeeded at commit `3a85e5d7bfbbc58066686486772ca8a847d25cd5`.

The second, private recording is `qa/2026-10-01 23-36-59.mkv`; a 12-second review clip is `qa/her-sync-check.mp4`. Decoded frames measured 156 black pixels on each side before the change and zero afterward. Speech and moving video are present, but exact lip sync has not received viewer acceptance. Both paid Tavus sessions and the public OBS output were ended.

The user now requests **the exact Vanessa from the Griffin launch film**, including her original voice and background. This supersedes the custom HER appearance. Do not restart the old avatar as if this replacement were complete. The available Tavus account catalog returned 145 faces, 37 PALs and 40 voices; Vanessa was absent. Tavus's official [Griffin announcement](https://www.tavus.io/griffin#responsibility) says Griffin is restricted to selected research testers and is not yet on the customer platform. Exact replacement requires Tavus to grant that asset/model access; the existing Builder subscription does not establish it. No alternative was relabeled Vanessa, no new avatar was trained, and no access request was sent.

The existing `.env` uses the local authenticated relay (`http://127.0.0.1:4501/feed`) for the OBS test. Start the relay with `Start-HER.ps1 -Mint <mint>` and the studio from `../her` with `node --env-file=.env scripts/run-framework.mjs dev`. A tunnel is unnecessary for this local setup. The studio requires explicit start; do not leave a paid session running while waiting for access.

The real read-only pump.fun WebSocket handshake, room join and three history messages were verified on October 1, 2026 against a publicly listed livestream. That test did not send any message or transact. It does not prove the user's eventual coin has identical chat access.

`pump-reader.mjs` speaks the observed Engine.IO/Socket.IO protocol directly with Node's built-in WebSocket. It subscribes anonymously, accepts only the configured room, ignores pre-start history, deduplicates IDs, limits delivery backlog, retries local delivery, responds to heartbeats and reconnects with backoff. No wallet, signing or `sendMessage` operation exists. This is an unofficial protocol and may change. Authentication errors stop the reader.

Tests use a simulated socket plus the actual local HTTP relay to verify delivery, duplicate protection and profanity preservation. Live testing separately verified the real remote handshake/history. Neither substitutes for a Tavus video/audio audition.

This PC must stay awake while using the local reader and OBS. A hosted server is optional for unattended operation, not required for the first supervised stream. Tavus account access, a custom trained face, a working coin URL and the pump.fun broadcaster account remain required.

Run `node --test reader.test.mjs` here. `Start-HER.ps1 -Mint <your-coin-mint>` launches the local components; the first run stores a random relay secret in ignored `.env`. It does not launch a coin, start paid Tavus sessions or publish a stream. Do not post the relay secret or stream key in chat.

Add `-Tunnel` for a temporary HTTPS test endpoint, then use `/feed` at that origin for HER's `PUMP_CHAT_FEED_URL`. The server secret `PUMP_CHAT_FEED_TOKEN` must match the local `HER_RELAY_TOKEN`. This wiring is not yet applied to the hosted studio because the desired coin is not created/selected. Run `Stop-HER.ps1` to stop only this launcher's recorded processes. The bundled Cloudflared executable was downloaded from Cloudflare's official GitHub release 2026.9.3 and its published SHA-256 checked. Quick tunnels have no uptime guarantee and change address; use a named tunnel or stable host for sustained production.

## Verified locally

- Public pump.fun Engine.IO handshake, anonymous room join and three history messages.
- Two reader tests: room/time validation and simulated live events through the actual relay.
- Authenticated HTTPS relay returned 200; request without bearer key returned 401.
- A synthetic local message completed the HTTPS round trip; nothing was posted to pump.fun.
- Dedicated OBS `HER` profile/collection created, preserving other collections: 1920×1080 at 30 fps, 4,500 kbps target, standby portrait with explicit AI/standby disclosure.
- Eight-second OBS recording completed with 241 output frames in `qa/2026-10-01 17-29-50.mkv`. This checks encoding/standby only, not Tavus movement or audio.
- Temporary relay, reader, tunnel and OBS test process were stopped after that verification. A later Tavus stock-face audition started and ended successfully; no public broadcast has started.

## Still blocked

Tavus API access is working and the user reports paying for Builder. The private studio now has its API key stored as a server secret, a dedicated HER PAL, and the custom HER face with Anna's voice. A stock Anna audition verified live video/audio transport, typed responses, ordinary uncensored profanity in transcripts, and session cleanup. The custom face is still fine-tuning and must pass its own visual/audio audition afterward. The saved audition audio is `../her/outputs/her-live-audition.webm`.

The pump.fun page requires acceptance of updated Terms of Service and age confirmation before proceeding. Creating the requested `test` coin requires the user to submit the wallet transaction. No coin or chat post was created, and the five-minute wait/live test has not occurred. Stream credentials and actual OBS video/audio capture remain unconfigured.

OBS has a labeled standby scene only; connect the actual HER live-video window and application audio before using it on a stream. No desktop or microphone capture is enabled by this collection. The short QA recording timer was disabled after the test.

## Costs checked October 1, 2026

The **visible** [Tavus pricing page](https://www.tavus.io/pricing) shows Starter $22/month (60 minutes, one custom face, five-minute session maximum) and Builder $59/month (175 minutes, three custom faces, 15-minute maximum, $0.35/minute overage). The rendered page resolves the conflicting legacy tables included in extracted page text; final checkout still controls account pricing. HER currently caps sessions at ten minutes, so Builder fits the existing live-session configuration. At the displayed Builder rate, one hour daily for 30 days would be about $627.75/month before tax, assuming one continuous billed session at a time and no additional services. The LLM, speech and WebRTC pipeline are included; no separate voice subscription is necessary for the default setup. The user reports paying for Builder; no additional subscription was purchased by the agent.

OBS and the local reader require no new software subscription. The PC must stay running. Cloudflare [quick tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) are a test facility, not a production uptime promise. Pump.fun transaction/network costs must be reviewed in the wallet before the user creates any coin; no fixed fee is assumed here.

Protocol research: [pump-chat-client source](https://github.com/CodingButter/pump-chat-client), [observed endpoint documentation](https://github.com/BankkRoll/pumpfun-apis). Reader implementation is independent and read-only.
