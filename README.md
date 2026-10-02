# HER

Female AI livestream host for pump.fun: a Tavus video conversation, a real-time chat reader, and an OBS camera feed. This repository contains the current app, independently implemented chat integration, Windows broadcasting tools, artwork, and operating notes.

## Current status

- A supervised public test reached the selected pump.fun coin at 1920×1080. Real chat messages reached the authenticated relay.
- The black side bars were removed and audio/video playback was combined into one stable stream. Exact lip sync still needs viewer acceptance.
- The requested replacement is **Vanessa from Tavus's Griffin launch film**, with her original voice and background. This replacement is **not complete**: Vanessa is unavailable in the account's face/voice library, and Griffin remains a restricted research preview. See the [access-request draft](her-operations/vanessa-access-request.txt).
- The existing custom HER face remains configured locally. The public test and all paid Tavus sessions were stopped. Nothing starts a broadcast or paid session automatically.

## Repository layout

| Directory | Contents |
| --- | --- |
| `her/` | React/Vinext studio, server API routes, persona, chat relay, tests, and Sites configuration |
| `her-operations/` | pump.fun reader, Windows start/stop scripts, OBS profile setup, and latest test notes |
| `assets/` | Generated HER profile picture; the original host portrait is in `her/public/` |

The app snapshot comes from source commit `3a85e5d7bfbbc58066686486772ca8a847d25cd5`. Older app research notes describe earlier stages; [the latest operations status](her-operations/README.md) supersedes them.

## Local setup

Requires Node.js 24+, npm, and OBS Studio 30+ for WHIP output. OBS helper setup also uses Python. The broadcaster runs on Windows; keep the PC awake while streaming.

1. In `her/`, run `npm ci` and copy `.env.example` to `.env`.
2. Configure the Tavus API key, available face ID, and HER PAL ID in that local `.env`. Use `scripts/setup-her.mjs` as described in the [app README](her/README.md). Do not assume Vanessa is available or use an invented asset ID.
3. From PowerShell in `her-operations/`, run `./Start-HER.ps1 -Mint <coin-mint>`. This creates a random local relay token in its ignored `.env` and starts the reader and relay. It does not create a coin or start a paid session.
4. Set the app's `PUMP_CHAT_FEED_URL=http://127.0.0.1:4501/feed` for local development and set `PUMP_CHAT_FEED_TOKEN` to the relay's `HER_RELAY_TOKEN`. Hosted deployments require an authenticated HTTPS relay.
5. From `her/`, run `node --env-file=.env scripts/run-framework.mjs dev`. Open the displayed localhost address, save the chosen pump.fun URL in settings, and explicitly start the avatar when ready.
6. Use the OBS browser source at `http://127.0.0.1:5173`, 1920×1080 at 30 fps, with browser audio routed through OBS. Enter the stream credentials directly in OBS. Only start streaming after checking the clean camera output and sound.

The OBS scripts preserve existing collections and refuse to overwrite the dedicated HER profiles. `setup-obs.py` creates the baseline standby collection; `configure-test-obs.mjs` creates the test collection and expects `{server,token}` through hidden terminal input. It is currently scoped to the tested pump.fun WHIP server and has a three-minute output timer. The optional `-Tunnel` launcher flag requires Cloudflared in `her-operations/bin/`; no vendor binary is committed. See [operations](her-operations/README.md) before using it.

End the avatar session, stop OBS output, then run `./Stop-HER.ps1` to stop the launcher's reader, relay, and optional tunnel. The app also caps paid sessions at ten minutes.

## Verification

From `her/`:

```sh
npx tsc --noEmit
node --experimental-strip-types --test tests/contracts.test.mjs tests/relay.test.mjs
npm run build
```

From `her-operations/`:

```sh
node --test reader.test.mjs
```

The tests cover input validation, relay authorization and room isolation, duplicate handling, queue delivery, and preservation of ordinary profanity. They do not establish subjective avatar quality or guarantee the unofficial pump.fun chat protocol will remain unchanged.

## Credentials and deployment

Only empty environment templates are committed. API keys, stream credentials, local authentication state, recordings, logs, dependencies, and build output remain local. The existing Sites project identifier is retained so the app can be updated without creating a replacement site. GitHub pushes do not automatically redeploy it.

The host retains the HER name, visible AI disclosure, AGI/trenches persona, and ordinary profanity support. Provider moderation still applies. No wallet signing, purchases, trades, or return promises are implemented.
