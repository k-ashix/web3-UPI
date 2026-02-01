# CHAIN SCOPE CONTRACT (v1)

> **VERSION**: 1.0 (DRAFT)
> **STATUS**: PROPOSED
> **OWNER**: Send Module
> **AFFECTS**: Send Overlay, Chain Selection, Asset Normalization

## 1. Terminology

*   **Asset**: The application-layer token being transferred (e.g., ETH, BTC, SOL). Represents the user's intent ("I want to send Bitcoin").
*   **Chain**: The settlement layer where the transaction is executed (e.g., Bitcoin Mainnet, Ethereum Mainnet, Solana Mainnet).
*   **Network**: A specific instance of a Chain (e.g., Mainnet, Testnet, Devnet, L2).
*   **Address Format**: The encoding standard used for the recipient (e.g., SegWit `bc1`, Legacy `1`, ERC-20 `0x`).
*   **Scope**: The set of valid Chains/Networks available for a given Asset.

## 2. Asset → Chain Scope Matrix

This matrix defines the **ONLY** allowed Networks for a selected Asset.

### 2.1 Ethereum (Asset: `ETH` / `USDT` / `USDC`)
*   **Scope Type**: Multi-Chain / EVM
*   **Allowed Networks**:
    *   Ethereum Mainnet (Primary)
    *   Arbitrum One
    *   Optimism
    *   Polygon PoS
    *   Base
    *   Linea
    *   Scroll
    *   Sepolia (Testnet)
*   **Forbidden**: Bitcoin, Solana

### 2.2 Bitcoin (Asset: `BTC`)
*   **Scope Type**: Single-Chain / UTXO
*   **Allowed Networks**:
    *   Bitcoin Mainnet (Primary)
*   **Forbidden**:
    *   All EVM Chains (Wrapped BTC is a separate asset intent, not native BTC)
    *   Solana
    *   SegWit / Taproot are **NOT** Chains (they are Address Formats on Bitcoin Mainnet)

### 2.3 Solana (Asset: `SOL`)
*   **Scope Type**: Single-Chain / SVM
*   **Allowed Networks**:
    *   Solana Mainnet (Primary)
*   **Hidden / Advanced Only**:
    *   Solana Devnet
    *   Solana Testnet
*   **Forbidden**: Ethereum, Bitcoin

## 3. Overlay Behavior Rules

The `SendOverlay` must strictly adhere to these display rules based on `APP_STATE.asset`.

| Active Asset | Displayed Chain List | Default Selection |
| :--- | :--- | :--- |
| **ETH** | Ethereum Mainnet + L2s + Testnets | Ethereum Mainnet |
| **BTC** | Bitcoin Mainnet ONLY | Bitcoin Mainnet |
| **SOL** | Solana Mainnet ONLY | Solana Mainnet |
| **NULL** | Ethereum Mainnet + L2s + Testnets | Ethereum Mainnet |

*   **Rule 3.1**: The Overlay MUST NOT display chains outside the Active Asset's scope.
*   **Rule 3.2**: If `APP_STATE.asset` is NULL, the Overlay defaults to the `ETH` scope (most complex/common).
*   **Rule 3.3**: The Overlay is View-Only. It does not validate; it only allows selection of valid options defined by this contract.

## 4. Forbidden States

1.  **Cross-Contamination**:
    *   `Asset: BTC` + `Chain: Arbitrum` → **FORBIDDEN**.
    *   `Asset: SOL` + `Chain: Ethereum` → **FORBIDDEN**.

2.  **Inferred Chains**:
    *   The UI MUST NOT guess the chain if the user selects a generic asset without explicit context, UNLESS it is the *only* option (e.g., User selects BTC -> Chain becomes Bitcoin).

3.  **Ambiguous Assets**:
    *   "USDC" exists on multiple chains.
    *   If `Asset: USDC` is selected, the Overlay must allow ALL Chains where USDC is supported (ETH + SOL + L2s).
    *   *Implementation Note*: For Phase 11, USDC is treated primarily as EVM-first, but logically supports multi-chain.

## 5. Future-Proofing Notes

*   **New EVM Chains**: Added to the `Ethereum` scope list.
*   **New Non-EVM Chains**: Require a new Asset entry in the Matrix (e.g., `TON`, `TRX`).
*   **Wrapped Assets**: `WBTC` on Ethereum is an `ERC-20` token in the `ETH` scope. It is NOT `BTC` (Native).
*   **Address Formats**: Future BTC formats (e.g., potential new opcodes) update the Validation Logic, not the Chain List.

## 6. Non-Goals

This contract explicitly **DOES NOT** govern:
*   **Gas Calculations**: Fee logic is strictly downstream.
*   **RPC Selection**: Which node connects to validity checking.
*   **Icon Resolution**: Visuals are handled by `iconCDNResolver.js`.
*   **Address Validation**: Regex checks are handled by `send.js` validators.
*   **Wallet Connection**: Signing logic is out of scope.

## 7. Verification Checklist

- [ ] Select BTC Asset → Overlay shows ONLY "Bitcoin Mainnet".
- [ ] Select SOL Asset → Overlay shows ONLY "Solana Mainnet".
- [ ] Select ETH Asset → Overlay shows Ethereum + L2s.
- [ ] Select NULL Asset → Overlay shows Ethereum + L2s (Default).
