// RPC simulation only: no wallet secret is read and there is no sendTransaction call.
import { createRequire } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import {
  Connection,
  PublicKey,
  Keypair,
  TransactionMessage,
  VersionedTransaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
const require = createRequire(import.meta.url),
  { PumpSdk, OnlinePumpSdk } = require("@pump-fun/pump-sdk"),
  BN = require("bn.js");
const env = {};
for (const path of [".env", ".env.local"])
  if (existsSync(path))
    Object.assign(env, parseEnv(readFileSync(path, "utf8")));
const rpc = new Connection(
  env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com",
  "confirmed",
);
const payer = new PublicKey(
  process.argv[2] || "6n3erAFxnvfjsAfbPdabwnpvfGpi2RW5Z8Yk1AYspzXs",
);
try {
  const online = new OnlinePumpSdk(rpc),
    quoteMint = new PublicKey("Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh");
  const [global, quote, latest] = await Promise.all([
    online.fetchGlobal(),
    online.resolveQuoteMint(quoteMint),
    rpc.getLatestBlockhash(),
  ]);
  if (
    !global.creatorFeeConfigurable ||
    global.maxConfigurableCreatorFeeBps.lt(new BN(100)) ||
    quote.source !== "quoteControl"
  )
    throw new Error("Pair configuration changed");
  const mint = Keypair.generate();
  const instruction = await new PumpSdk().createV2Instruction({
    mint: mint.publicKey,
    user: payer,
    creator: new PublicKey("6n3erAFxnvfjsAfbPdabwnpvfGpi2RW5Z8Yk1AYspzXs"),
    name: "ACP simulation only",
    symbol: "ACPSIM",
    uri: "https://example.com/acp-simulation.json",
    mayhemMode: false,
    cashback: false,
    holderReward: false,
    quoteMint,
    quoteTokenProgram: quote.quoteTokenProgram,
    creatorFeeBps: new BN(100),
  });
  const message = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: latest.blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400000 }),
      instruction,
    ],
  }).compileToV0Message();
  const tx = new VersionedTransaction(message);
  tx.sign([mint]);
  const simulation = await rpc.simulateTransaction(tx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  console.log(
    JSON.stringify(
      {
        simulationOnly: true,
        submitted: false,
        walletSecretUsed: false,
        error: simulation.value.err,
        unitsConsumed: simulation.value.unitsConsumed,
        logs: simulation.value.logs?.filter((line) =>
          /error|failed|Error|insufficient/i.test(line),
        ),
      },
      null,
      2,
    ),
  );
  if (simulation.value.err) process.exitCode = 1;
} catch {
  console.log(
    JSON.stringify({
      simulationOnly: true,
      submitted: false,
      verified: false,
      reason: "RPC or pair configuration unavailable",
    }),
  );
  process.exitCode = 1;
}
