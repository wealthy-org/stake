# Stake rebrand — design/color/text pass

## Context

The product is renaming from "Paper Bet" to "Stake". The user supplied a
reference landing page (`19/stake-landing (1).html`) and a brand logo
(`19/logo.jpeg`, a bold black "Stake" wordmark on lime-green) that together
define the new visual identity: a "racing form / tote board betting ticket"
aesthetic — off-white paper background, near-black ink, a single sharp lime
accent, Archivo (variable-width display type) + IBM Plex Mono.

This is step 1 of 3 agreed with the user (priority order: rebrand first,
then a new public landing+login flow, then Polymarket-style polish of the
market pages). This spec covers **only** the rebrand: design tokens,
typography, and brand/token-name text, applied to the app's existing pages
and components. It does not rebuild any component's structure, does not
touch the Solidity contracts, and does not create the new landing/login IA.

## Decisions

- **Display names vs. internal identifiers are separate.** User-visible text
  changes ("Paper Bet" → "Stake", "PAPER" → "STAKE" as a token label).
  Internal identifiers that are costly to rename and carry no user-visible
  meaning stay as-is: DB table `paper_ledger`, DB columns
  (`paper_minted`, `paper_total_minted`, etc.), API route paths
  (`/api/paper`, `/api/markets/:id/claim-paper`), Next.js route folder
  `app/paper/` (its exported page content changes to say "Stake", the URL
  does not), helper names (`paperToNumber`, `PaperSummary` type, etc.).
  Rationale: this is a cosmetic pass; renaming working, tested identifiers
  adds risk with no user-facing benefit. If the URL `/stake` is wanted
  later, that's a separate, larger change (redirects, nav links, etc.).
- **Solidity contracts are out of scope for this pass.** `PaperToken.sol`
  hardcodes `ERC20("Paper", "PAPER")` in its constructor; changing the
  on-chain name/symbol requires redeploying the whole already-deployed
  testnet stack (PaperToken → EmissionController → Factory, each
  immutably referencing the previous). This is tracked as a known
  follow-up, not executed now.
- **Dark mode keeps its current structural pattern** (a dark "desk"
  background behind a paper-colored sheet that stays light in both themes)
  — only the specific color values swap to the new palette's dark-mode
  equivalents. No new dark-mode design from scratch.
- **No new components.** The tote-board split-flap display, torn ticket
  receipts, and rubber stamps from the reference HTML are visual language
  for the later "Polymarket-style polish" pass, not built here. This pass
  re-themes the *existing* Board/Market/Portfolio/PAPER/Activity/Stats/Proof
  pages and components in place.

## Design tokens

Replace the `:root` custom properties in `app/globals.css` (and their
dark-mode overrides) with the Stake palette, keeping the same custom
property *names* already used in the codebase so no component CSS needs
rewriting — only values change:

```
--paper   -> #ECEDE7  (replaces --sheet; light-mode sheet background)
--paper-2 -> #E2E3DC  (replaces current secondary; hover/zebra rows)
--ticket  -> #FAFAF6  (replaces --slip; card/ticket background)
--ink     -> #121310  (primary text/ink)
--ink-2   -> #575951, --ink-3 -> #8B8D84 (secondary/tertiary text — reuse existing two-tier gray pattern)
--rule    -> #C6C8BE  (hairline borders, replaces current --line)
--lime    -> #CFF23A  (single accent color, replaces --gold / --biro's accent role)
```

Typography:
- `--display`: `'Archivo', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif` (replaces Big Shoulders Display). Load via the same Google Fonts `<link>` pattern already in `app/layout.tsx`, with the variable axis `wdth,wght@62..125,400..900` so headings can use `font-stretch` for the condensed look the reference HTML uses.
- `--type` (mono): `'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace` (replaces Courier Prime).
- `--body`: keep Schibsted Grotesk — the reference HTML doesn't use a separate body font family (Archivo covers both display and body there), but swapping body text too is a bigger typographic change than "rebrand colors + token"; keeping a clean, neutral body face avoids every paragraph becoming a condensed display font, which would hurt readability. Flag this as a deliberate deviation from the reference for review.

Dark mode: derive dark equivalents the same way the current CSS does (desk
background goes dark navy-to-near-black, sheet/ticket stay light,
`--lime` stays the same lime in both modes since it already contrasts on
both light ink and dark board backgrounds in the reference design).

## Text changes

Sitewide find-and-replace of user-facing copy only:
- "Paper Bet" → "Stake" (header brand mark, `<title>`, meta description, footer disclaimers, any page copy that names the product)
- "PAPER" as a token label (e.g. "PAPER created", "Claim PAPER", "PAPER balance", the `/paper` page's own headline content) → "STAKE" / "$STAKE" per the reference HTML's voice ("Your call. Your stake.")
- Tagline updates where the homepage currently says "Win the bet. Lose into ownership." — keep this (it's the brief's own thesis and still accurate), but the reference's secondary line "A loss stays a loss. Tokens aren't a refund." is a good addition to carry over verbatim since it reinforces brief §66's anti-misleading-copy rule.

Files expected to need text edits: `app/layout.tsx` (metadata, footer),
`components/Header.tsx` (brand mark), `app/page.tsx` (hero copy, facts
labels), `app/paper/page.tsx` (headline, ledger labels), `app/portfolio/page.tsx`,
`app/market/[id]/page.tsx`, `app/activity/page.tsx`, `app/stats/page.tsx`,
`app/proof/[id]/page.tsx`, `components/ResultSlip.tsx`, `components/TradePanel.tsx`
— anywhere the literal strings "Paper Bet" or "PAPER" currently appear as
user-facing text (not as an identifier).

## Verification

- `npm run build` succeeds with no new TypeScript errors.
- Visual spot-check in dev (`npm run dev`) on Board, a market detail page,
  Portfolio, the `/paper` (now "Stake supply") page, and both light/dark
  theme states — confirm the new palette reads correctly (lime accent
  visible on both light paper and dark desk backgrounds, no leftover
  gold/olive tones).
- Grep for leftover literal "Paper Bet" / standalone "PAPER" token-label
  strings after the edit pass to make sure none were missed outside the
  intentionally-unchanged internal identifiers.
