"use client";

import Header from "@/components/Header";
import { useEffect } from "react";

// App shell for everything under /app/* — the Header, the "desk + sheet"
// chrome, and the app's own footer disclaimer. The public landing page at
// app/page.tsx does not use this layout; it has its own minimal chrome.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    document.body.classList.add("in-app");
    return () => {
      document.body.classList.remove("in-app");
    };
  }, []);

  return (
    <div className="app-shell">
      <Header />
      <div className="app-main-wrap">
        <main className="app-main">{children}</main>
      </div>
    </div>
  );
}
