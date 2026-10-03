import Link from "next/link";
import { AcpNav, AcpFooter } from "@/components/acp-nav";
import "@/components/launchpad.css";
import "@/components/acp-pages.css";
export default function Page() {
  return (
    <main className="lp acp-pages">
      <AcpNav />
      <section className="acp-home-hero">
        <div>
          <span className="lp-kicker">THE AI CHARACTER LAUNCHPAD</span>
          <h1>
            Give the internet
            <br />
            <em>someone to watch.</em>
          </h1>
          <p>
            Your images. Your scripts. Your character’s next scene.
            <br />
            Build an AI video show with a coin of its own.
          </p>
          <div className="lp-hero-actions">
            <Link className="lp-primary" href="/create">
              Create a character ↗
            </Link>
            <Link className="lp-text-link" href="/tokens">
              Explore tokens →
            </Link>
          </div>
          <span className="acp-footnote">
            Creation is open. Video generation and live launch require connected
            services.
          </span>
        </div>
        <div className="acp-storyboard" aria-label="Character show workflow">
          <div className="acp-film-top">
            <span>YOUR NEXT SHOW</span>
            <span>01—04</span>
          </div>
          <div className="acp-film-main">
            <span className="acp-star">✳</span>
            <span>
              CAST THE
              <br />
              <em>unexpected.</em>
            </span>
          </div>
          <ol>
            <li>
              <b>01</b> Reference images <span>THE FACE</span>
            </li>
            <li>
              <b>02</b> Script + camera direction <span>THE SCENE</span>
            </li>
            <li>
              <b>03</b> Generated video clips <span>THE SHOW</span>
            </li>
            <li>
              <b>04</b> Chat shapes what’s next <span>THE TWIST</span>
            </li>
          </ol>
          <div className="acp-film-bottom">
            YOU DIRECT. THE CHARACTER PERFORMS. ↗
          </div>
        </div>
      </section>
      <section className="acp-process">
        <div>
          <span className="lp-kicker">FROM REFERENCE TO PERFORMANCE</span>
          <h2>
            A face is just
            <br />
            <em>the beginning.</em>
          </h2>
        </div>
        <div className="acp-process-copy">
          <p>
            Keep the same character across expressive performances, new settings
            and different camera angles. Upload reference images, then direct
            each clip with dialogue, action and a scene.
          </p>
          <p>
            Arrange the show, leave room for chat between clips, and let
            audience suggestions inspire the next generated scene. Your coin’s
            profile picture and banner stay separate from the character
            references.
          </p>
          <Link className="lp-text-link" href="/create">
            Start directing →
          </Link>
        </div>
      </section>
      <section className="acp-launch-callout">
        <div>
          <span className="lp-kicker">THE ACP DIRECTORY</span>
          <h2>
            Every launch.
            <br />
            <em>One place.</em>
          </h2>
          <p>
            Browse confirmed ACP-created tokens and open their coin pages on
            pump.fun.
          </p>
        </div>
        <Link className="lp-primary" href="/tokens">
          Explore tokens ↗
        </Link>
      </section>
      <AcpFooter />
    </main>
  );
}
