// Read-only mainnet capability check. Never loads a wallet or submits a transaction.
import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { createRequire } from "node:module";
import { Connection, PublicKey } from "@solana/web3.js";
const env = {};
for (const file of [".env", ".env.local"])
  if (existsSync(file))
    Object.assign(env, parseEnv(readFileSync(file, "utf8")));
const { OnlinePumpSdk } = createRequire(import.meta.url)("@pump-fun/pump-sdk");
const rpc = new Connection(
  env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);
try {
  const sdk = new OnlinePumpSdk(rpc);
  const [global, quote] = await Promise.all([
    sdk.fetchGlobal(),
    sdk.resolveQuoteMint(
      new PublicKey("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh"),
    ),
  ]);
  console.log(
    JSON.stringify(
      {
        checkedAt: new Date().toISOString(),
        quote: {
          ...quote,
          mint: quote.mint.toBase58(),
          quoteTokenProgram: quote.quoteTokenProgram.toBase58(),
        },
        creatorFeeConfigurable: global.creatorFeeConfigurable,
        maxCreatorFeeBps: String(global.maxConfigurableCreatorFeeBps),
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      verified: false,
      reason: error instanceof Error ? error.name : "RPC unavailable",
    }),
  );
  process.exitCode = 1;
}
