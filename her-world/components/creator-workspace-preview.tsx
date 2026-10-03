"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clapperboard, GripVertical, Mic2, Plus, Radio, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { newDraft } from "@/lib/launchpad";
import { creatorPath, DRAFT_STORE, keepDraft, readLocalDrafts } from "@/lib/creator-navigation";

const views = [
  { id: "identity", label: "Identity", icon: UserRound },
  { id: "show", label: "Show", icon: Clapperboard },
  { id: "launch", label: "Launch", icon: Radio },
] as const;
type View = typeof views[number]["id"];

export default function CreatorWorkspacePreview() {
  const router = useRouter();
  const [view, setView] = useState<View>("show");
  const [name, setName] = useState("");
  const [personality, setPersonality] = useState("");
  const [script, setScript] = useState("");
  const [error, setError] = useState("");
  const [opening, setOpening] = useState(false);

  function continueDraft() {
    try {
      const draft = newDraft();
      draft.name = name.trim();
      draft.personality = personality;
      if (script.trim()) draft.show.clips[0].script = script.trim();
      localStorage.setItem(DRAFT_STORE, JSON.stringify(keepDraft(readLocalDrafts(localStorage.getItem(DRAFT_STORE)), draft)));
      setOpening(true);
      router.push(creatorPath(draft.id, view === "show" ? "show" : "character"));
    } catch {
      setError("This browser couldn’t save the draft. Open the builder to try again.");
    }
  }

  return (
    <section className="workspace-preview" aria-label="Try the creator workspace">
      <div className="workspace-preview-bar"><span><Clapperboard size={17} />Creator workspace</span><span>Try it out</span></div>
      <div className="workspace-preview-body">
        <div className="workspace-preview-heading"><div><h2>{name || "Your first show"}</h2><p>Your character. Your creative control.</p></div><Mic2 size={25} strokeWidth={1.4} /></div>
        <div className="workspace-preview-switcher" role="group" aria-label="Workspace preview sections">
          {views.map(({ id, label, icon: Icon }) => <Button variant="ghost" key={id} aria-pressed={view === id} onClick={() => setView(id)}><Icon size={15} />{label}</Button>)}
        </div>
        <div className="workspace-preview-panel" key={view}>
          {view === "identity" && <>
            <Label htmlFor="preview-name">Character name</Label><Input id="preview-name" maxLength={32} placeholder="Give them a name" value={name} onChange={e => setName(e.target.value)} />
            <Label htmlFor="preview-personality">Their point of view</Label><Textarea id="preview-personality" maxLength={2000} rows={3} placeholder="What do they care about? How do they talk?" value={personality} onChange={e => setPersonality(e.target.value)} />
            <p>Build their look and choose a voice in the full workspace.</p>
          </>}
          {view === "show" && <>
            <div className="workspace-scene-title"><GripVertical size={15} /><strong>The opening</strong><span>10 sec target</span></div>
            <Label htmlFor="preview-script">What do they say?</Label><Textarea id="preview-script" maxLength={300} rows={4} placeholder="Write their first line. Give chat something to react to…" value={script} onChange={e => setScript(e.target.value)} />
            <div className="workspace-sequence" aria-label="Show sequence"><span className="sequence-scene"><Clapperboard size={15} />Opening scene</span><ArrowRight size={14} /><span>Chat break</span><ArrowRight size={14} /><span className="sequence-next"><Plus size={15} />Next scene</span></div>
            <p>Write the scene, set the action, then generate a clip in the builder.</p>
          </>}
          {view === "launch" && <>
            <h3>Ready when you are.</h3>
            <ol className="workspace-launch-steps"><li><UserRound size={17} /><span>Create their identity<small>Character reference, personality and voice</small></span><ArrowRight size={15} /></li><li><Clapperboard size={17} /><span>Direct their show<small>Scripts, scenes and prepared videos</small></span><ArrowRight size={15} /></li><li><Radio size={17} /><span>Review the coin launch<small>Artwork, wallet approval and stream setup</small></span><ArrowRight size={15} /></li></ol>
            <p>A local draft comes first. Coin creation and streaming require connected services.</p>
          </>}
        </div>
      </div>
      <div className="workspace-preview-bottom"><span>Keep your ideas.<br />Build them in the studio.</span><Button className="lp-primary" onClick={continueDraft} disabled={opening}>{opening ? "Opening…" : "Open in studio"}<ArrowRight size={16} /></Button></div>
      {error && <p className="workspace-preview-error" role="alert">{error} <a href="/create">Open the builder</a></p>}
    </section>
  );
}
