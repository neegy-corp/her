import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcpNav, AcpFooter } from "@/components/acp-nav";
import CreatorWorkspacePreview from "@/components/creator-workspace-preview";
import "@/components/launchpad.css";
import "@/components/acp-pages.css";
import "@/components/studio-theme.css";
export default function Page() {
  return (
    <main className="lp acp-pages acp-home">
      <AcpNav />
      <section className="brand-hero">
        <img className="brand-hero-art" src="/images/acp-v2/hero.webp" alt="" fetchPriority="high" />
        <div className="brand-hero-inner">
          <div className="brand-hero-copy">
            <h1>Your character.<br /><span>Your show.</span></h1>
            <p>Create an AI personality, direct their videos, and bring them to an audience.</p>
            <div className="creator-hero-actions">
              <Button asChild><Link href="/create">Create character <ArrowRight size={16} /></Link></Button>
              <Button variant="outline" asChild><Link href="/developer">Open studio</Link></Button>
            </div>
          </div>
        </div>
      </section>
      <section className="brand-workspace">
        <div className="brand-workspace-copy">
          <h2>Direct their<br /> first scene.</h2>
          <p>Give them a point of view. Write their opening line. Take it into the studio.</p>
          <a href="#creator-preview">Try the workspace <ArrowRight size={16} /></a>
        </div>
        <div id="creator-preview"><CreatorWorkspacePreview /></div>
      </section>
      <section className="brand-discovery">
        <img src="/images/acp-v2/discovery.webp" alt="" loading="lazy" />
        <div>
          <h2>Meet the<br /> characters.</h2>
          <p>Browse confirmed launches and their pump.fun pages.</p>
          <Button variant="outline" asChild><Link href="/tokens">Explore launches <ArrowRight size={16} /></Link></Button>
        </div>
      </section>
      <AcpFooter />
    </main>
  );
}
