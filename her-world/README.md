# HER — Characters & Stage

Public browsing site with Olivia, Maya and Ivy system-face previews, Turnkey-powered external Solana wallet connection, Supabase PostgreSQL persistence, and host-managed stage requests. Burns and stage requests remain closed at launch. Wallet connection is enabled; no email or ChatGPT signup is used by the application.

## Vercel production

Production is https://heronsol.live on Vercel project `her-world`, team `yeetrew1-1502s-projects`. `www.heronsol.live` redirects permanently to the apex. Namecheap remains the registrar and DNS host: `@` A `76.76.21.21`, `www` CNAME `heronsol.live.`. Existing email settings are retained. HTTPS is managed by Vercel.

`vercel.json` builds the existing app with native Next.js (`next build --webpack`) and runs the API in `iad1`. Vercel production stores `DATABASE_URL` and `SUPABASE_URL` as sensitive environment variables. The same Supabase schema and Edge Function are used; no data copy is required. The Node environment adapter and Cloudflare adapter keep the two build targets separate.

Deploy updates from this linked directory with `vercel deploy --prod --scope yeetrew1-1502s-projects`. For a matching local build, run `node node_modules/next/dist/bin/next build --webpack`, then `node node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 5180`. The original Sites build commands below remain available.

Verified on the custom domain: HTTPS, www redirect, homepage, wallet chooser, signed wallet login with a disposable key, Supabase session persistence, Secure cookies, same-origin checks, and logout revocation. No blockchain transaction was sent. Burns and stage access remain disabled pending the activation prerequisites below.

## Launch state

- Three character previews use official Tavus catalog assets. Olivia's generated PFP is only the favicon, not the site logo.
- Pro access and stage entry display no invented prices. Token and amounts are unset.
- `/host` exposes an explicitly labeled, non-persistent demonstration. Real queue and receipts require a signed wallet matching `HER_HOST_WALLET`.
- The stage queue does not capture cameras or publish to OBS/pump.fun. A host accepts a request with a private HTTPS room invite, then manually connects the guest room to the stream and marks the guest on stage.
- Character selection is a browser preview preference; live avatar switching is not connected.

## Activation prerequisites

Set runtime variables through Vercel production environment settings (or Sites for that deployment), never in public code. `.env.example` lists them:

1. Existing Phantom/Solana wallets connect through Turnkey React Wallet Kit's native connector. Ownership is verified by HER's server using a one-use signed message. This path does not create embedded wallets or use Turnkey's Auth Proxy. Managed Turnkey account setup is separate; cloud IDs are not substituted with demo credentials. Email, phone, passkey and social signup on HER are disabled.
2. `HER_HOST_WALLET`: the owner's Solana public key. Never infer ownership from the first visitor. No wallet has host access while this is empty.
3. `HER_TOKEN_MINT`, `HER_TOKEN_SYMBOL`, `HER_PRO_BURN`, `HER_STAGE_BURN`, and an HTTPS `SOLANA_RPC_URL`. Amounts are decimal token units, converted to integer base units against mint decimals.
4. Keep `HER_BURNS_ENABLED=false` and `HER_STAGE_ENABLED=false` until an end-to-end wallet test on a disposable token, RPC reliability testing, and the manual guest-room broadcast workflow are accepted. The current delivered version has not burned real tokens.
5. Configure a guest room service and OBS/pump.fun guest capture separately. Acceptance is not an automatic broadcast operation.

## Verification and storage

Wallet login uses a five-minute one-use signed challenge and HttpOnly SameSite sessions. Logout deletes the server session, and a reconnect button restores wallet signing after a page reload. All writes require same-origin requests. Host operations check the configured public key on the server. Supabase project `mkewxmunkqsyziatkqfz` persists intents, receipts, stage requests and moderation logs in the private `her_private` schema. All six tables use RLS, with access only for the restricted server database role. Public/anon/authenticated API access is not granted.

The site calls the `her-database` Supabase Edge Function over HTTPS. PostgreSQL authenticates a dedicated random server credential; requests without that credential fail. The function accepts only the exact query templates in `queries.json`, binds all values, and runs batches atomically. Its Supabase JWT gateway check is intentionally disabled because it implements this separate server authentication. TLS certificate verification remains enabled using the official Supabase CA. `DATABASE_URL` is a Sites secret and never enters browser code. This avoids a Cloudflare Workers direct-TLS incompatibility with Supabase's certificate. No Supabase service-role key or visitor Supabase Auth session is needed.

`db/supabase-schema.sql` records the deployed schema. The old `drizzle/` migration is retained only as legacy D1 history; the site has no D1 binding. After changing query templates run `node scripts/generate-db-queries.mjs` and redeploy the Edge Function before the site.

Burns are verified at finalized commitment against program, mint, signer/authority, exact integer amount, creation window and request memo. Unique receipt signatures prevent reuse. A partial unique database index enforces one on-stage guest across concurrent requests. Before burn activation, complete real disposable-token testing and recovery of pending submissions across page reloads.

Burning is irreversible. The review surface explains this and that admission is not guaranteed before asking for a wallet transaction signature. No burns are authorized from the host demo.

## Checks

`node node_modules/typescript/bin/tsc --noEmit`

`node --test scripts/burn-validation.test.mjs`

`node --env-file=.env.local scripts/wallet-integration.test.mjs` (local app only; uses disposable sign-in keys and rolls back database fixtures, never sends a blockchain transaction).

`node scripts/run-framework.mjs build`

For the local preview, build once and run `node scripts/preview.mjs`. This resolves the environment files against the project root instead of the build directory.

## References

- Design reference: https://www.tavus.io/research — revised to original blue/mint artwork, Fraunces and Space Grotesk after user feedback.
- Turnkey: https://docs.turnkey.com/generated-docs/formatted/react-wallet-kit/client-context-type-login-or-signup-with-wallet and installed SDK types.
- Solana burns: https://solana.com/docs/tokens/basics/burn-tokens

No Tavus, pump.fun stream, wallet private key or database credential is committed. Ignored local environment files and hosted secret storage contain runtime configuration. Use the separate HER streaming studio to broadcast.
