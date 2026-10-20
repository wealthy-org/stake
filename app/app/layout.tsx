import Header from "@/components/Header";

// App shell for everything under /app/* — the Header, the "desk + sheet"
// chrome, and the app's own footer disclaimer. The public landing page at
// app/page.tsx does not use this layout; it has its own minimal chrome.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <div className="wrap">
        <main className="sheet">{children}</main>
      </div>
      <footer>
        <div className="wrap">
          <p>
            Stake is a backend-logic preview on Robinhood Chain Testnet. Every balance here is a
            virtual testnet balance — no real funds move yet. You can lose your entire stake, and pool
            share is not a probability.
          </p>
          <p>Settlement price comes from Binance spot data for this phase. Payouts come only from the losing pool.</p>
        </div>
      </footer>
    </>
  );
}
