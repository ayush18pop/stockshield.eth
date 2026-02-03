---
name: Web3 DeFi Frontend
description: "Midnight Glass" Config for Web3 Wallets
---

# Web3 DeFi Frontend (WANTEX Edition)

## RainbowKit "Midnight" Theme

The default RainbowKit dark mode is too gray. We need "Deep Void" black.

```tsx
// lib/rainbowkit-theme.ts
import { merge } from 'lodash';
import { darkTheme, Theme } from '@rainbow-me/rainbowkit';

export const midnightTheme = merge(darkTheme(), {
  colors: {
    accentColor: '#FF4D00',         // Voltage Orange
    accentColorForeground: 'white',
    
    // The Void
    connectButtonBackground: '#0A0A0A',
    connectButtonInnerBackground: '#0A0A0A',
    modalBackground: '#050505',
    profileAction: '#0A0A0A',
    menuItemBackground: '#0A0A0A',
    
    // Borders
    modalBorder: 'rgba(255, 255, 255, 0.1)',
    generalBorder: 'rgba(255, 255, 255, 0.1)',
    
    // Text
    modalText: '#FFFFFF',
    modalTextSecondary: 'rgba(255, 255, 255, 0.6)',
  },
  radii: {
    actionButton: '2px', // Sharper corners for Brutalism
    connectButton: '2px',
    modal: '4px',
    modalMobile: '4px',
  },
  fonts: {
    body: 'var(--font-inter)',
  }
} as Theme);
```

## Wallet Button Component

Style the Connect Button to match the "Primary Button" (Orange or Glass).

```tsx
// components/web3/CustomConnect.tsx
<ConnectButton.Custom>
  {({ openConnectModal, mounted }) => (
    <button 
      onClick={openConnectModal}
      className="
        border border-white/10 bg-white/5 backdrop-blur-md 
        px-6 py-2 text-sm font-mono uppercase tracking-wider 
        hover:bg-[#FF4D00] hover:border-[#FF4D00] hover:text-white
        transition-all duration-300
      "
    >
      {mounted ? 'Connected' : 'Connect Wallet'}
    </button>
  )}
</ConnectButton.Custom>
```
