import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { robinhoodTestnet, robinhoodMainnet } from "./chains";

export const wagmiConfig = createConfig({
  chains: [robinhoodMainnet, robinhoodTestnet],
  connectors: [injected()],
  transports: {
    [robinhoodMainnet.id]: http(),
    [robinhoodTestnet.id]: http(),
  },
  ssr: true,
});
