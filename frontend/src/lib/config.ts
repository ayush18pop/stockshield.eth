import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, polygon, optimism, arbitrum, base } from 'wagmi/chains';

// RainbowKit + Wagmi v2 configuration
// Using getDefaultConfig which handles all the complexity internally
export const config = getDefaultConfig({
    appName: 'StockShield',
    // Get a free projectId at https://cloud.walletconnect.com
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
    chains: [mainnet, polygon, optimism, arbitrum, base],
    ssr: true, // Required for Next.js App Router
});
