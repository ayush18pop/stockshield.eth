'use client';

// IMPORTANT: This file MUST be a Client Component because:
// 1. RainbowKit uses React Context (useContext)
// 2. Wagmi uses React state and effects
// 3. QueryClient creates client-side state
// Server Components cannot use any of these React hooks.

import * as React from 'react';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { config } from '@/lib/config';

// CSS import MUST be in a Client Component to avoid SSR issues
import '@rainbow-me/rainbowkit/styles.css';

// Create QueryClient outside component to prevent recreation on re-renders
const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WagmiProvider config={config}>
            <QueryClientProvider client={queryClient}>
                <RainbowKitProvider
                    theme={darkTheme({
                        accentColor: '#FF4D00',
                        accentColorForeground: 'white',
                        borderRadius: 'medium',
                        fontStack: 'system',
                    })}
                >
                    {children}
                </RainbowKitProvider>
            </QueryClientProvider>
        </WagmiProvider>
    );
}
