"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, ArrowUp, AudioLines, Check, ChevronRight, Maximize2, Monitor, Radio, Settings2, Volume2, VolumeX, X, Play, Square, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { parsePumpUrl, rehearsalReply, HER_DELIVERY_SAMPLE, HER_GREETING } from "@/lib/her";
import { useLiveSession } from "@/lib/use-live-session";
import { HerMedia } from "@/components/her-media";
type Message = { id: string; user: string; text: string; source: "demo" | "local" | "pump" | "her" };
const sample: Message[] = [
  { id: "d1", user: "solstice", text: "wait she actually reads the chat?", source: "demo" },
  { id: "d2", user: "latecheckout", text: "HER has entered the trenches", source: "demo" },
  { id: "d3", user: "pixel", text: "the setup is kind of a vibe", source: "demo" },
  { id: "d4", user: "moonroom", text: "HER, introduce yourself 👀", source: "demo" },
];
const introduction = HER_GREETING;
export default function Home() {
  const [messages, setMessages] = useState<Message[]>(sample);
  const [input, setInput] = useState("");
  const [running, setRunning] = useState(false);
  const [muted, setMuted] = useState(false);
  const [auto, setAuto] = useState(true);
  const [settings, setSettings] = useState(false);
  const [streamUrl, setStreamUrl] = useState("");
  const [caption, setCaption] = useState(introduction);
  const [notice, setNotice] = useState("");
  const [broadcast, setBroadcast] = useState(false);
  const [config, setConfig] = useState({ video: false, chat: false });
  const [feed, setFeed] = useState<"demo" | "connecting" | "connected" | "error">("demo");
  const [feedEnabled, setFeedEnabled] = useState(false);
  const [savedStream, setSavedStream] = useState("");
  const live = useLiveSession((id, text) => {
    setCaption(text);
    setMessages(old => { const key = `her-${id}`; const index = old.findIndex(m => m.id === key); const msg: Message = { id: key, user: "HER", text, source: "her" }; return index < 0 ? [...old.slice(-99), msg] : old.map(m => m.id === key ? msg : m); });
  }, setNotice);
  const liveRef = useRef(live); liveRef.current = live;
  const autoRef = useRef(auto); autoRef.current = auto;
  const stage = useRef<HTMLDivElement>(null);
  const chatEnd = useRef<HTMLDivElement>(null);
  const cameraStarted=useRef(false);
  useEffect(()=>{if(new URLSearchParams(location.search).get('camera')==='1')setBroadcast(true);},[]);
  useEffect(()=>{
    if(!config.video||cameraStarted.current||new URLSearchParams(location.search).get('camera')!=='1')return;
    cameraStarted.current=true;
    void liveRef.current.end().then(()=>liveRef.current.start());
  },[config.video]);
  useEffect(() => {
    if (live.state === "live") { setSettings(false); setBroadcast(true); }
  }, [live.state]);
  useEffect(() => {
    if (!broadcast) return;
    const previous = document.title;
    document.title = "HER Camera";
    function exit(event: KeyboardEvent) { if (event.key === "Escape") setBroadcast(false); }
    window.addEventListener("keydown", exit);
    return () => { document.title = previous; window.removeEventListener("keydown", exit); };
  }, [broadcast]);
  useEffect(() => {
    const stored = localStorage.getItem("her-stream") || ""; setStreamUrl(stored); setSavedStream(stored);
    let disposed=false; let retry: ReturnType<typeof setTimeout> | undefined;
    async function status(){
      try {
        const r=await fetch('/api/status',{signal:AbortSignal.timeout(10000)});
        if(!r.ok)throw new Error('Status unavailable');
        const data=await r.json() as {video:boolean;chat:boolean};
        if(!disposed)setConfig(data);
      } catch {
        if(!disposed){setNotice('Reconnecting to the studio automatically…');retry=setTimeout(()=>void status(),5000);}
      }
    }
    void status();return()=>{disposed=true;if(retry)clearTimeout(retry);};
  }, []);
  useEffect(() => { const container = chatEnd.current?.parentElement; if (container) container.scrollTop = container.scrollHeight; }, [messages]);
  useEffect(() => { if (!auto) live.clearQueue(); }, [auto]);
  useEffect(() => {
    if (!config.chat || !["127.0.0.1", "localhost"].includes(window.location.hostname)) return;
    let stopped = false;
    let lastCoin = "";
    async function syncLocalCoin() {
      try {
        const response = await fetch("/active-stream.json", { cache: "no-store" });
        if (!response.ok) return;
        const data = await response.json() as { mint?: string };
        const url = `https://pump.fun/coin/${data.mint || ""}`;
        if (stopped || !parsePumpUrl(url)) return;
        if (lastCoin === url) return;
        lastCoin = url;
        liveRef.current.clearQueue();
        setSavedStream(url);
        setStreamUrl(url);
        localStorage.setItem("her-stream", url);
        setFeedEnabled(true);
      } catch { /* Keep the selected feed during a transient local fetch failure. */ }
    }
    void syncLocalCoin();
    const timer = setInterval(() => void syncLocalCoin(), 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, [config.chat]);
  useEffect(() => {
    if (!feedEnabled || !savedStream) return;
    let stopped = false; let timer: ReturnType<typeof setTimeout>; let after = Date.now(); const seen = new Set<string>(); const abort = new AbortController();
    async function poll() {
      try {
        const response = await fetch(`/api/chat?stream=${encodeURIComponent(savedStream)}&after=${after}`, { signal: abort.signal }); const data = await response.json() as { error?: string; messages: { id: string; user: string; text: string; timestamp: number }[] };
        if (!response.ok) throw new Error(data.error);
        if (stopped) return;
        setFeed("connected");
        const fresh = (data.messages as { id: string; user: string; text: string; timestamp: number }[]).filter(m => m.timestamp >= after && !seen.has(m.id));
        for (const m of fresh) { seen.add(m.id); after = Math.max(after, m.timestamp); if (autoRef.current) liveRef.current.enqueue(m.user, m.text); }
        if (seen.size > 2000) { const keep = [...seen].slice(-500); seen.clear(); keep.forEach(id => seen.add(id)); }
        if (fresh.length) setMessages(old => [...old.filter(m => m.source !== "demo"), ...fresh.map(m => ({ ...m, source: "pump" as const }))].slice(-100));
      } catch (error) { if (!stopped) { setFeed("error"); setNotice(error instanceof Error ? error.message : "Chat disconnected."); } }
      if (!stopped) timer = setTimeout(poll, 4000);
    }
    setFeed("connecting"); void poll();
    return () => { stopped = true; abort.abort(); clearTimeout(timer); };
  }, [feedEnabled, savedStream]);
  useEffect(() => {
    const context = (document as unknown as { modelContext?: { registerTool: (tool: unknown, options: { signal: AbortSignal }) => Promise<void> } }).modelContext;
    if (!context) return; const controller = new AbortController();
    void Promise.resolve(context.registerTool({ name: "her_open_connection_settings", description: "Open HER's connection settings. Does not start video or a broadcast.", inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: false }, execute: () => { setSettings(true); return { settingsOpen: true }; } }, { signal: controller.signal })).catch(() => {});
    return () => controller.abort();
  }, []);
  async function startLive() { if (!config.video) { setSettings(true); return; } setRunning(false); window.speechSynthesis?.cancel(); setCaption("Connecting to HER's live video…"); await live.start(); }
  function saveStream() {
    if (!parsePumpUrl(streamUrl)) { setNotice("Enter a valid pump.fun URL containing a Solana token address."); return; }
    localStorage.setItem("her-stream", streamUrl); setSavedStream(streamUrl); setFeedEnabled(config.chat); setSettings(false);
    setNotice(config.chat ? "Connecting to your chat source…" : "Stream saved. A chat adapter still needs to be connected.");
  }
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(""), 6000); return () => clearTimeout(timer); }, [notice]);
  function speak(text: string) {
    setCaption(text);
    if (muted || !("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = speechSynthesis.getVoices().find(v => /samantha|jenny|aria|zira|female/i.test(v.name));
    if (voice) utterance.voice = voice;
    utterance.rate = 0.96; speechSynthesis.speak(utterance);
  }
  function reply(message: Message) {
    if (live.state === "live") { live.enqueue(message.user, message.text); return; }
    const text = rehearsalReply(message.text, message.user);
    speak(text); setMessages(m => [...m.slice(-99), { id: crypto.randomUUID(), user: "HER", text, source: "her" }]);
  }
  function testDelivery() {
    if (live.state === "live") { live.enqueue("director", `Delivery test: say this naturally, without censoring: ${HER_DELIVERY_SAMPLE}`); return; }
    setRunning(true); speak(HER_DELIVERY_SAMPLE);
    setMessages(m => [...m.slice(-99), { id: crypto.randomUUID(), user: "HER", text: HER_DELIVERY_SAMPLE, source: "her" }]);
    setNotice("Browser voice rehearsal. Connect live video to audition the actual HER voice and lip sync.");
  }
  function send() {
    if (!input.trim()) return;
    const message: Message = { id: crypto.randomUUID(), user: "you", text: input.trim(), source: "local" };
    setMessages(m => [...m.slice(-99), message]); setInput("");
    if ((running || live.state === "live") && auto) reply(message);
  }
  function toggleRehearsal() { if (running) { setRunning(false); window.speechSynthesis?.cancel(); } else { setRunning(true); speak(introduction); } }
  return <main className={broadcast ? "app broadcast" : "app"}>
    <header className="topbar"><a className="wordmark" href="/" aria-label="HER home">HER<span>●</span></a><div className="top-divider"/><span className="product-name">A presence. Not just a reply.</span><div className="top-right"><span className="studio-tag"><span className="status-dot"/> PRIVATE STUDIO</span><button className="icon-button" aria-label="Open studio settings" onClick={() => setSettings(true)}><Settings2 size={18}/></button></div></header>
    <section className="page-heading"><div><div className="eyebrow">THE ROOM IS YOURS</div><h1>Meet your new main character.</h1></div><button className="quiet-button" onClick={() => setSettings(true)}><Link2 size={15}/> Connect pump.fun <ArrowUpRight size={15}/></button></section>
    <div className="studio-grid"><section className="camera-column"><div className={live.video ? "camera-stage has-live-video" : "camera-stage"} ref={stage}>
      <img style={{ opacity: live.video ? 0 : 1 }} className="host-image" src="/olivia-standby.jpg" alt="Olivia, HER's AI host, in her office"/>
      <HerMedia video={live.video} audio={live.audio} muted={muted} onBlocked={() => setNotice("Click the sound button to allow live audio in your browser.")}/><div className="camera-shade"/><div className="stage-top"><span className={running ? "stage-badge active" : "stage-badge"}><span/> {live.state === "live" ? "LIVE AI" : live.state === "connecting" ? "CONNECTING" : running ? "REHEARSAL" : "STANDBY"}</span><span className="stage-format">HER STUDIO / 001</span></div>
      <div className="camera-copy"><span className="ai-label">YOUR AI HOST</span><div className="host-name">HER<span>AI</span></div><p>A little curiosity. A lot of personality.</p></div>
      <div className="caption"><AudioLines size={18}/><p>{caption}</p></div><div className="stage-bottom"><span><span className="status-dot"/> {live.state === "live" ? (live.speaking ? "HER is speaking · AI generated" : `Live AI video · ${live.queued} queued`) : running ? "Browser voice · scripted preview" : "Character preview · AI generated"}</span><div><button className="stage-button" aria-label={muted ? "Unmute HER" : "Mute HER"} onClick={() => { setMuted(!muted); window.speechSynthesis?.cancel(); }}>{muted ? <VolumeX size={18}/> : <Volume2 size={18}/>}</button><button className="stage-button" aria-label="Fullscreen camera" onClick={() => { if (document.fullscreenElement) void document.exitFullscreen(); else void stage.current?.requestFullscreen().catch(() => setNotice("Fullscreen is unavailable in this browser.")); }}><Maximize2 size={17}/></button></div></div>
      {broadcast && <><span className="broadcast-disclosure">HER · AI{live.state !== "live" || !live.video ? " · STANDBY" : ""}</span><button className="exit-broadcast" onClick={() => setBroadcast(false)}><X size={16}/> Back to controls · Esc</button></>}
    </div><div className="host-strip"><div className="host-avatar">h.</div><div><h2>HER <span>AI HOST</span></h2><p>She's got something to say.</p></div><div className="host-state"><span className="status-dot"/>{live.state === "live" ? "On camera" : running ? "In rehearsal" : "Ready when you are"}</div></div>
    <div className="control-strip"><div><span className="small-label">SESSION</span><strong>{running ? "Rehearsal in progress" : "Let's get her talking."}</strong></div><button className="primary-button" disabled={live.state !== "idle"} onClick={toggleRehearsal}>{running ? <Square size={14}/> : <Play size={14}/>} {running ? "End rehearsal" : "Start rehearsal"}</button><button className="outline-button" disabled={live.state === "connecting" || live.state === "ending"} onClick={() => live.state === "live" ? void live.end() : void startLive()}><Radio size={15}/> {live.state === "live" ? "End live session" : live.state === "connecting" ? "Connecting…" : live.state === "ending" ? "Ending…" : "Start live session"}</button></div><div className="lower-strip"><span><Check size={13}/> Female persona</span><span><AudioLines size={14}/> Swearing allowed</span><button onClick={() => setBroadcast(true)}><Monitor size={14}/> Broadcast view <ArrowUpRight size={13}/></button></div></section>
    <aside className="chat-panel"><div className="chat-header"><h2>The conversation</h2><span className="chat-count">{messages.filter(m => m.source !== "her").length}</span></div><div className="chat-source"><span className="pump-mark">◒</span><span>pump.fun chat</span><span className="demo-label">{feed === "demo" ? "DEMO FEED" : feed.toUpperCase()}</span></div><div className="pinned-note"><span>✳</span><p>She's here for the conversation.<br/><strong>Give her something to talk about.</strong></p></div>
    <div className="messages" aria-label="Conversation messages" role="log" aria-live="polite">{messages.map((m, i) => <div className={`message ${m.source === "her" ? "her-message" : ""}`} key={m.id}><div className={`message-avatar color-${i % 4}`}>{m.source === "her" ? "h." : m.user.slice(0, 1).toUpperCase()}</div><div className="message-body"><div><strong>{m.user}</strong>{m.source === "her" && <span className="mini-badge">HOST</span>}{m.source === "demo" && <span className="message-meta">sample</span>}{m.source === "local" && <span className="message-meta">local</span>}</div><p>{m.text}</p>{(running || live.state === "live") && m.source !== "her" && <button className="reply-button" onClick={() => reply(m)}>Have HER respond <ChevronRight size={12}/></button>}</div></div>)}<div ref={chatEnd}/></div>
    <div className="chat-compose"><form onSubmit={e => { e.preventDefault(); send(); }}><input aria-label="Message HER" placeholder="Say something to HER…" value={input} maxLength={400} onChange={e => setInput(e.target.value)}/><button aria-label="Send message" disabled={!input.trim()}><ArrowUp size={18}/></button></form><div><span>{live.state === "live" ? "Sent to HER · not posted to pump.fun" : "Local rehearsal · not posted to pump.fun"}</span><span>{input.length}/400</span></div></div></aside></div>
    <section className="studio-bottom"><div className="personality"><div className="section-caption">THE PERSONALITY</div><p>Warm. Witty.<br/><em>A little unpredictable.</em></p><span>HER reads the room and brings her own energy.</span></div><div className="session-settings"><div className="section-caption">IN THE DIRECTOR'S CHAIR</div><div className="setting-row"><div><strong>Let HER lead</strong><p>Automatically respond to incoming messages.</p></div><Switch aria-label="Automatically respond to chat" checked={auto} onCheckedChange={setAuto}/></div><div className="setting-row"><div><strong>Natural voice. No bleeps.</strong><p>Audition her timing, tone, and ordinary swearing.</p></div><button className="quiet-button" disabled={live.state === "connecting" || live.state === "ending"} onClick={testDelivery}>Test delivery <AudioLines size={15}/></button></div><div className="setting-row"><div><strong>One chat. One conversation.</strong><p>Connect a token's chat to bring the room to life.</p></div><button aria-label="Configure pump.fun connection" className="icon-button" onClick={() => setSettings(true)}><ArrowUpRight size={19}/></button></div></div><div className="connection-card"><span className="connection-icon"><Radio size={21}/></span><h3>From chat to camera.</h3><p>Connect your stream. Let HER take it from there.</p><button onClick={() => setSettings(true)}>Set up your connections <ArrowUpRight size={15}/></button></div></section>
    <footer><span className="footer-logo">HER.</span><span>An AI personality. A very real conversation.</span><span>Made for the room.</span></footer>
    <Dialog open={settings} onOpenChange={setSettings}><DialogContent className="settings-dialog"><DialogTitle>Bring HER online.</DialogTitle><DialogDescription>Connect a female Tavus persona and your pump.fun chat source.</DialogDescription><label htmlFor="stream-url">pump.fun token or stream URL</label><input id="stream-url" value={streamUrl} onChange={e => setStreamUrl(e.target.value)} placeholder="https://pump.fun/coin/…"/><p className="setup-note">The rehearsal uses a still character image and scripted browser speech. Live video needs a Tavus API key, female face, and HER persona. A chat feed adapter supplies messages from your stream.</p><div className="connection-status"><p><span className={config.video ? "ready" : ""}>●</span> Live video <strong>{config.video ? "Configured" : "Needs Tavus setup"}</strong></p><p><span className={config.chat ? "ready" : ""}>●</span> Chat adapter <strong>{config.chat ? "Configured" : "Not connected"}</strong></p></div><button className="primary-button" onClick={saveStream}>Save stream link <Check size={15}/></button>{feedEnabled && <button className="outline-button" onClick={() => { setFeedEnabled(false); setFeed("demo"); live.clearQueue(); setNotice("Chat source disconnected."); }}>Disconnect chat feed</button>}<button className="quiet-button" onClick={() => void live.end()}>End any existing video session</button></DialogContent></Dialog>
    {notice && <div className="toast" role="status">{notice}<button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={15}/></button></div>}
  </main>;
}
