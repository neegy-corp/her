# HER Wallet And Trades

The public Trades section reports on-chain facts for one configured project wallet.
The private operator desk lets trusted people choose a coin, side, amount and thesis,
review a quote, then explicitly confirm a trade. The backend signs the reviewed
transaction with the dedicated project wallet key. There is no browser wallet
approval, AI trading autonomy, or arbitrary transaction execution endpoint.

Trading and tracking default to disabled. The password-protected panel can be
previewed with both off, before a wallet or database migration is available.

## Included

- Public SOL balance, total marked equity, average-cost position P&L, closed coins
  and confirmed trade history; token names, tickers and logos from Helius DAS.
- A 3 SOL starting-capital baseline. This is not a fabricated current balance.
  Additional SOL deposits and withdrawals are excluded from all-time profit.
- Private `/operator/<256-bit-random-key>` page, no public navigation or indexing.
- Scrypt password verification, eight-hour HTTP-only/SameSite-strict cookies,
  same-origin mutation checks and separate read-only feed authentication.
- Buy with SOL / sell tokens for SOL, contract lookup, thesis editing, quote review
  and 0.1%-3% slippage. Operators select amounts; there is no fixed per-buy cap.
- Jupiter order/execute adapter, exact stored-message validation and a matching
  backend signer. Durable order claims prevent double-click resubmission.
- Confirmed-wallet speech and open-position updates every 10-20 minutes in the
  separately installed broadcasting studio. Theses are rephrased, not recited.
  Wallet facts do not claim that the AI independently chose or signed trades.

New Pump coins are not guaranteed to have a Jupiter route. Unsupported routes and
multi-signer/RFQ orders fail closed. Direct Pump SDK execution is not included.

## Setup And Activation

1. Create a dedicated project wallet. Add its public address as `HER_WALLET_ADDRESS`
   and its **64-byte** base58 secret key (or JSON array of 64 bytes) as
   `HER_WALLET_PRIVATE_KEY`, a Sensitive Production variable in Vercel. A 32-byte
   seed is not accepted. The derived public key must match the configured address.
   Never put the key in Git, chat, screenshots or `NEXT_PUBLIC_*` variables.
2. Apply `supabase/migrations/20261002093000_operator_wallet.sql` with authorized
   Supabase admin access. Deploy the existing `her-database` Edge Function with the
   updated `queries.json`. Vercel and Git deployments do not apply these changes.
   Preserve the existing server-only `DATABASE_URL`.
3. Generate credentials locally, if they have not already been generated:

   ```powershell
   cd her-world
   node --experimental-strip-types scripts/operator-credentials.mjs
   ```

   This only generates and prints credentials. It does not create a wallet,
   configure Vercel, deploy, or trade. Keep the plaintext password privately;
   only its hash goes to Vercel. No password is literally uncrackable. The random
   URL is an extra barrier, not a substitute for authentication. Public Git code
   reveals that an operator feature exists, but contains no real path or password.
4. Configure these **server-only Production** variables in Vercel:

   | Variable | Value |
   | --- | --- |
   | `HER_OPERATOR_PATH_KEY` | Generated 64-character hex suffix |
   | `HER_OPERATOR_PASSWORD_HASH` | Generated scrypt hash |
   | `HER_OPERATOR_SESSION_SECRET` | Generated independent 64-character hex secret |
   | `HER_WALLET_READ_TOKEN` | Generated independent read-only bearer secret |
   | `HER_WALLET_ADDRESS` | Dedicated wallet public address |
   | `HER_WALLET_PRIVATE_KEY` | Matching 64-byte secret; Sensitive Production only |
   | `HELIUS_API_KEY` | Helius mainnet key |
   | `JUPITER_API_KEY` | Jupiter key |
   | `HER_POSITION_UPDATE_MINUTES` | Integer 10 through 20; default 10 |
   | `HER_OPERATOR_ENABLED` | `true` only for an approved protected preview/live desk |
   | `HER_OPERATOR_TRADING_ENABLED` | `false` until trading is explicitly approved |
   | `HER_WALLET_TRACKING_ENABLED` | `false` until tracking is explicitly approved |

   Changes require a new deployment. Local Next.js dotenv files must escape each
   `$` in the password hash as `\$`; the Vercel value is the raw unescaped hash.
   The local-only `HER_OPERATOR_LOGIN_PASSWORD` must never be uploaded to Vercel.
   Do not expose production secrets to untrusted previews. Platform logs can
   contain URLs; share the link privately and rotate its suffix if it leaks.
5. With tracking and trading both off, login uses a bounded **per-instance** preview
   throttle and does not require the new database schema. All order/thesis writes
   are blocked. Before live activation, verify the persistent database-backed login
   throttle and journal; failures deny access. Consider Vercel Firewall rate limits
   as an additional layer. The preview limiter is not a distributed guarantee.
6. After explicit approval, enable tracking first and inspect a known confirmed
   receipt. Only enable trading after the schema, providers and matching signer
   are verified. Use a dedicated wallet and an operator-selected test amount.
   No setup command automatically activates these flags.

## Broadcast Setup Is Separate

Update and restart the **actual broadcasting studio** with these source changes.
On that machine, configure `her/.env`:

```dotenv
HER_WALLET_UPDATES_ENABLED=false
HER_WALLET_FEED_URL=https://heronsol.live/api/her-wallet
HER_WALLET_READ_TOKEN=<same read-only token as Vercel>
```

Enable studio updates only after tracking is verified and speech is approved.
The current supervisor restarts the studio but does not pull Git changes. Vercel
cannot install the studio or change its local OBS source. OBS scenes can stay the
same, but someone with that machine's access must install the updated studio.

Apply the updated persona using the existing authorized PAL setup flow
(`her/scripts/setup-her.mjs update-pal`) before enabling real-wallet commentary.
Optionally attach `tavus-wallet-tool.example.json` to the correct PAL with authorized
Tavus access and a privately configured read token. Git does not change the
provider's PAL. The tool allows lookups; the studio schedules periodic speech.
Neither the public dashboard nor the agent feed includes operator credentials,
private URLs, signing keys or control-panel state. Operator implementation code is
public in Git, so feature existence cannot be promised secret from code readers.

## Credentials

| Credential | Purpose |
| --- | --- |
| Operator password | Trusted operators' login; password manager/local-only credential file |
| `HER_OPERATOR_PATH_KEY` | Random URL suffix; share the URL privately |
| `HER_OPERATOR_PASSWORD_HASH` | Salted scrypt password verifier; not the plaintext password |
| `HER_OPERATOR_SESSION_SECRET` | Signs session cookies; do not give it to operators or the studio |
| `HER_WALLET_READ_TOKEN` | Read-only portfolio authentication for the studio/optional Tavus tool; cannot trade |
| `HER_WALLET_PRIVATE_KEY` | Custodial signing authority; can spend the wallet's funds |

These are independent secrets. The read token is not a wallet key or provider API
key. The public wallet address is safe to share. The server key is a hot-wallet
credential: restrict project/deployment access and keep unrelated funds elsewhere.

## Normal Trading Workflow

Sign in at the private URL, enter the contract address, choose Buy/Sell, specify
SOL spend or token quantity, and write a thesis. Review the quote, expiry and fees,
then confirm. The browser sends only the stored order ID, not a signed transaction.
The backend signs the exact previously reviewed message and submits through Jupiter.

A signature is persisted before submission. The order is reported only after a
verified Helius swap or confirmed raw-chain receipt; a provider success response
alone is not proof. Confirmation fallback covers only known stored orders, never
arbitrary transfers. Submission timeouts remain unknown and are not retried as new
trades. Inspect the receipt before placing another order; unknown does not mean
that no funds moved.

Save thesis updates a position without trading. New confirmed orders carry their
own thesis; later snapshots use the most recently saved position thesis. The agent
does not need operational details, but prompts do not fabricate autonomy or deny
the distinction between observed activity and the agent's own decisions.

## Data And Timing Limits

- Public history uses finalized Helius `getTransactionsForAddress` full transaction
  data, bounded to three pages / 3,000 transactions. Only recognized Jupiter/Pump
  swap instructions with matching SOL/token deltas produce buy/sell entries.
- Position cost is average cost, in SOL. Partial sales allocate basis proportionally.
  All-time percentage is net P&L divided by the original 3 SOL, not time-weighted
  performance. Fees and rent remain in cash flows. Additional SOL funding is
  neutralized; initial funding must be verified before all-time P&L is shown.
- Helius DAS marks are indicative, not execution quotes, and may be missing for
  new coins. Quote currency is preserved as USD or USDC; token marks convert to
  SOL only when their currency matches the SOL mark. Missing history/prices/basis
  or unclassifiable activity withhold affected P&L rather than inventing zero.
- The public feed is read-only, fixed to the configured wallet and refreshed about
  once a minute. Provider errors retain previously checked UI data with a warning.
  Helius credits and plan limits should be checked before activation.
- The separate private studio feed remains bounded to 20 recent trades and 20
  positive holdings, with truncation flags. Its hourly USD marks are not P&L.
  Recent known orders have a conservative raw-receipt fallback.
- Studio polling is about every 30 seconds. Startup baselines old trades rather
  than announcing them again. Speech queues retain at most three fresh events,
  expire after two minutes and wait for conversational gaps.
- Position snapshots wait 10-20 minutes, refresh while queued and stop when no
  token balances are open. Busy streams/outages can delay or drop speech. Use one
  studio; speech is not exactly-once across browser crashes.
- Disabling trading prevents new signing/submissions but cannot undo a submitted
  or already signed transaction. Revoke sessions by rotating secrets; studio
  reporting must be disabled separately to silence announcements.

## Verification

```powershell
cd her-world
node --experimental-transform-types --test scripts/operator.test.mjs scripts/wallet-reader.test.mjs scripts/trades.test.mjs scripts/burn-amount.test.mjs scripts/burn-validation.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/next/dist/bin/next build --webpack
cd ../her
node --experimental-strip-types --test tests/*.test.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

The studio uses its existing Vite/Vinext/Cloudflare build, not native Next.js.
The public Vercel site uses native Next.js. Tests use synthetic data, unfunded
ephemeral keys and mocked providers/storage; they do not trade on mainnet, migrate
live databases or open paid Tavus sessions. Funded execution, database activation
and actual livestream audio checks remain separate authorized activation steps.

## Provider References

- [Jupiter order and execute](https://developers.jup.ag/docs/swap/order-and-execute)
- [Helius gTFA](https://www.helius.dev/docs/rpc/gettransactionsforaddress)
- [Helius DAS batch metadata](https://www.helius.dev/docs/api-reference/das/getassetbatch)
- [Helius Wallet API history](https://www.helius.dev/docs/wallet-api/history)
- [Tavus HTTPS tool delivery](https://docs.tavus.io/sections/conversational-video-interface/pal/llm-tool-delivery)
