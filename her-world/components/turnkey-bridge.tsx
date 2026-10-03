"use client";
import { ClientState, TurnkeyProvider, useTurnkey, type TurnkeyProviderConfig } from '@turnkey/react-wallet-kit';
import type { WalletAccount, WalletProvider } from '@turnkey/core';
import { useEffect, useMemo, useRef, useState } from 'react';
import bs58 from 'bs58';
import { api, type WalletBridge } from './wallet';
import type { PublicConfig } from '@/lib/catalog';
import '@turnkey/react-wallet-kit/styles.css';

type Props = { config: PublicConfig; onReady: (bridge: WalletBridge) => void; onConnected: () => Promise<void>; onError: (message: string) => void };

export default function Bridge(props: Props) {
  const config = useMemo<TurnkeyProviderConfig>(() => ({
    // Native connections use the Turnkey SDK without creating managed wallet accounts.
    organizationId: props.config.turnkeyOrganizationId,
    autoFetchWalletKitConfig: false,
    autoRefreshManagedState: false,
    walletConfig: { features: { auth: false, connecting: true }, chains: { solana: { native: true } } },
    ui: { authModal: { methods: { emailOtpAuthEnabled: false, smsOtpAuthEnabled: false, passkeyAuthEnabled: false,
      walletAuthEnabled: false, googleOauthEnabled: false, appleOauthEnabled: false, facebookOauthEnabled: false,
      xOauthEnabled: false, discordOauthEnabled: false }, methodOrder: [] } },
  }), [props.config.turnkeyOrganizationId]);
  return <TurnkeyProvider config={config} callbacks={{ onError: error => props.onError(error.message) }}><Connector {...props}/></TurnkeyProvider>;
}

function Connector({ onReady, onConnected, onError }: Props) {
  const tk = useTurnkey();
  const account = useRef<WalletAccount | null>(null);
  const provider = useRef<WalletProvider | null>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(tk); latest.current = tk;
  useEffect(() => {
    onReady({
      connect: () => { setError(''); setOpen(true); },
      disconnect: async () => {
        const previous = provider.current;
        account.current = null; provider.current = null;
        if (previous) await latest.current.disconnectWalletAccount(previous);
      },
      signTransaction: async hex => {
        if (!account.current) throw new Error('Reconnect your wallet from wallet activity before burning.');
        return latest.current.signTransaction({ unsignedTransaction: hex, transactionType: 'TRANSACTION_TYPE_SOLANA', walletAccount: account.current });
      },
    });
  }, [onReady]);
  useEffect(() => { if (open) modal.current?.showModal(); else modal.current?.close(); }, [open]);

  async function choose(walletProvider: WalletProvider) {
    setBusy(true); setError('');
    try {
      const connected = await tk.connectWalletAccount(walletProvider);
      const challenge = await api<{ id: string; message: string }>('challenge', { wallet: connected.address });
      const signed = await tk.signMessage({ message: challenge.message, walletAccount: connected,
        encoding: 'PAYLOAD_ENCODING_TEXT_UTF8', hashFunction: 'HASH_FUNCTION_NO_OP' });
      const hex = signed.r.replace(/^0x/, '') + signed.s.replace(/^0x/, '');
      if (!/^[a-f0-9]{128}$/i.test(hex)) throw new Error('The wallet returned an invalid signature.');
      const signature = bs58.encode(Uint8Array.from(hex.match(/.{2}/g)!.map(part => parseInt(part, 16))));
      await api('signin', { id: challenge.id, wallet: connected.address, signature });
      account.current = connected; provider.current = walletProvider;
      await onConnected(); setOpen(false);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : 'Wallet connection was cancelled.';
      setError(message); onError(message);
    } finally { setBusy(false); }
  }
  const providers = tk.walletProviders.filter(p => String(p.chainInfo.namespace).toLowerCase().includes('solana'));
  return <dialog ref={modal} className="wallet-dialog" onCancel={() => setOpen(false)} aria-label="Connect wallet">
    <button className="close" onClick={() => setOpen(false)} aria-label="Close wallet dialog">×</button>
    <span className="eyebrow">POWERED BY TURNKEY</span><h2>Your wallet.<br/>Your place in ACP.</h2>
    <p>Connect a Solana wallet and sign a message to verify ownership. No email. No transaction.</p>
    {tk.clientState !== ClientState.Ready ? <p role="status">Loading wallet connections…</p> : providers.length ?
      providers.map(p => <button className="wallet-choice" key={p.info.name} disabled={busy} onClick={() => void choose(p)}>{busy ? 'Waiting for wallet…' : p.info.name}</button>) :
      <div className="inline-note"><strong>No Solana wallet detected.</strong><p>Open HER in your Phantom or Solflare app’s browser, or enable a Solana wallet extension in your browser.</p><a href="https://phantom.com/download" target="_blank" rel="noreferrer">Get Phantom ↗</a></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </dialog>;
}
