// walletConfig.ts
import { createConfig, http } from 'wagmi';
import { polygon, polygonAmoy } from 'wagmi/chains';
import { walletConnect, injected, metaMask } from 'wagmi/connectors';

// WalletConnect Project ID (get from https://cloud.walletconnect.com)
const projectId = 'RateCaster'; 

// Configure Wagmi with Polygon chain
export const wagmiConfig = createConfig({
  chains: [polygon],
  transports: {
    [polygon.id]: http('https://polygon-rpc.com'),
  },
  connectors: [
    injected({ target: 'rainbow' }), // Prioritize Rainbow Wallet
    metaMask(), // Fallback to MetaMask
    walletConnect({ projectId }), // WalletConnect for mobile/other wallets
  ],
});

// Export chains for RainbowKitProvider
export const supportedChains = [polygon, polygonAmoy];