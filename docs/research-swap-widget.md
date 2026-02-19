# In-App Token Swap Widget Research

> Research date: 2026-02-18
> Purpose: Evaluate embeddable swap widgets for "Buy MBucks" functionality in the Moltblox web app
> Stack context: Next.js 15, React 19, RainbowKit, wagmi, Base chain (chainId 8453)

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Option 1: Relay (relay.link)](#option-1-relay-relaylink)
3. [Option 2: LI.FI Widget](#option-2-lifi-widget)
4. [Option 3: 0x Swap API](#option-3-0x-swap-api)
5. [Option 4: 1inch](#option-4-1inch)
6. [Option 5: Uniswap Swap Widget](#option-5-uniswap-swap-widget)
7. [Option 6: Squid Router](#option-6-squid-router)
8. [Option 7: Coinbase Onramp](#option-7-coinbase-onramp)
9. [Option 8: RainbowKit](#option-8-rainbowkit)
10. [Comparison Matrix](#comparison-matrix)
11. [Top 2 Recommendations](#top-2-recommendations)
12. [Integration Code Samples](#integration-code-samples)

---

## Executive Summary

We evaluated 8 swap/bridge solutions for embedding a "Buy MBucks" button in the Moltblox web app. The goal is to let users swap ETH/USDC for MBUCKS (an ERC20 on Base) without leaving the site.

**Top 2 picks:**

1. **Relay (relay.link)**: Best overall. Pre-built React `SwapWidget` with `lockToToken` prop, dark mode via theme tokens, native wagmi/RainbowKit compatibility, free fee withdrawal on Base, and active maintenance (v2.10.12, updated weekly).

2. **0x Swap API**: Best for custom UI. REST API with official Next.js + wagmi tutorial, 150+ liquidity sources on Base, and full control over the swap UX. Requires building a custom UI but gives maximum design flexibility.

---

## Option 1: Relay (relay.link)

| Criteria          | Details                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------- |
| Package           | `@reservoir0x/relay-kit-ui` (v2.10.12, updated 4 days ago)                               |
| Type              | Pre-built React SwapWidget component                                                     |
| Base support      | Yes (native)                                                                             |
| Dark mode         | Yes, via `RelayKitTheme` object on `RelayKitProvider`                                    |
| Lock output token | Yes, `lockToToken={true}` prop + `toToken` prop                                          |
| Input tokens      | Any token on supported chains (ETH, USDC, WETH, etc.)                                    |
| Cross-chain       | Yes (swap from any chain to MBUCKS on Base)                                              |
| Fee structure     | Integrator-defined in basis points; accrues as USDC balance; **free withdrawal on Base** |
| KYC               | None                                                                                     |
| wagmi compatible  | Yes (uses `adaptViemWallet` from wagmi's `useWalletClient`)                              |
| Maintenance       | Very active (weekly releases on GitHub)                                                  |
| Size              | Moderate (includes UI components)                                                        |
| Complexity        | Low (drop-in component, 10-20 lines of code)                                             |

### Key Props

| Prop                | Type            | Description                                       |
| ------------------- | --------------- | ------------------------------------------------- |
| `toToken`           | `Token`         | Set MBUCKS token address here                     |
| `lockToToken`       | `boolean`       | Locks the output token so users cannot change it  |
| `fromToken`         | `Token`         | Optional: preset input token (e.g., USDC on Base) |
| `lockChainId`       | `number`        | Lock to Base (8453) for same-chain only           |
| `singleChainMode`   | `boolean`       | Restrict to same-chain swaps only                 |
| `defaultAmount`     | `string`        | Pre-fill swap amount                              |
| `wallet`            | `AdaptedWallet` | Adapted wagmi wallet client                       |
| `onConnectWallet`   | `function`      | RainbowKit `openConnectModal` callback            |
| `onSwapSuccess`     | `function`      | Callback on successful swap                       |
| `onSwapError`       | `function`      | Callback on swap error                            |
| `slippageTolerance` | `string`        | Slippage in basis points (e.g., "50" = 0.5%)      |

### Theming

```tsx
const theme: RelayKitTheme = {
  font: 'Inter',
  primaryColor: '#2dd4bf', // molt-400 teal
  focusColor: '#2dd4bf',
  text: { default: '#e2e8f0', subtle: '#94a3b8' },
  buttons: {
    primary: {
      color: '#0f172a',
      background: '#2dd4bf',
      hover: { background: '#14b8a6' },
    },
  },
};
```

Dark mode is activated by adding `class="dark"` to the HTML root element.

### Strengths

- Drop-in React component with minimal code
- `lockToToken` is purpose-built for our use case
- Native wagmi/RainbowKit integration
- Cross-chain support (users can buy MBUCKS from any chain)
- Free fee withdrawal on Base
- Very actively maintained

### Weaknesses

- Less customizable than building a fully custom UI
- Relatively new protocol (smaller track record than 0x or Uniswap)
- Theme tokens are limited compared to MUI-based widgets

---

## Option 2: LI.FI Widget

| Criteria          | Details                                                                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- |
| Package           | `@lifi/widget` (v3.38.1)                                                                                          |
| Type              | Pre-built React component (MUI-based)                                                                             |
| Base support      | Yes                                                                                                               |
| Dark mode         | Yes, built-in `appearance: "dark"` config                                                                         |
| Lock output token | Configurable via `toChain`, `toToken` config                                                                      |
| Input tokens      | Any token on 30+ chains                                                                                           |
| Cross-chain       | Yes                                                                                                               |
| Fee structure     | Integrator sets % fee (e.g., `fee: 0.03`); LI.FI takes 25bps (0.25%) platform cut; revenue share varies by volume |
| KYC               | None                                                                                                              |
| wagmi compatible  | Yes (listed as compatible)                                                                                        |
| Maintenance       | Very active                                                                                                       |
| Size              | Large (MUI dependency + multi-chain SDKs: wagmi, Solana, Sui, Bitcoin)                                            |
| Complexity        | Low-medium (drop-in but many peer dependencies)                                                                   |

### Strengths

- Excellent dark mode and theme customization (MUI palette, typography, shape)
- Battle-tested across many integrations
- Supports 30+ chains
- Built-in appearance config

### Weaknesses

- **Heavy peer dependencies**: requires `@bigmi/react`, `@solana/wallet-adapter-react`, `@mysten/dapp-kit`, `@tanstack/react-query` even if you only use EVM
- LI.FI takes a 25bps platform fee on every transaction
- Must contact `sales@li.finance` for fee collection setup (whitelist required)
- MUI adds significant bundle size to a Tailwind-based app
- Overkill for same-chain Base swaps only

---

## Option 3: 0x Swap API

| Criteria          | Details                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------- |
| Package           | REST API (no React component)                                                                                 |
| Type              | DEX aggregation API; build your own UI                                                                        |
| Base support      | Yes (native, with official tutorial)                                                                          |
| Dark mode         | N/A (you build the UI)                                                                                        |
| Lock output token | N/A (you control the UI)                                                                                      |
| Input tokens      | Any token with DEX liquidity                                                                                  |
| Cross-chain       | No (same-chain only; cross-chain API coming 2026)                                                             |
| Fee structure     | 0x takes 0.15% on select pairs; integrators can set additional % fee + claim positive slippage                |
| KYC               | None                                                                                                          |
| wagmi compatible  | Yes (official tutorial uses wagmi + RainbowKit)                                                               |
| Maintenance       | Very active (v2 API, 6 new chains added in 2025)                                                              |
| Size              | Minimal (just API calls, no UI package)                                                                       |
| Complexity        | Medium-high (must build entire swap UI: token selector, price display, approval flow, transaction submission) |

### Key Endpoints

| Endpoint                           | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| `GET /swap/allowance-holder/price` | Get price quote (for UI display)            |
| `GET /swap/allowance-holder/quote` | Get executable quote (commits market maker) |

### Strengths

- Maximum UI control (matches any design system perfectly)
- Aggregates 150+ liquidity sources
- Smallest bundle impact (just fetch calls)
- Official Next.js + wagmi + RainbowKit tutorial on Base
- Most established DEX aggregator

### Weaknesses

- Must build entire swap UI from scratch (token selector, approval flow, error handling, loading states)
- Same-chain only (no cross-chain until 2026)
- Requires API key (free tier available)
- More development time (days vs. hours for a drop-in widget)

---

## Option 4: 1inch

| Criteria          | Details                                                       |
| ----------------- | ------------------------------------------------------------- |
| Package           | `@1inch/embedded-widget` (v0.0.2, last published 4 years ago) |
| Type              | Embeddable widget (outdated); REST API available              |
| Base support      | Yes (13+ chains including Base)                               |
| Dark mode         | Unknown (widget is outdated)                                  |
| Lock output token | Unknown                                                       |
| Fee structure     | Variable by route                                             |
| KYC               | None                                                          |
| wagmi compatible  | API: yes; Widget: unknown                                     |
| Maintenance       | Widget: abandoned; API/Protocol: active                       |
| Size              | Unknown                                                       |
| Complexity        | API: medium-high; Widget: unknown compatibility risk          |

### Strengths

- 500+ liquidity sources
- Fusion mode with MEV protection
- Strong brand recognition

### Weaknesses

- **Official widget package is 4 years old (v0.0.2)**: not recommended
- Would need to either build custom UI on their API or use iframe embed
- iframe approach breaks the native app feel
- No official React component maintained for embedding

**Verdict: Not recommended.** The widget is abandoned and the API-only approach competes directly with 0x (which has better docs and an official Next.js tutorial).

---

## Option 5: Uniswap Swap Widget

| Criteria          | Details                          |
| ----------------- | -------------------------------- |
| Package           | `@uniswap/widgets`               |
| Type              | Pre-built React component        |
| Base support      | Yes (Uniswap v3/v4 on Base)      |
| Dark mode         | Yes (theme customization)        |
| Lock output token | Yes (configurable default token) |
| Fee structure     | Convenience fee option           |
| KYC               | None                             |
| wagmi compatible  | Was compatible                   |
| Maintenance       | **ARCHIVED: June 5, 2025**       |
| Size              | N/A                              |
| Complexity        | Was low                          |

### Strengths

- Was the gold standard for embeddable swap widgets
- Uniswap brand recognition

### Weaknesses

- **Repository archived on June 5, 2025**: read-only, no bug fixes, no security patches
- Open issues remain unresolved
- Potential compatibility issues with React 19 and Next.js 15

**Verdict: Do not use.** Archived and unmaintained. Security and compatibility risks.

---

## Option 6: Squid Router

| Criteria          | Details                                       |
| ----------------- | --------------------------------------------- |
| Package           | React widget via Widget Studio                |
| Type              | Pre-built React component                     |
| Base support      | Yes (100+ chains)                             |
| Dark mode         | Yes (Widget Studio customization)             |
| Lock output token | Configurable via default chains/tokens config |
| Cross-chain       | Yes (primary feature)                         |
| Fee structure     | Not publicly documented in detail             |
| KYC               | None                                          |
| wagmi compatible  | Yes                                           |
| Maintenance       | Active (Squid 2.0 launched)                   |
| Size              | Medium                                        |
| Complexity        | Low-medium                                    |

### Strengths

- Widget Studio for visual configuration
- Cross-chain with gas provisioning on destination chain
- 100+ chains, 2.5M+ transactions, $4B+ volume
- Next.js integration samples available

### Weaknesses

- Smaller developer community than Relay or 0x
- Fee structure not transparently documented
- Less granular React prop control compared to Relay's `lockToToken`
- Primarily positioned as a bridge, not a same-chain swap tool

**Verdict: Viable but not top 2.** Good cross-chain option but Relay covers the same use case with better React SDK ergonomics.

---

## Option 7: Coinbase Onramp (Pay SDK)

| Criteria         | Details                                                    |
| ---------------- | ---------------------------------------------------------- |
| Package          | `@coinbase/cbpay-js`                                       |
| Type             | Fiat-to-crypto onramp (popup/embed)                        |
| Base support     | Yes (native, zero-fee USDC on Base)                        |
| Custom ERC20     | **Only tokens listed on Coinbase exchange**                |
| Dark mode        | Limited (Coinbase-branded popup)                           |
| Fee structure    | Zero fees for USDC on Base; standard fees for other assets |
| KYC              | Yes (Coinbase account required for users)                  |
| wagmi compatible | Partially (popup-based, not inline swap)                   |
| Maintenance      | Active                                                     |

### Strengths

- Fiat-to-crypto (users can buy with debit card/bank)
- Zero-fee USDC on Base
- 110M+ Coinbase-verified users
- 100+ supported tokens, 60+ fiat currencies

### Weaknesses

- **Cannot target unlisted ERC20 tokens**: MBUCKS would not be available unless formally listed on Coinbase
- Requires KYC (Coinbase account)
- Popup-based UX (not inline)
- Limited theme customization

**Verdict: Complementary, not primary.** Useful as an additional "Buy with fiat" option alongside a DEX swap widget. Users would onramp to USDC via Coinbase, then swap USDC to MBUCKS via a DEX widget. Cannot be the sole solution.

---

## Option 8: RainbowKit

| Criteria     | Details |
| ------------ | ------- |
| Has swap UI? | **No**  |

RainbowKit is a wallet connection library only. It does not include any swap or trading functionality. The Rainbow Wallet app has swap features, but those are not exposed through RainbowKit's developer SDK.

**Verdict: Not applicable.** We already use RainbowKit for wallet connection. It cannot provide swap functionality.

---

## Comparison Matrix

| Feature           | Relay         | LI.FI          | 0x API       | 1inch     | Uniswap      | Squid   | Coinbase  | RainbowKit |
| ----------------- | ------------- | -------------- | ------------ | --------- | ------------ | ------- | --------- | ---------- |
| React component   | Yes           | Yes            | No (API)     | Abandoned | Archived     | Yes     | Popup     | No         |
| Dark theme        | Yes           | Yes            | N/A          | Unknown   | Yes          | Yes     | Limited   | N/A        |
| Lock output token | `lockToToken` | Config         | N/A          | Unknown   | Config       | Config  | N/A       | N/A        |
| Base chain        | Yes           | Yes            | Yes          | Yes       | Yes          | Yes     | Yes       | N/A        |
| Cross-chain       | Yes           | Yes            | No           | Yes       | No           | Yes     | N/A       | N/A        |
| Custom ERC20      | Yes           | Yes            | Yes          | Yes       | Yes          | Yes     | **No**    | N/A        |
| wagmi compat      | Native        | Yes            | Native       | API only  | Legacy       | Yes     | Partial   | N/A        |
| KYC required      | No            | No             | No           | No        | No           | No      | **Yes**   | N/A        |
| Maintained        | Active        | Active         | Active       | API only  | **Archived** | Active  | Active    | N/A        |
| Bundle size       | Medium        | **Large**      | Minimal      | Unknown   | N/A          | Medium  | Small     | N/A        |
| Integration time  | Hours         | Hours          | Days         | Days      | N/A          | Hours   | Hours     | N/A        |
| Fee transparency  | Clear (bps)   | 25bps platform | 0.15% select | Varies    | N/A          | Unclear | Zero USDC | N/A        |

---

## Top 2 Recommendations

### Recommendation 1: Relay (relay.link) | PRIMARY

**Why Relay is the best fit:**

1. **`lockToToken` prop**: Purpose-built for our exact use case. Set MBUCKS as the output token and lock it so users can only choose their input.
2. **Native wagmi/RainbowKit integration**: Uses `adaptViemWallet(walletClient)` from wagmi and `openConnectModal` from RainbowKit. Zero adapter code needed.
3. **Dark mode theming**: `RelayKitTheme` object lets us match the Moltblox glass-card design with molt-400 teal accents.
4. **Cross-chain**: Users can buy MBUCKS from any chain (ETH on mainnet, USDC on Arbitrum, etc.) without us building bridge logic.
5. **Free fee withdrawal on Base**: Since MBUCKS is on Base, our fee collection is gas-free.
6. **Active maintenance**: v2.10.12 released days ago, weekly GitHub releases.
7. **No KYC**: Permissionless swaps.
8. **Integrator fees**: Set our own fee in basis points to earn revenue on every swap.

**Integration effort**: ~2-4 hours for a production-ready "Buy MBucks" modal.

### Recommendation 2: 0x Swap API | CUSTOM UI ALTERNATIVE

**Why 0x is the best alternative:**

1. **Maximum design control**: Build a swap UI that perfectly matches the Moltblox dark glass-card theme.
2. **Official Next.js + wagmi + RainbowKit tutorial**: 0x provides a step-by-step guide specifically for our stack, building on Base.
3. **150+ liquidity sources**: Best price aggregation across DEXes.
4. **Smallest bundle impact**: Just API calls, no widget package to bundle.
5. **Established protocol**: Most battle-tested DEX aggregator.
6. **Revenue potential**: Collect fees + positive slippage.

**Integration effort**: ~2-3 days for a custom swap UI with approval flow, price quotes, and error handling.

**When to choose 0x over Relay:**

- If the Relay widget's appearance cannot be sufficiently customized to match Moltblox's design
- If you want pixel-perfect control over every UI element
- If cross-chain is not needed (0x is same-chain only until their Cross Chain API launches in 2026)

---

## Integration Code Samples

### Relay SwapWidget Integration

```tsx
// apps/web/components/BuyMbucksModal.tsx
'use client';

import { SwapWidget } from '@reservoir0x/relay-kit-ui';
import { RelayKitProvider, type RelayKitTheme } from '@reservoir0x/relay-kit-ui';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { useWalletClient } from 'wagmi';
import { adaptViemWallet } from '@reservoir0x/relay-kit-ui';

// MBUCKS token on Base
const MBUCKS_TOKEN = {
  chainId: 8453,
  address: '0x...MBUCKS_CONTRACT_ADDRESS...',
  decimals: 18,
  name: 'MBucks',
  symbol: 'MBUCKS',
  logoURI: '/mbucks-logo.png',
};

const relayTheme: RelayKitTheme = {
  font: 'Inter',
  primaryColor: '#2dd4bf', // molt-400
  focusColor: '#2dd4bf',
  text: {
    default: '#e2e8f0', // slate-200
    subtle: '#94a3b8', // slate-400
  },
  buttons: {
    primary: {
      color: '#0f172a', // slate-900
      background: '#2dd4bf', // molt-400
      hover: { background: '#14b8a6' }, // molt-500
    },
  },
};

export function BuyMbucksWidget() {
  const { openConnectModal } = useConnectModal();
  const { data: walletClient } = useWalletClient();

  return (
    <RelayKitProvider theme={relayTheme}>
      <SwapWidget
        supportedWalletVMs={['evm']}
        onConnectWallet={() => openConnectModal?.()}
        wallet={walletClient ? adaptViemWallet(walletClient) : undefined}
        toToken={MBUCKS_TOKEN}
        lockToToken={true}
        defaultAmount="10"
        onSwapSuccess={(data) => {
          console.log('Swap successful:', data);
          // Refresh MBUCKS balance, show success toast, etc.
        }}
        onSwapError={(error) => {
          console.error('Swap failed:', error);
        }}
      />
    </RelayKitProvider>
  );
}
```

**Install dependencies:**

```bash
pnpm add @reservoir0x/relay-kit-ui
```

### 0x Swap API Integration (Custom UI)

```tsx
// apps/web/components/BuyMbucksCustom.tsx
'use client';

import { useState, useEffect } from 'react';
import { useAccount, useWalletClient, useSendTransaction } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useConnectModal } from '@rainbow-me/rainbowkit';

const MBUCKS_ADDRESS = '0x...MBUCKS_CONTRACT_ADDRESS...';
const USDC_ADDRESS = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913'; // USDC on Base
const BASE_CHAIN_ID = 8453;

interface SwapQuote {
  price: string;
  buyAmount: string;
  sellAmount: string;
  to: string;
  data: string;
  value: string;
  gas: string;
  gasPrice: string;
}

export function BuyMbucksCustom() {
  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { sendTransactionAsync } = useSendTransaction();
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetch price indication as user types
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({
          chainId: BASE_CHAIN_ID.toString(),
          sellToken: USDC_ADDRESS,
          buyToken: MBUCKS_ADDRESS,
          sellAmount: parseUnits(amount, 6).toString(),
          taker: address || '0x0000000000000000000000000000000000000000',
        });
        const res = await fetch(`https://api.0x.org/swap/allowance-holder/price?${params}`, {
          headers: {
            '0x-api-key': process.env.NEXT_PUBLIC_0X_API_KEY || '',
            '0x-version': 'v2',
          },
        });
        const data = await res.json();
        setQuote(data);
      } catch (err) {
        console.error('Price fetch error:', err);
      }
    }, 500); // debounce 500ms
    return () => clearTimeout(timer);
  }, [amount, address]);

  const executeSwap = async () => {
    if (!isConnected) {
      openConnectModal?.();
      return;
    }
    setLoading(true);
    try {
      // Get executable quote
      const params = new URLSearchParams({
        chainId: BASE_CHAIN_ID.toString(),
        sellToken: USDC_ADDRESS,
        buyToken: MBUCKS_ADDRESS,
        sellAmount: parseUnits(amount, 6).toString(),
        taker: address!,
      });
      const res = await fetch(`https://api.0x.org/swap/allowance-holder/quote?${params}`, {
        headers: {
          '0x-api-key': process.env.NEXT_PUBLIC_0X_API_KEY || '',
          '0x-version': 'v2',
        },
      });
      const quoteData = await res.json();

      // Submit transaction via wagmi
      await sendTransactionAsync({
        to: quoteData.to as `0x${string}`,
        data: quoteData.data as `0x${string}`,
        value: BigInt(quoteData.value || '0'),
        gas: BigInt(quoteData.gas),
      });
    } catch (err) {
      console.error('Swap error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-card p-6 rounded-xl">
      <h3 className="text-lg font-semibold text-white mb-4">Buy MBucks</h3>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="USDC amount"
        className="w-full bg-slate-800 text-white rounded-lg px-4 py-3 mb-4"
      />
      {quote && (
        <p className="text-slate-400 mb-4">
          You receive: ~{formatUnits(BigInt(quote.buyAmount), 18)} MBUCKS
        </p>
      )}
      <button
        onClick={executeSwap}
        disabled={loading || !amount}
        className="w-full bg-molt-400 text-slate-900 font-semibold py-3 rounded-lg
                   hover:bg-molt-500 disabled:opacity-50 transition-colors"
      >
        {loading ? 'Swapping...' : isConnected ? 'Swap' : 'Connect Wallet'}
      </button>
    </div>
  );
}
```

**Required env var:**

```env
NEXT_PUBLIC_0X_API_KEY=your_0x_api_key_here
```

**Note:** The 0x example above is simplified. A production implementation also needs:

- Token approval flow (ERC20 approve for AllowanceHolder contract)
- Error handling for insufficient balance, slippage, stale quotes
- Loading states and transaction confirmation UI
- The AllowanceHolder contract address on Base: `0x0000000000001fF3684f28c67538d4D072C22734`

---

## Additional Consideration: Coinbase Onramp as Complementary

For users who do not hold any crypto, consider adding a secondary "Buy with Card" button using Coinbase Onramp to purchase USDC on Base (zero-fee), then auto-routing to the Relay SwapWidget or 0x swap to convert USDC to MBUCKS. This creates a complete fiat-to-MBUCKS flow.

---

## Sources

- [Relay SwapWidget Docs](https://docs.relay.link/references/relay-kit/ui/swap-widget)
- [Relay App Fees](https://docs.relay.link/features/app-fees)
- [Relay Theming](https://docs.relay.link/references/relay-kit/ui/theming)
- [Relay Kit GitHub](https://github.com/reservoirprotocol/relay-kit)
- [@reservoir0x/relay-kit-ui npm](https://www.npmjs.com/package/@reservoir0x/relay-kit-ui)
- [LI.FI Widget Docs](https://docs.li.fi/integrate-li.fi-widget/li.fi-widget-overview)
- [LI.FI Monetization](https://docs.li.fi/monetization-take-fees)
- [@lifi/widget npm](https://www.npmjs.com/package/@lifi/widget)
- [0x Swap API Docs](https://0x.org/docs/0x-swap-api/introduction)
- [0x Build Token Swap (Next.js)](https://0x.org/docs/0x-swap-api/guides/build-token-swap-dapp-nextjs)
- [0x Pricing](https://0x.org/pricing)
- [Uniswap Widgets GitHub (Archived)](https://github.com/Uniswap/widgets)
- [1inch Embedded Widget npm](https://www.npmjs.com/package/@1inch/embedded-widget)
- [Squid Router Docs](https://docs.squidrouter.com)
- [Coinbase Onramp Docs](https://docs.cdp.coinbase.com/onramp/docs/welcome)
- [Coinbase Pay SDK GitHub](https://github.com/coinbase/cbpay-js)
- [RainbowKit Docs](https://rainbowkit.com/docs/introduction)
