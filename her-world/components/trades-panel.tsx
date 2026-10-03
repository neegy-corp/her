'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Copy, ExternalLink, RefreshCw, Wallet } from 'lucide-react';
import { emptyTrades, type TradePosition, type TradesSnapshot } from '@/lib/trades-types';
import './trades-panel.css';

const short = (value: string) => `${value.slice(0, 5)}...${value.slice(-5)}`;
const amount = (value: number | null, digits = 4) => value === null ? '--' : value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 2 });
const signed = (value: number | null) => value === null ? '--' : `${value > 0 ? '+' : ''}${amount(Math.abs(value) < 0.00005 ? 0 : value)}`;
const quoteValue = (value: number | null, currency: 'USD' | 'USDC' | null) => value === null || !currency ? 'Value unavailable' : currency === 'USDC' ? `${amount(value, 2)} USDC` : value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
const tone = (value: number | null) => value === null || Math.abs(value) < 0.00005 ? '' : value > 0 ? 'tr-positive' : 'tr-negative';
const views = [{ id: 'open', label: 'Open positions', compact: 'Open' }, { id: 'closed', label: 'Closed positions', compact: 'Closed' }, { id: 'activity', label: 'Trade history', compact: 'History' }] as const;
type View = typeof views[number]['id'];

function Coin({ coin }: { coin: { mint: string; name: string; symbol: string; logo: string | null } }) {
  const [failed, setFailed] = useState(false);
  return <div className="tr-coin"><span className="tr-logo">{coin.logo && !failed ? <Image src={coin.logo} unoptimized alt="" width={38} height={38} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span aria-hidden="true">{(coin.symbol || coin.name || coin.mint).slice(0, 2).toUpperCase()}</span>}</span><div><a href={`https://solscan.io/token/${coin.mint}`} target="_blank" rel="noreferrer" title={coin.mint}>{coin.symbol || short(coin.mint)}<ExternalLink size={12} /></a><span title={coin.name || coin.mint}>{coin.name || short(coin.mint)}</span></div></div>;
}
function Pnl({ position }: { position: TradePosition }) {
  return <div className={`tr-pnl ${tone(position.pnlSol)}`}><strong>{signed(position.pnlSol)}{position.pnlSol !== null && <small> SOL</small>}</strong><span>{position.pnlPercent === null ? 'Basis unavailable' : `${position.pnlPercent > 0 ? '+' : ''}${amount(position.pnlPercent, 2)}%`}</span></div>;
}
export default function TradesPanel() {
  const [data, setData] = useState<TradesSnapshot | null>(null), [busy, setBusy] = useState(true), [error, setError] = useState('');
  const [view, setView] = useState<View>('open'), [page, setPage] = useState(0), [copied, setCopied] = useState(false);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/trades', { cache: 'no-store', signal });
      if (!response.ok) throw new Error('Wallet data is temporarily unavailable.');
      const result = await response.json() as TradesSnapshot;
      if (!signal?.aborted) { setData(result); setError(''); }
    } catch (reason) { if (!signal?.aborted) setError(reason instanceof Error ? reason.message : 'Wallet data is temporarily unavailable.'); }
    finally { if (!signal?.aborted) setBusy(false); }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const kickoff = setTimeout(() => void refresh(controller.signal), 0);
    const timer = setInterval(() => { if (document.visibilityState === 'visible') { setBusy(true); void refresh(controller.signal); } }, 60000);
    return () => { controller.abort(); clearTimeout(kickoff); clearInterval(timer); };
  }, [refresh]);
  useEffect(() => { if (!copied) return; const timer = setTimeout(() => setCopied(false), 2000); return () => clearTimeout(timer); }, [copied]);
  const snapshot = data || emptyTrades('paused'), live = snapshot.status === 'live';
  const positions = snapshot.positions.filter(position => view === 'open' ? position.amount > 0 : position.bought && position.amount === 0);
  const entries = view === 'activity' ? snapshot.activity : positions;
  const maxPage = Math.max(0, Math.ceil(entries.length / 10) - 1), activePage = Math.min(page, maxPage);
  const counts = { open: snapshot.positions.filter(row => row.amount > 0).length, closed: snapshot.positions.filter(row => row.bought && row.amount === 0).length, activity: snapshot.activity.length };
  const shownPositions = positions.slice(activePage * 10, activePage * 10 + 10);
  const shownActivity = snapshot.activity.slice(activePage * 10, activePage * 10 + 10);
  const status = error ? 'Feed unavailable' : !data && busy ? 'Connecting' : live ? 'On-chain' : 'Not connected';
  function select(next: View) { setView(next); setPage(0); }
  function manualRefresh() { setBusy(true); void refresh(); }
  return <section className="section trades-section" id="trades" aria-labelledby="trades-heading">
    <div className="tr-heading"><div className="tr-title"><Image src="/images/acp-v2/logo.png" alt="" width={48} height={48} /><h2 id="trades-heading">ACP <em>Trades.</em></h2></div><div className="tr-wallet"><span className={`tr-status ${live && !error ? 'tr-status-live' : ''}`} role="status">{status}</span>{snapshot.wallet ? <div><a href={`https://solscan.io/account/${snapshot.wallet}`} target="_blank" rel="noreferrer" title={snapshot.wallet}>{short(snapshot.wallet)}<ExternalLink size={13} /></a><button className="tr-icon" aria-label={copied ? 'Wallet address copied' : 'Copy wallet address'} title={copied ? 'Copied' : 'Copy wallet address'} onClick={() => { void navigator.clipboard.writeText(snapshot.wallet!).then(() => setCopied(true)).catch(() => setError('Could not copy the address.')); }}><Copy size={15} /></button></div> : <span className="tr-wallet-pending">Project wallet pending</span>}</div></div>
    <dl className="tr-metrics"><div><dt>Total equity</dt><dd>{amount(snapshot.equitySol)}<small> SOL</small></dd><span>{quoteValue(snapshot.equityQuote, snapshot.quoteCurrency)}</span></div><div><dt>SOL balance</dt><dd>{amount(snapshot.solBalance)}<small> SOL</small></dd><span>{snapshot.wrappedSolBalance ? `${amount(snapshot.wrappedSolBalance)} SOL wrapped` : 'Available balance'}</span></div><div className={tone(snapshot.pnlSol)}><dt>All-time P&amp;L</dt><dd>{signed(snapshot.pnlSol)}{snapshot.pnlSol !== null && <small> SOL</small>}</dd><span>{snapshot.pnlPercent === null ? 'Awaiting verified performance' : `${snapshot.pnlPercent > 0 ? '+' : ''}${amount(snapshot.pnlPercent, 2)}% vs. starting capital`}</span></div><div><dt>Starting balance</dt><dd>{amount(snapshot.startingSol, 2)}<small> SOL</small></dd><span>Initial capital</span></div></dl>
    <div className="tr-toolbar"><div role="tablist" aria-label="Wallet activity" className="tr-tabs">{views.map((tab, index) => <button key={tab.id} role="tab" id={`tr-tab-${tab.id}`} aria-label={`${tab.label} ${live ? counts[tab.id] : '--'}`} aria-selected={view === tab.id} aria-controls="tr-content" tabIndex={view === tab.id ? 0 : -1} onClick={() => select(tab.id)} onKeyDown={event => { if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return; event.preventDefault(); const next = event.key === 'Home' ? 0 : event.key === 'End' ? views.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : -1) + views.length) % views.length; select(views[next].id); document.getElementById(`tr-tab-${views[next].id}`)?.focus(); }}><span className="tr-tab-long">{tab.label}</span><span className="tr-tab-short">{tab.compact}</span><span>{live ? counts[tab.id] : '--'}</span></button>)}</div><button className={`tr-icon tr-refresh ${busy ? 'tr-refresh-busy' : ''}`} title="Refresh wallet data" aria-label="Refresh wallet data" disabled={busy} onClick={manualRefresh}><RefreshCw size={18} /></button></div>
    <div id="tr-content" role="tabpanel" aria-labelledby={`tr-tab-${view}`} tabIndex={0} className="tr-content" aria-busy={busy}>
      {entries.length ? <div className="tr-table-scroll"><table className={`tr-table ${view !== 'activity' ? 'tr-position-table' : ''}`}><thead>{view === 'activity' ? <tr><th>Coin</th><th>Side</th><th>Token amount</th><th>SOL flow</th><th>Time</th><th><span className="tr-sr">Receipt</span></th></tr> : <tr><th>Coin</th><th className="tr-holdings">Holdings</th><th>Value</th><th className="tr-cost">Cost basis</th><th>P&amp;L</th></tr>}</thead><tbody>{view === 'activity' ? shownActivity.map(trade => <tr key={trade.signature}><td><Coin coin={trade} /></td><td><span className={`tr-side ${trade.side === 'buy' ? 'tr-positive' : 'tr-negative'}`}>{trade.side === 'buy' ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}{trade.side}</span></td><td>{amount(trade.amount, 6)}</td><td>{trade.side === 'buy' ? '-' : '+'}{amount(trade.solAmount)}<small> SOL</small></td><td><time dateTime={new Date(trade.timestamp).toISOString()} title={new Date(trade.timestamp).toLocaleString()}>{new Date(trade.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</time></td><td><a className="tr-icon" href={`https://solscan.io/tx/${trade.signature}`} target="_blank" rel="noreferrer" aria-label={`View ${trade.side} transaction`} title="View confirmed transaction"><ExternalLink size={16} /></a></td></tr>) : shownPositions.map(position => <tr key={position.mint}><td><Coin coin={position} /><span className="tr-mobile-amount">{amount(position.amount, 6)} tokens</span></td><td className="tr-holdings">{amount(position.amount, 6)}</td><td>{amount(position.valueSol)}{position.valueSol !== null && <small> SOL</small>}</td><td className="tr-cost">{amount(position.costSol)}{position.costSol !== null && <small> SOL</small>}</td><td><Pnl position={position} /></td></tr>)}</tbody></table></div> : <div className="tr-empty"><Wallet size={26} strokeWidth={1.5} /><h3>{error && !data ? 'Wallet feed unavailable.' : !live ? 'Waiting for the first trade.' : view === 'open' ? 'No open positions.' : view === 'closed' ? 'No closed positions yet.' : 'No confirmed trades yet.'}</h3><p>{!live ? 'Starting capital: 3 SOL. Wallet activity is not connected yet.' : 'No activity in this view.'}</p></div>}
    </div>
    {entries.length > 10 && <div className="tr-pagination"><span>{activePage * 10 + 1}-{Math.min(entries.length, (activePage + 1) * 10)} of {entries.length}</span><div><button className="tr-icon" title="Previous page" aria-label="Previous page" disabled={activePage === 0} onClick={() => setPage(activePage - 1)}><ChevronLeft size={18} /></button><button className="tr-icon" title="Next page" aria-label="Next page" disabled={activePage === maxPage} onClick={() => setPage(activePage + 1)}><ChevronRight size={18} /></button></div></div>}
    <div className="tr-foot"><div><span>Realized <strong className={tone(snapshot.realizedSol)}>{signed(snapshot.realizedSol)} SOL</strong></span><span>Unrealized <strong className={tone(snapshot.unrealizedSol)}>{signed(snapshot.unrealizedSol)} SOL</strong></span></div><span>{snapshot.observedAt ? `Checked ${new Date(snapshot.observedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : 'Feed paused'}</span></div>
    {live && <p className="tr-disclosure">Helius gTFA / Average-cost basis / Indicative marks converted to SOL. Fees and rent are included in wallet cash flows.</p>}
    {snapshot.warnings.length > 0 && <p className="tr-data-note">P&amp;L is unavailable where {snapshot.warnings.includes('history_incomplete') ? 'transaction history is incomplete' : snapshot.warnings.includes('unsupported_activity') ? 'wallet activity cannot be fully classified' : snapshot.warnings.includes('prices_missing') ? 'a token price is unavailable' : snapshot.warnings.includes('funding_pending') ? 'the initial 3 SOL funding is not verified' : 'cost basis is unverified'}.</p>}
    {error && <p className="tr-data-note" role="alert">{error}{data && ' Previously checked data is shown.'}</p>}
  </section>;
}
