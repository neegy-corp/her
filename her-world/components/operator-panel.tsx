'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { ArrowDownLeft, ArrowUpRight, Check, ExternalLink, KeyRound, LockKeyhole, LogOut, Pencil, RefreshCw, Save } from 'lucide-react';

type Token = { mint: string; name: string; symbol: string; decimals: number };
type Position = { mint: string; amount: number; name: string; symbol?: string; priceUsd: number | null; valueUsd: number | null; thesis: string };
type Order = { id: string; mint: string; side: string; amount: string; token_name: string; symbol: string; status: string; signature: string | null; created_at: number };
type State = { authenticated: boolean; configured?: boolean; wallet: string; tracking: boolean; trading: boolean; signerConfigured: boolean; preview: boolean; intervalMinutes: number; notes: { mint: string; thesis: string }[]; orders: Order[]; feed: { positions: Position[]; holdingsTruncated: boolean; observedAt: number } | null };
type Quote = { id: string; token: Token; side: 'buy' | 'sell'; amount: string; expectedOutput: string; outputSymbol: string; slippageBps: number; feeBps: number | null; expires: number };
const shortened = (value: string) => value.length > 16 ? `${value.slice(0, 6)}...${value.slice(-6)}` : value;
const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 6 });
const usd = (value: number | null) => value === null ? 'Unavailable' : value.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumSignificantDigits: 6 });
async function api<T>(body?: Record<string, unknown>, query = ''): Promise<T> {
  const path = window.location.pathname.replace(/\/$/, '');
  const response = await fetch(`${path}/api${query}`, { cache: 'no-store', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json() as T & { error?: string };
  if (!response.ok && !(response.status === 401 && !body && !query)) throw new Error(data.error || 'Operations are unavailable.');
  return data;
}
export default function OperatorPanel() {
  const [state, setState] = useState<State | null>(null);
  const [password, setPassword] = useState('');
  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [mint, setMint] = useState('');
  const [amount, setAmount] = useState('');
  const [thesis, setThesis] = useState('');
  const [slippage, setSlippage] = useState('1');
  const [token, setToken] = useState<Token | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState(0);
  const refresh = useCallback(async () => setState(await api<State>()), []);
  useEffect(() => {
    let disposed = false;
    api<State>().then(data => { if (!disposed) setState(data); }).catch(reason => { if (!disposed) setError(reason.message); });
    return () => { disposed = true; };
  }, []);
  useEffect(() => {
    if (!state?.authenticated) return;
    const timer = setInterval(() => { void refresh().catch(reason => setError(reason.message)); }, 30000);
    return () => clearInterval(timer);
  }, [state?.authenticated, refresh]);
  useEffect(() => { if (!quote) return; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [quote]);
  async function work(label: string, action: () => Promise<void>) {
    setBusy(label); setError(''); setMessage('');
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Please try again.'); }
    finally { setBusy(''); }
  }
  function invalidate() { setQuote(null); setReviewed(false); }
  async function login(event: FormEvent) {
    event.preventDefault();
    await work('login', async () => { await api({ action: 'login', password }); setPassword(''); await refresh(); });
  }
  const expired = !!quote && quote.expires <= now;
  async function lookup() {
    invalidate();
    await work('lookup', async () => { const found = await api<Token>(undefined, `?action=token&mint=${encodeURIComponent(mint.trim())}`); setToken(found); setThesis(current => current || state?.notes.find(note => note.mint === found.mint)?.thesis || ''); });
  }
  async function prepare(event: FormEvent) {
    event.preventDefault();
    invalidate();
    await work('quote', async () => { const result = await api<Quote>({ action: 'prepare', mint: mint.trim(), side, amount, thesis, slippageBps: Math.round(Number(slippage) * 100) }); setQuote(result); setToken(result.token); setNow(Date.now()); });
  }
  async function execute() {
    if (!quote || expired || !reviewed) return;
    await work('execute', async () => {
      const result = await api<{ status: string; signature: string }>({ action: 'execute', id: quote.id });
      invalidate(); setMessage(result.status === 'submitted' ? 'Submitted. Awaiting confirmed wallet activity.' : result.status === 'failed' ? 'Trade failed. No confirmed trade announcement will be sent.' : 'Execution is unconfirmed. Check activity and the transaction before placing another order.');
      await refresh();
    });
  }
  const positions = state?.feed?.positions.filter(position => position.mint !== 'SOL') || [];
  return <main className="op-page">
    <div className="op-nav"><div className="op-brand"><Image src="/images/acp-v2/logo.png" alt="" width={32} height={32} /><strong>ACP</strong><span>Operations</span></div>{state?.authenticated && <div className="op-nav-actions"><button type="button" className="op-icon" title="Refresh activity" aria-label="Refresh activity" disabled={!!busy} onClick={() => void work('refresh', refresh)}><RefreshCw size={18} /></button><button type="button" className="op-icon" title="Sign out" aria-label="Sign out" disabled={!!busy} onClick={() => void work('logout', async () => { await api({ action: 'logout' }); invalidate(); setState(null); await refresh(); })}><LogOut size={18} /></button></div>}</div>
    {!state ? <div className="op-status" role="status">{error ? <button className="op-secondary" disabled={!!busy} onClick={() => void work('refresh', refresh)}><RefreshCw size={16} />Retry connection</button> : 'Loading operations...'}</div> : !state.authenticated ? <section className="op-login"><LockKeyhole size={28} /><h1>Operator Access</h1><form onSubmit={login}><label htmlFor="op-password">Password</label><input id="op-password" type="password" autoComplete="current-password" value={password} maxLength={256} onChange={event => setPassword(event.target.value)} required /><button className="op-primary" disabled={!!busy || state.configured === false}><LockKeyhole size={16} />{busy === 'login' ? 'Signing in...' : 'Sign in'}</button></form>{state.configured === false && <p className="op-error">Authentication is not configured.</p>}</section> : <>
      <div className="op-heading"><h1>Wallet Desk</h1><span className={`op-state ${state.trading ? 'op-live' : ''}`}>{state.trading ? 'Trading enabled' : 'Trading disabled'}</span></div>
      <dl className="op-summary"><div><dt>Project wallet</dt><dd><code title={state.wallet}>{state.wallet ? shortened(state.wallet) : 'Not configured'}</code></dd></div><div><dt>Wallet feed</dt><dd>{state.tracking ? 'Enabled' : 'Disabled'}</dd></div><div><dt>Position updates</dt><dd>{state.intervalMinutes} minutes</dd></div></dl>
      <div className="op-workspace"><section className="op-ticket"><div className="op-section-title"><h2>Trade Ticket</h2><span className="op-signer"><KeyRound size={15} />{state.signerConfigured ? 'Signer ready' : 'Signer not configured'}</span></div>
        <form onSubmit={prepare}>
          <fieldset disabled={!!busy}>
          <div className="op-segment" aria-label="Trade side">{(['buy', 'sell'] as const).map(value => <button key={value} type="button" aria-pressed={side === value} onClick={() => { setSide(value); setAmount(''); invalidate(); }} disabled={!!busy}>{value === 'buy' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}{value === 'buy' ? 'Buy' : 'Sell'}</button>)}</div>
          <label htmlFor="op-mint">Contract Address</label><div className="op-input-action"><input id="op-mint" value={mint} maxLength={44} spellCheck={false} autoComplete="off" onChange={event => { setMint(event.target.value); setToken(null); setThesis(''); invalidate(); }} required /><button type="button" className="op-icon" title="Look up coin" aria-label="Look up coin" onClick={() => void lookup()} disabled={!mint.trim() || !!busy}><RefreshCw size={17} /></button></div>
          <div className="op-token" aria-live="polite">{token ? <><strong>{token.name || 'Unnamed coin'}</strong><span>{token.symbol || 'Ticker unavailable'} · {token.decimals} decimals</span></> : <span>No coin selected</span>}</div>
          <div className="op-fields"><div><label htmlFor="op-amount">{side === 'buy' ? 'Spend (SOL)' : `Sell (${token?.symbol || 'tokens'})`}</label><input id="op-amount" inputMode="decimal" value={amount} onChange={event => { setAmount(event.target.value); invalidate(); }} autoComplete="off" required /></div><div><label htmlFor="op-slippage">Slippage (%)</label><input id="op-slippage" type="number" min="0.1" max="3" step="0.1" value={slippage} onChange={event => { setSlippage(event.target.value); invalidate(); }} required /></div></div>
          <label htmlFor="op-thesis">Position Thesis</label><textarea id="op-thesis" value={thesis} minLength={10} maxLength={1200} rows={5} onChange={event => { setThesis(event.target.value); invalidate(); }} required />
          <div className="op-form-footer"><span>{thesis.length}/1,200</span><button type="button" className="op-secondary" disabled={!!busy || state.preview || !state.wallet || !mint || thesis.trim().length < 10} onClick={() => void work('thesis', async () => { await api({ action: 'thesis', mint: mint.trim(), thesis }); setMessage('Thesis saved.'); await refresh(); })}><Save size={15} />Save thesis</button></div>
          <button type="submit" className="op-primary" disabled={!!busy || !state.trading || !state.signerConfigured}>{side === 'buy' ? <ArrowDownLeft size={17} /> : <ArrowUpRight size={17} />}{busy === 'quote' ? 'Getting quote...' : `Review ${side}`}</button>
          </fieldset>
        </form>
        {quote && <section className="op-review" aria-label="Review order"><h3>Review Order</h3><code>{quote.token.mint}</code><dl><div><dt>{quote.side === 'buy' ? 'Spend' : 'Sell'}</dt><dd>{quote.amount} {quote.side === 'buy' ? 'SOL' : quote.token.symbol || 'tokens'}</dd></div><div><dt>Expected receive</dt><dd>{quote.expectedOutput} {quote.outputSymbol}</dd></div><div><dt>Slippage limit</dt><dd>{quote.slippageBps / 100}%</dd></div><div><dt>Swap fee</dt><dd>{quote.feeBps === null ? 'Unavailable' : `${quote.feeBps / 100}%`}</dd></div><div><dt>Quote expires</dt><dd>{expired ? 'Expired' : `${Math.max(0, Math.ceil((quote.expires - now) / 1000))}s`}</dd></div></dl><p className="op-fine">Network fees are additional. Expected output is not a guaranteed fill.</p><label className="op-check"><input type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />I have reviewed the coin address, amount and fees.</label><button className="op-primary" disabled={!reviewed || expired || !!busy || !state.trading || !state.signerConfigured} onClick={() => void execute()}><Check size={17} />{busy === 'execute' ? 'Submitting...' : 'Confirm trade'}</button></section>}
      </section>
      <section className="op-positions"><div className="op-section-title"><h2>Open Positions</h2><span>{positions.length}</span></div>{positions.length ? <div className="op-position-list">
        {positions.map(position => <article key={position.mint}>
          <div className="op-position-name"><strong>{position.symbol || position.name || shortened(position.mint)}</strong><button className="op-icon" type="button" title="Edit position thesis" aria-label={`Edit thesis for ${position.symbol || 'coin'}`} disabled={!!busy} onClick={() => { invalidate(); setMint(position.mint); setToken(null); setThesis(position.thesis); setSide('sell'); setAmount(''); document.getElementById('op-thesis')?.focus(); }}><Pencil size={16} /></button></div>
          <code>{shortened(position.mint)}</code><dl><div><dt>Held</dt><dd>{number(position.amount)}</dd></div><div><dt>Indicative price</dt><dd>{usd(position.priceUsd)}</dd></div><div><dt>Indicative value</dt><dd>{usd(position.valueUsd)}</dd></div></dl><p>{position.thesis || 'No thesis saved.'}</p>
        </article>)}
      </div> : <p className="op-empty">{state.tracking ? 'No token positions in the returned wallet data.' : 'Wallet tracking is disabled.'}</p>}<p className="op-fine">Helius USD marks update hourly. Live execution price and P&amp;L are not supplied.{state.feed?.holdingsTruncated ? ' More holdings exist beyond this page.' : ''}</p></section></div>
      <section className="op-activity"><h2>Order Activity</h2>{state.orders.length ? <div className="op-table-wrap"><table><thead><tr><th>Time</th><th>Coin</th><th>Side</th><th>Amount</th><th>Status</th><th>Receipt</th></tr></thead><tbody>{state.orders.map(order => <tr key={order.id}><td>{new Date(order.created_at).toLocaleTimeString()}</td><td title={order.mint}>{order.symbol || shortened(order.mint)}</td><td>{order.side}</td><td>{order.amount} {order.side === 'buy' ? 'SOL' : order.symbol || 'tokens'}</td><td>{order.status === 'prepared' ? 'Quoted' : order.status}</td><td>{order.signature ? <a href={`https://solscan.io/tx/${order.signature}`} target="_blank" rel="noreferrer" aria-label="Open transaction receipt"><ExternalLink size={16} /></a> : '-'}</td></tr>)}</tbody></table></div> : <p className="op-empty">No orders recorded.</p>}</section>
    </>}
    {error && <p className="op-error" role="alert">{error}</p>}{message && <p className="op-success" role="status">{message}</p>}
  </main>;
}
