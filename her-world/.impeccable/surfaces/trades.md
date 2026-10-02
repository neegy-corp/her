---
version: 1
slug: "trades"
primary_target: "components/trades-panel.tsx"
related_targets: ["components/trades-panel.css", "app/page.tsx", "components/operator-panel.tsx", "app/operator/[key]/operator.css"]
---

# HER Trades

## Scope

Built local extension of the established HER homepage, with a related private operator desk. Visitor mode: Operate. Public visitors inspect the project wallet, positions and confirmed trade receipts; the operator prepares an order, reviews its terms and explicitly confirms execution through the backend signer.

This brief records the built surface, not whole-product design authority. The incumbent system is evidenced by `app/page.tsx`, `app/globals.css` and `components/voting.tsx`. No product truth, replacement identity, approved comp or QUALITY BAR card was established for this local addition.

## BUILT

The public Trades section follows voting and precedes the character collection. Public navigation adds Trades, including an accessible icon link on mobile; it exposes no operator entry point.

- Full-width, unframed mint band (`#e6eeea`) uses inherited section spacing, quiet horizontal rules and the existing HER image.
- Fraunces supplies the 48px heading (37px on mobile); Space Grotesk carries labels, controls and tabular numeric data. Local letter spacing is zero.
- Four metrics show total equity, SOL balance, all-time P&L and starting balance. The starting baseline is 3 SOL; all-time P&L awaits verified performance. Metrics form four desktop columns and two columns below 760px.
- Coin rows show logo, ticker and name, with a two-letter image fallback and an external token explorer link. SOL value, average-cost basis and signed SOL/percentage P&L remain distinct.
- Positive P&L is green (`#236345`), negative is red (`#a13e4c`), and null uses neutral `--` with unavailable-basis copy. Realized and unrealized SOL totals sit below the table.
- Open positions, Closed positions and Trade history use underlined tabs with counts; mobile labels are Open, Closed and History.
- Mobile positions preserve Coin, Value and P&L. Holdings move below coin identity; separate holdings and cost-basis columns are hidden. Dense history retains horizontal scrolling.
- Wallet copy, refresh, pagination and external receipts use Lucide icon controls with accessible names and titles. Rows paginate in groups of ten.

The public panel polls while the document is visible and provides manual refresh. It distinguishes Connecting, On-chain, Not connected and Feed unavailable; failed refreshes retain previously checked data and state that it is stale.

## Related Operator Preview

The dedicated private operational desk inherits the canvas (`#f2f5f3`), Space Grotesk, restrained borders and 4px controls. Its 1280px maximum width and two-column ticket/positions layout become a single column below 760px. Desktop type remains compact: 28px page title and 18px section titles.

- Authenticated workspace shows wallet, feed status, update interval, signer readiness and trading enabled/disabled state.
- Buy/Sell segmented controls lead to coin lookup, amount, slippage and required position thesis. Icon tools provide refresh, sign out, lookup and thesis editing.
- Prepared quotes expose contract address, spend/sell amount, expected receive, slippage, fee and expiry. A review checkbox precedes Confirm trade.
- Relevant input edits invalidate the prepared quote. Expired, unreviewed, busy, trading-disabled or signer-unconfigured orders cannot be confirmed. Signing belongs to the backend; this desk has no browser wallet-signing step.
- Preview mode disables thesis persistence; preparation and confirmation are gated by trading and signer readiness. Current preview has trading disabled. No live trading is established by this visual brief.
- Operator positions show held amount, indicative USD marks and thesis. Order Activity keeps its dense table horizontally scrollable on narrow screens.

## States And Semantics

Unconnected public data keeps the 3 SOL baseline visible while unknown balances and P&L remain null. Empty Open, Closed and History views have distinct copy. Missing price, cost basis, incomplete history, unsupported activity or unverified initial funding must remain visibly unavailable rather than becoming zero performance.

Operator loading, retry, login, unconfigured authentication, tracking disabled, empty positions/orders, submitted/unconfirmed execution, quote expiry, alert and success states are present. Indicative USD marks do not claim execution price or operator P&L.

Public metrics use a definition list; positions and activity use semantic tables. Tabs expose selected state, controlled panel and arrow/Home/End keyboard navigation. Inputs have associated labels; busy fields are disabled; status and error messages use status/alert semantics. Controls preserve focus-visible treatment, long values wrap, and reduced-motion settings stop the refresh animation.

## Evidence And Limits

Implementation truth: `components/trades-panel.tsx`, `components/trades-panel.css`, `components/operator-panel.tsx`, `app/operator/[key]/operator.css`; the 3 SOL/null snapshot contract is in `lib/trades-types.ts`.

The supplied fresh review disposition is **ship**, limited to extension visual/UX scope. The supplied detector result is `[]`. Twelve validated captures are recorded under `.impeccable/review/`: homepage `desktop.png`/`mobile.png`, plus desktop/mobile pairs for `trades`, `trades-paused`, `trades-history`, `operator` and `operator-paused`.

Populated local fixture data demonstrates layout and states; it is not production wallet data. This document makes no deployment, funding, authentication-security, accounting-completeness or live-execution approval. Keep credentials, private route values and signer material out of documentation and public navigation.
