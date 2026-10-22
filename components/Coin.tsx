const COINS: Record<string, JSX.Element> = {
  ETH: (
    <svg viewBox="0 0 24 24">
      <path d="M12 2l6.5 10.2L12 16 5.5 12.2z" fill="#5C6BC0" />
      <path d="M12 17.2l6.5-4.2L12 22 5.5 13z" fill="#8C9AE8" />
    </svg>
  ),
  BTC: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#F7931A" />
      <path
        d="M9.2 7.4h3.4c1.5 0 2.4.7 2.4 1.9 0 .9-.5 1.5-1.3 1.8 1 .2 1.7.9 1.7 2 0 1.4-1.1 2.2-2.8 2.2H9.2zm1.5 3h1.6c.7 0 1.1-.3 1.1-.9s-.4-.9-1.1-.9h-1.6zm0 3.4h1.8c.8 0 1.2-.3 1.2-1s-.5-1-1.2-1h-1.8z"
        fill="#fff"
      />
    </svg>
  ),
  SOL: (
    <svg viewBox="0 0 24 24">
      <path d="M6 6.5h13l-2 2.6H4zM6 10.7h13l-2 2.6H4zM6 14.9h13l-2 2.6H4z" fill="#14B8A6" />
    </svg>
  ),
  NVDA: (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" rx="12" fill="#76B900" />
      <path
        d="M6.5 12c0-2.8 2.2-5 5-5 2.2 0 4.1 1.4 4.8 3.4-.6-.4-1.4-.7-2.3-.7-2 0-3.6 1.6-3.6 3.6s1.6 3.6 3.6 3.6c.9 0 1.7-.3 2.3-.7-.7 2-2.6 3.4-4.8 3.4-2.8 0-5-2.2-5-5z"
        fill="#ffffff"
      />
    </svg>
  ),
  AAPL: (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" rx="12" fill="#1e293b" />
      <path
        d="M15.5 12.2c0-2 1.6-3 1.7-3.1-1-.1.4-2.4-.8-2.9-.6-.2-1.6.2-2.5.2-.8 0-1.6-.2-2.3-.2-1.6 0-3.1 1-3.9 2.4-1.7 3-.4 7.4 1.2 9.8.8 1.2 1.8 2.5 3 2.4 1.2-.1 1.7-.8 3.1-.8 1.4 0 1.9.8 3.2.7 1.3-.1 2.2-1.2 3-2.4.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.5-1-2.5-3.3zM14.2 7.8c.6-.8 1-1.9.9-3-.9.1-2 .6-2.6 1.4-.6.7-1 1.8-.9 2.9 1 0 2-.5 2.6-1.3z"
        fill="#ffffff"
      />
    </svg>
  ),
  TSLA: (
    <svg viewBox="0 0 24 24">
      <rect width="24" height="24" rx="12" fill="#E82127" />
      <path
        d="M12 8.5c2 0 4 .5 5.5 1.5l1-2C16.5 6.7 14.3 6 12 6s-4.5.7-6.5 2l1 2c1.5-1 3.5-1.5 5.5-1.5zm0 2.5c-1.8 0-3.5.5-4.8 1.3l.8 2.2c1.2-.7 2.6-1 4-1s2.8.3 4 1l.8-2.2c-1.3-.8-3-1.3-4.8-1.3zM12 14v4h1v-4h-1z"
        fill="#ffffff"
      />
    </svg>
  ),
  // Polymarket-sourced launch categories — each gets a distinct icon +
  // color so the Trending list reads at a glance instead of falling into
  // the identical gray "first-3-letters" fallback circle.
  CRYPTO: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#F2A900" />
      <text x="12" y="16.5" textAnchor="middle" fill="#7A4E00" fontSize="12" fontWeight="800">
        ₿
      </text>
    </svg>
  ),
  FINANCE: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#1FA96B" />
      <path d="M7 15.5l3-3.3 2.4 2 4.1-5" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.8 9.2h2.7v2.7" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  GEOPOLITICS: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#2F6FED" />
      <path
        d="M12 3.5a8.5 8.5 0 100 17 8.5 8.5 0 000-17zm0 1.4c1 1 1.7 2.5 2.1 4.1h-4.2c.4-1.6 1.1-3.1 2.1-4.1zm-3.5 4.1H5.3a7.1 7.1 0 013.6-3.2 11 11 0 00-1 3.2zm0 1.4a14 14 0 000 3.2H5.3a7 7 0 010-3.2zm1.4 4.6h4.2c-.4 1.6-1.1 3.1-2.1 4.1-1-1-1.7-2.5-2.1-4.1zm0-1.4a12.6 12.6 0 010-3.2h4.2a12.6 12.6 0 010 3.2zm5.6 1.4h3.2a7.1 7.1 0 01-3.6 3.2c.5-1 .8-2.1 1-3.2zm0-1.4a14 14 0 000-3.2h3.2a7 7 0 010 3.2zm-.4-4.6c-.2-1.1-.5-2.2-1-3.2a7.1 7.1 0 013.6 3.2z"
        fill="#fff"
      />
    </svg>
  ),
  TECH: (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#8B5CF6" />
      <rect x="9" y="9" width="6" height="6" rx="1" fill="none" stroke="#fff" strokeWidth="1.6" />
      <g stroke="#fff" strokeWidth="1.6" strokeLinecap="round">
        <path d="M12 5.5v2M12 16.5v2M5.5 12h2M16.5 12h2" />
      </g>
    </svg>
  ),
};

export default function Coin({ symbol }: { symbol: string }) {
  return <span className="coin" aria-hidden="true">{COINS[symbol] ?? (
    <svg viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="#334155" />
      <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
        {symbol.slice(0, 3)}
      </text>
    </svg>
  )}</span>;
}
