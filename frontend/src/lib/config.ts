import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, optimism, arbitrum, base, sepolia } from 'wagmi/chains';

// RainbowKit + Wagmi v2 configuration
// Using getDefaultConfig which handles all the complexity internally
export const config = getDefaultConfig({
    appName: 'StockShield',
    // Get a free projectId at https://cloud.walletconnect.com
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    // Sepolia FIRST for demo purposes - judges will see it as default
    chains: [sepolia, mainnet, polygon, optimism, arbitrum, base],
    ssr: true, // Required for Next.js App Router
});
