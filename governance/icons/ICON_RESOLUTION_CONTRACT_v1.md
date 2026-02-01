# Icon Resolution Contract

**Version:** v1.0  
**Created At:** 30 January 2026, 11:37:02 AM IST (+05:30)  
**Status:** DRAFT  
**Applies To:** Asset Iconography, Chain Logos, Token Images

## 1. Purpose & Scope
This contract standardizes how the application resolves, caches, and displays visual identifiers (icons) for blockchains and assets. It establishes a **deterministic, stateless, and fault-tolerant** strategy ensuring that thousands of assets can be supported without bloating the application bundle or requiring runtime API calls.

## 2. Resolution Strategy (CDN-First)
The resolution pipeline MUST follow this strict order of precedence. The first source to successfully load is used.

### Priority 1: High-Performance CDN (Remote)
*   **Source:** Trusted immutable asset repository (e.g., TrustWallet Assets, CoinGecko, or internal CDN).
*   **Method:** Deterministic URL construction.
*   **Cache Policy:** Aggressive caching (immutable URLs).

### Priority 2: Local Bundle (Essential Assets Only)
*   **Scope:** Restricted to top-tier native assets (BTC, ETH, SOL, USDC, USDT) and essential UI iconography.
*   **Purpose:** Ensures instant visual feedback for critical paths even if the network is flaky.
*   **Limit:** The local bundle must NOT grow linearly with supported assets.

### Priority 3: Generic Fallback (Generated)
*   **Trigger:** If Priority 1 and 2 fail (404/Timeout).
*   **Output:** a generic placeholder or dynamic letter-avatar (e.g., a circle with the first letter of the ticker).
*   **Requirement:** Must be rendered client-side (SVG/CSS); no network request allowed.

## 3. Separation of Concerns
Distinct resolution paths exist for Chains and Assets to avoid ambiguity.

### A. Chain Icons
*   **Definition:** The network itself (e.g., Ethereum Mainnet, Solana Cluster).
*   **Path Structure:** `/blockchains/{chain_slug}/info/logo.png`
*   **Identifier:** `chain_slug` (lowercase, kebab-case). Example: `ethereum`, `bitcoin`.

### B. Asset Icons
*   **Definition:** Tokens or native currencies residing on a chain.
*   **Path Structure:** `/blockchains/{chain_slug}/assets/{token_address}/logo.png`
*   **Identifier:** `token_address` (Checksummed for EVM, distinct for others) or `native` flag.

## 4. Naming & Path Conventions
All resolution paths MUST be deterministic. No "lookup" registry is allowed at runtime.

### Convention Rules
1.  **Chains:** Lowercase, kebab-case (e.g., `binance-smart-chain`).
2.  **Tickers:** Uppercase for display, lowercase for filenames if local (normalization required).
3.  **Addresses:**
    *   **EVM:** Checksum address (Case-sensitive per standard repository rules).
    *   **Solana:** Base58 string.
    *   **Bitcoin:** Not applicable for tokens (usually), native only.

### Folder Structure (Conceptual)
```
/assets
  /chains
    /ethereum.png
    /bitcoin.png
    /solana.png
  /tokens
    /eth
      /usdc.png
      /usdt.png
    /sol
      /usdc.png
```

## 5. Failure Behavior & Guardrails
Visual failure (missing icon) MUST NEVER block interaction or cause functional errors.

*   **Silent Degradation:** A 404 on an icon image must quietly resolve to the Fallback. It must NOT throw a JavaScript exception that interrupts the main thread.
*   **No Layout Shift:** Fallback icons must have the exact same dimensions as the intended icon to prevent CLS (Cumulative Layout Shift).
*   **Timeout:** Remote requests must have a strict timeout (e.g., 2s) before reverting to fallback.

## 6. Forbidden Behaviors
The following are strictly prohibited in the icon resolution layer:

*   **Runtime API Lookups:** DO NOT call an API (e.g., `api.coingecko.com/search?q=...`) to find an icon URL. Paths must be constructed mathematically from the asset ID.
*   **Blocking Main Thread:** Icon processing/loading must be asynchronous.
*   **Coupling with Business Logic:** Icon resolution knows nothing about balances, gas fees, or user permissions. It only knows `(Chain, ID) -> Image`.
*   **Dynamic SVG Injection:** Do not inject arbitrary SVG strings from remote sources (security risk). Use `<img>` tags or sanitized backgrounds only.
*   **Private User Data:** Never send user IP or wallet data to the CDN. The request is purely for the public asset image.
