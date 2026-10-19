/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `pg` has a conditional `require('fs')` that webpack's edge-runtime
  // compile pass of instrumentation.ts can't resolve statically, which
  // breaks every route with a 500 even though pg is never actually invoked
  // under the edge runtime. Keeping it external skips bundling it entirely.
  serverExternalPackages: ["pg"],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@base-org/account": false,
      "@coinbase/wallet-sdk": false,
      "@metamask/connect-evm": false,
      "@safe-global/safe-apps-sdk": false,
      "@safe-global/safe-apps-provider": false,
      "@walletconnect/ethereum-provider": false,
      accounts: false,
    };
    return config;
  },
};

export default nextConfig;
