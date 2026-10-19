import "./globals.css";
import { AppProviders } from "@/components/providers";
import Header from "@/components/Header";

export const metadata = {
  title: "Paper Bet",
  description: "Win the bet. Lose into ownership. A prediction market on Robinhood Chain testnet.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;800&family=Courier+Prime:wght@400;700&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProviders>
          <Header />
          <div className="wrap">
            <main className="sheet">{children}</main>
          </div>
          <footer>
            <div className="wrap">
              <p>
                Paper Bet is a backend-logic preview on Robinhood Chain Testnet. Every balance here is a
                virtual testnet balance — no real funds move yet. You can lose your entire stake, and pool
                share is not a probability.
              </p>
              <p>Settlement price comes from Binance spot data for this phase. Payouts come only from the losing pool.</p>
            </div>
          </footer>
        </AppProviders>
      </body>
    </html>
  );
}
