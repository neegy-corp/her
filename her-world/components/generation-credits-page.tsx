"use client";
import { WalletRoot, useWallet } from "./wallet";
import { AcpNav, AcpFooter } from "./acp-nav";
import LaunchWalletPanel from "./launch-wallet-panel";
import StreamCredits from "./stream-credits";
import { Button } from "./ui/button";
import Link from "next/link";
import "./launchpad.css";
function Credits({ id }: { id: string }) {
  const { viewer, connect } = useWallet();
  return <div className="lp-page"><AcpNav active="create" /><main className="lp-shell" style={{maxWidth:900,margin:"40px auto",padding:24}}>
    <h1>Generation credits</h1>
    <p>Fund this character’s wallet, then review and buy a generation package. Depositing SOL alone does not purchase credits.</p>
    <p>Drafts and your own scripts are free to edit. Provider submissions consume allowances; uncertain submissions stay reserved while they are checked.</p>
    {!viewer.wallet && <Button onClick={connect}>Connect developer wallet</Button>}
    <LaunchWalletPanel id={id} ready={!!viewer.wallet} />
    <StreamCredits id={id} />
    <Button asChild variant="outline"><Link href={`/create/${encodeURIComponent(id)}/character`}>Back to character</Link></Button>
  </main><AcpFooter /></div>;
}
export default function GenerationCreditsPage({id}:{id:string}) { return <WalletRoot><Credits id={id}/></WalletRoot>; }
