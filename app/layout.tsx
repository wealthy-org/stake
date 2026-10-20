import "./globals.css";
import { AppProviders } from "@/components/providers";

export const metadata = {
  title: "Stake",
  description: "Stake. Back your view. Winners take the pool. Verified net losses earn protocol tokens.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Deliberately no <Header/>, .wrap/.sheet shell, or footer here — the public
// landing page (app/page.tsx) and the app shell (app/app/layout.tsx) each
// have their own chrome, since the landing page isn't styled as a "desk +
// sheet" app screen.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;500&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
