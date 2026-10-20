# Stake Rebrand (colors, fonts, copy) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-theme the existing Paper Bet app to the "Stake" visual identity (paper/ink/lime palette, Archivo + IBM Plex Mono typography) and rename all user-facing "Paper Bet"/"PAPER" copy to "Stake"/"STAKE", without touching internal identifiers, API routes, DB schema, or Solidity contracts.

**Architecture:** This is a CSS custom-property + font-stack swap in `app/globals.css` and `app/layout.tsx`, plus a literal-string copy pass across the existing page/component files. No new components, no new routes, no logic changes. Verification is build success + a grep sweep for leftover old strings (there are no unit tests to write — this task has no new behavior to test, only visuals and copy).

**Tech Stack:** Next.js App Router, plain CSS custom properties (no CSS-in-JS), Google Fonts (Archivo, IBM Plex Mono).

## Global Constraints

- Internal identifiers stay as-is: DB table `paper_ledger`, DB columns (`paper_minted`, `paper_total_minted`, `cumulative_paper_minted`, etc.), API routes (`/api/paper`, `/api/markets/:id/claim-paper`), the Next.js route folder `app/paper/` (URL path unchanged), helper/type names (`paperToNumber`, `PaperSummary`, etc.). Only user-visible text and visual tokens change.
- Solidity contracts (`contracts/src/PaperToken.sol` and everything referencing it) are explicitly out of scope — do not edit anything under `contracts/`.
- `--lime: #CFF23A` is the single accent color in both light and dark mode (per spec, it already contrasts on both light ink and dark board backgrounds).
- Body copy font stays Schibsted Grotesk (`--body`), not Archivo — only `--display` (headings) and `--type` (mono/labels) change. This is a deliberate deviation from the reference HTML, documented in the spec.
- After this plan, `npm run build` must succeed with zero new TypeScript errors, and a case-sensitive grep for the literal strings `Paper Bet` and standalone `PAPER` (as a token label, not as part of an unrelated identifier) across `app/` and `components/` must return nothing.

---

### Task 1: Swap color and font tokens in `app/globals.css`

**Files:**
- Modify: `app/globals.css` (the `:root` block and its `@media (prefers-color-scheme:dark)` / `:root[data-theme="dark"]` overrides, near the top of the file)

**Interfaces:**
- Consumes: nothing (pure CSS token values).
- Produces: the custom properties `--sheet`, `--slip`, `--line`, `--ink`, `--ink2`, `--ink3`, `--gold`, `--gold-d`, `--display`, `--type` keep their existing *names* (every component already references these) but get new *values*. Later tasks (copy edits) do not depend on this task's output; this task can be done independently and verified on its own by loading any page.

- [ ] **Step 1: Read the current `:root` block to get exact current values and line numbers**

Run: `grep -n "^:root\|--sheet\|--slip\|--line:\|--ink\b\|--ink2\|--ink3\|--gold\|--display:\|--type:" app/globals.css | head -40`

Note the exact line ranges for the light-mode `:root{...}` block and the dark-mode override block(s) before editing, since the file uses long single-line rule blocks.

- [ ] **Step 2: Replace the light-mode token values**

In the light-mode `:root{...}` rule, change these values (keep every other property name exactly as found):

```
--sheet: #ECEDE7;
--line: #C6C8BE;
--slip: #FAFAF6;
--ink: #121310;
--ink2: #575951;
--ink3: #8B8D84;
--gold: #CFF23A;
--gold-d: #121310;
```

(`--gold-d` becomes the same near-black as `--ink` — the reference design has no separate "dark gold" tone; anywhere `--gold-d` is used for text-on-light it should now read as ink-black, which matches the reference's stamp/ledger styling where accent text is black, not a tinted variant of the lime.)

Change the font custom properties:

```
--display: 'Archivo', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
--type: 'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
```

Leave `--body` untouched (stays Schibsted Grotesk per the Global Constraints above).

- [ ] **Step 3: Replace the dark-mode token values**

In the dark-mode override block(s) (`@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){...}}` and `:root[data-theme="dark"]{...}`), change the same property names to their dark-mode equivalents:

```
--sheet: #ECEDE7;   /* sheet/ticket stays light even in dark mode, same as current pattern */
--line: #C6C8BE;
--slip: #FAFAF6;
--gold: #CFF23A;     /* lime stays identical in both modes */
--gold-d: #121310;
```

Do not change whatever dark "desk" background custom property already exists (e.g. `--desk`) — that one isn't part of this palette swap, it already provides the dark surround and doesn't need a new value for this task.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev`, open `http://localhost:3000`. Confirm: the page background is off-white (not olive-green), headings/body text are near-black, and any element that used to be gold/olive-accent (stats numbers, active nav tab, etc.) now renders lime-green. Toggle dark mode (if there's a toggle) or use OS dark mode and confirm the lime accent is still visibly lime, not washed out.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "Rebrand: swap color/font tokens from ledger palette to Stake (paper/ink/lime)"
```

---

### Task 2: Update fonts and metadata in `app/layout.tsx`

**Files:**
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing other tasks depend on; independently verifiable.

- [ ] **Step 1: Read the current font `<link>` tags and metadata**

Run: `grep -n "fonts.googleapis\|title:\|description:" app/layout.tsx`

- [ ] **Step 2: Replace the Google Fonts `<link>` href**

Find the `<link href="https://fonts.googleapis.com/css2?family=...">` tag and replace its `family` query parameters so it loads Archivo (variable width+weight) and IBM Plex Mono, keeping whatever body-font family parameter is already there (Schibsted Grotesk) untouched:

```
https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap
```

(Keep the existing `Schibsted+Grotesk` family parameters exactly as currently written if they differ from the snippet above — only swap out whatever the display/mono families currently are for Archivo and IBM Plex Mono.)

- [ ] **Step 3: Update `metadata`**

Change the `title` to `"Stake"` and the `description` to something matching the reference HTML's voice, e.g.:

```ts
export const metadata = {
  title: "Stake",
  description: "Stake. Back your view. Winners take the pool. Verified net losses earn protocol tokens.",
};
```

- [ ] **Step 4: Update the footer disclaimer copy in the same file**

Find the `<footer>` block's `<p>` text(s). Replace any occurrence of "Paper Bet" with "Stake". Example — if the current text reads:

```
Paper Bet is a backend-logic preview on Robinhood Chain Testnet. ...
```

change it to:

```
Stake is a backend-logic preview on Robinhood Chain Testnet. ...
```

Keep the rest of the sentence (testnet/virtual-balance disclaimers) unchanged — only the product name swaps.

- [ ] **Step 5: Verify**

Run: `npm run build`. Expected: build succeeds. Open the dev server, check the browser tab title reads "Stake" and the footer says "Stake" instead of "Paper Bet".

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx
git commit -m "Rebrand: Stake fonts, title, and footer copy in root layout"
```

---

### Task 3: Rebrand the header

**Files:**
- Modify: `components/Header.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Find the brand mark markup**

Run: `grep -n "Paper Bet" components/Header.tsx`

- [ ] **Step 2: Replace the visible brand text**

Change the `<Link className="brand" ...>` content from "Paper Bet" to "Stake", and update the `aria-label="Paper Bet home"` to `aria-label="Stake home"`.

- [ ] **Step 3: Verify**

Run: `npm run dev`, confirm the header now reads "Stake" instead of "Paper Bet" on every page.

- [ ] **Step 4: Commit**

```bash
git add components/Header.tsx
git commit -m "Rebrand: header brand mark to Stake"
```

---

### Task 4: Rebrand homepage copy (`app/page.tsx`)

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Find every literal occurrence of "PAPER" and "Paper Bet" used as display copy**

Run: `grep -n "PAPER\|Paper Bet\|paper is created\|How PAPER" app/page.tsx`

- [ ] **Step 2: Replace the stats label**

Change the facts-bar label `<small>PAPER created</small>` to `<small>STAKE created</small>`.

- [ ] **Step 3: Replace the CTA link text**

Change the ghost CTA link text `How PAPER Works` (or equivalent) to `How STAKE Works`, keeping its `href="/paper"` unchanged (internal route path stays the same per the Global Constraints).

- [ ] **Step 4: Replace the secondary thesis line**

In the `.ledger` section (the "If you win / If you lose" two-column block), after the existing "You claim PAPER." statement, change the token word to "STAKE": `You claim STAKE.` Also update the paragraph text below it that explains net loss to say "STAKE" wherever it currently says "PAPER".

- [ ] **Step 5: Add the reference tagline's second line**

Below the hero's lede paragraph (`<p className="lede">...`), the spec calls for carrying over the reference HTML's reinforcing line. Add a new paragraph directly after the existing lede, using the same `className="note"` pattern already used elsewhere in this file for secondary copy:

```tsx
<p className="note" style={{ marginTop: -14, marginBottom: 20 }}>
  A loss stays a loss. STAKE isn&rsquo;t a refund.
</p>
```

- [ ] **Step 6: Verify**

Run: `npm run build`. Then `npm run dev` and visually confirm the homepage reads "STAKE" instead of "PAPER" everywhere, and the new disclaimer line appears under the hero lede.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx
git commit -m "Rebrand: homepage copy from PAPER/Paper Bet to STAKE/Stake"
```

---

### Task 5: Rebrand the `/paper` genesis page copy

**Files:**
- Modify: `app/paper/page.tsx`

**Interfaces:**
- Consumes: nothing new (the route path and all data-fetching calls — `getPaperSummary`, `getStats`, `listMarkets` — are untouched; only JSX text content changes).
- Produces: nothing other tasks depend on.

- [ ] **Step 1: Find every literal "PAPER" used as display text**

Run: `grep -n "PAPER" app/paper/page.tsx`

- [ ] **Step 2: Replace display copy, keep variable/function names unchanged**

For each JSX text node (not a JS identifier) that reads "PAPER", change it to "STAKE". This includes the `certbig` headline copy (e.g. "PAPER exists only because..." → "STAKE exists only because..."), the emission-rate note text ("PAPER per $1" → "STAKE per $1"), and the "Latest certificates" section's "PAPER" suffix if present. Do NOT rename `PaperSummary`, `getPaperSummary`, `paperToNumber`, or any other identifier — only JSX text.

- [ ] **Step 3: Verify**

Run: `npm run build`, then visually check `http://localhost:3000/paper` reads "STAKE" throughout while still functioning identically (same data, same numbers).

- [ ] **Step 4: Commit**

```bash
git add app/paper/page.tsx
git commit -m "Rebrand: /paper page copy from PAPER to STAKE"
```

---

### Task 6: Rebrand remaining pages and shared components

**Files:**
- Modify: `app/portfolio/page.tsx`
- Modify: `app/market/[id]/page.tsx`
- Modify: `app/activity/page.tsx`
- Modify: `app/stats/page.tsx`
- Modify: `app/proof/[id]/page.tsx`
- Modify: `app/admin/new-market/page.tsx`
- Modify: `components/ResultSlip.tsx`
- Modify: `components/TradePanel.tsx`
- Modify: `components/MarketRow.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing other tasks depend on. This is the last text-only task; after it, no literal "PAPER"/"Paper Bet" user-facing strings should remain.

- [ ] **Step 1: Find every remaining literal occurrence across these files**

Run: `grep -n "PAPER\|Paper Bet" app/portfolio/page.tsx app/market/\[id\]/page.tsx app/activity/page.tsx app/stats/page.tsx app/proof/\[id\]/page.tsx app/admin/new-market/page.tsx components/ResultSlip.tsx components/TradePanel.tsx components/MarketRow.tsx`

- [ ] **Step 2: Replace each JSX text occurrence with "STAKE" (or "Stake" where it's the product name, not the token label)**

Go file by file through the grep output. Typical spots to expect, based on each file's known content:
- `components/ResultSlip.tsx`: the `<small>PAPER certificate</small>` label and the claim button's PAPER-related toast/text.
- `components/TradePanel.tsx`: the `<span>PAPER on that loss</span>` label.
- `app/portfolio/page.tsx`: the `<small>PAPER balance</small>` summary tile label.
- `app/activity/page.tsx`: the `LABEL` map's `"PAPER minted"` string and the `describe()` function's `"PAPER minted from a..."` template text.
- `app/stats/page.tsx`: the `<small>PAPER created</small>` facts-bar label (same pattern as Task 4's homepage edit).
- `app/market/[id]/page.tsx`, `app/proof/[id]/page.tsx`, `app/admin/new-market/page.tsx`: check the grep output for this file specifically — if nothing matches, no edit needed here.

In every case, change only the JSX string literal; leave prop names, variable names, and imported function/type names exactly as they are.

- [ ] **Step 3: Verify nothing was missed**

Run: `grep -rn "PAPER\|Paper Bet" app components --include="*.tsx" --include="*.ts"`

Expected: no matches, OR matches only inside identifier names that are explicitly out of scope per the Global Constraints (e.g. `paperToNumber`, `PaperSummary`, `claim-paper`, `paper_ledger`). If a match is a JSX text string, go back and fix it.

- [ ] **Step 4: Full build and manual pass**

Run: `npm run build`. Expected: succeeds, no new TypeScript errors.

Run: `npm run dev`. Visit `/`, `/market/<any existing market id>`, `/portfolio`, `/paper`, `/activity`, `/stats`, `/proof/<any resolved market id>`, `/admin/new-market`. Confirm every page now reads "STAKE"/"Stake" instead of "PAPER"/"Paper Bet", and that the new lime/paper/ink palette from Task 1 is visible throughout (not just on the homepage).

- [ ] **Step 5: Commit**

```bash
git add app/portfolio/page.tsx "app/market/[id]/page.tsx" app/activity/page.tsx app/stats/page.tsx "app/proof/[id]/page.tsx" app/admin/new-market/page.tsx components/ResultSlip.tsx components/TradePanel.tsx components/MarketRow.tsx
git commit -m "Rebrand: remaining pages and components from PAPER/Paper Bet to STAKE/Stake"
```

---

## Explicitly deferred (not part of this plan)

- Rebuilding components to match the reference HTML's tote-board/ticket/stamp visual language — that's the later "Polymarket-style polish" sub-project.
- A new public landing page + login/launch-app flow — separate sub-project, not started here.
- Renaming the Solidity `PaperToken` contract (name/symbol) and redeploying the testnet stack — tracked as a known follow-up requiring the deployer wallet again.
- Changing the `/paper` URL to `/stake` or renaming any DB/API identifiers — only do this later if explicitly requested, as its own small plan (it touches routing and any hardcoded links to `/paper`).
