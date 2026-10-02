# Character burn rounds

Production: https://heronsol.live

- HER mint: `G6VTWhrErdU59EaGFpiy3vugSG1UUjrDuaYZ33Kjpump`, Token-2022, six decimals.
- Minimum burn: 10,000 HER. Any larger decimal amount is accepted, up to six decimal places and the token program's integer limit. The entire amount counts.
- Rounds last 30 minutes. New burn requests close two minutes early; unsigned requests expire within 90 seconds and at least one minute before settlement.
- The largest total of verified burns wins. A tie or an empty round preserves the desired character. Repeated burns by the same wallet are allowed.
- Supabase `pg_cron` runs `her_private.advance_character_rounds()` every ten seconds. Settlement is serialized with receipt acceptance and is idempotent.
- Receipts require a finalized successful checked burn of the exact mint and amount, the wallet's signature, and the unique intent memo. Transaction messages are compared before broadcast. Submitted signatures are persisted before broadcast and automatically reconciled by the live controller.
- A receipt verified after its round closes is saved with `counted=false`; it cannot retroactively change a settled result. Blockchain/RPC outages can delay verification. Wallet activity retains receipts.
- The public site requires a recent healthy camera heartbeat before accepting burns. The controller uses a private server token and must stay running on the streaming computer.
- Stage requests remain separate and disabled until a host wallet and stage configuration exist.

The studio prepares the desired Tavus face in a second Daily call. It waits for decoded video and speech completion, commits the session cookies, displays the new tracks, and then retires the old call. Failed preparation keeps the old call. OBS is never stopped by the voting code. Brief overlap uses additional Tavus minutes. No-vote rounds do not force a character change.

Verification performed: token-program/mint checks, amount and receipt validation tests, production wallet authentication and access guards, rollback-only database settlement/tie/idempotence tests, and live character handovers. No real user tokens were burned in testing. A funded wallet must approve its own burn transaction.
