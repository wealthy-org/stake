import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { robinhoodTestnet, robinhoodMainnet } from "./chains";

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet, robinhoodMainnet],
  connectors: [injected()],
  transports: {
    [robinhoodTestnet.id]: http(),
    [robinhoodMainnet.id]: http(),
  },
  ssr: true,
});
