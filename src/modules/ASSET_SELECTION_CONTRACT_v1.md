# ASSET & CHAIN SELECTION CONTRACT (v1)

> **VERSION**: 1.0 (DRAFT)
> **STATUS**: PROPOSED
> **OWNER**: Send Module

## 1. Problem Statement
The current Send UI suffers from split ownership of asset selection:
1.  **Implicit Selection**: Typing an address triggers `updateAssetLogo(address)`, which derives the asset and mutates state.
2.  **Explicit Selection**: The Asset/Chain overlay exists visually but has no binding to update the Send state.
3.  **Desync**: It is possible to have an "Overlay Selection" that conflicts with the "Address Detection" if not strictly managed.

## 2. The Authoritative Function
There shall be **ONE** single source of truth for changing the active asset or chain.

```javascript
/**
 * Authoritative Asset Selection
 * @param {Object} params
 * @param {string|null} params.asset - 'eth', 'btc', 'sol', or null
 * @param {string|null} params.chain - 'Ethereum', 'Bitcoin', 'Solana', or null
 * @param {string} params.source - 'manual_address', 'qr_scan', 'overlay_click', 'initial_load'
 */
function selectAsset({ asset, chain, source })
```

### 2.1 Responsibilities (What it OWNS)
*   **State Mutation**: It is the *only* allowed mutator of `APP_STATE.asset` and `APP_STATE.chain`.
*   **Visual Synchronization**: It triggers updates for:
    *   The "Identity Pill" (Asset Logo & Chain Badge).
    *   The Theme System (`updateTheme`).
    *   The Data Layer (`updateDataState` - gas/price).
    *   The Validation Layer (`updateValidationState` - chain matching).
*   **Overlay State**: It ensures the Overlay, if open, reflects the new selection (or closes it).

### 2.2 What it MUST NOT Do
*   **It MUST NOT modify the Address Input**: Selection of an asset (e.g., clicking "BTC" in overlay) should *not* clear the address input. It should instead result in a validation error if the existing address does not match.
*   **It MUST NOT infer intention**: It takes explicit inputs. Logic for "detecting" asset from address belongs in the *caller* (e.g., the input handler), not this function.

## 3. Allowed Callers & Sources

| Caller | Source ID | Behavior |
| :--- | :--- | :--- |
| **Address Input** | `manual_address` | When user types, `detectAssetFromAddress` runs. If result changes, call `selectAsset`. |
| **QR Scanner** | `qr_scan` | When QR is hydrated, the scanned metadata determines asset. Call `selectAsset`. |
| **Overlay (Asset)** | `overlay_click` | User clicks an Asset chip. Explicitly calls `selectAsset`. |
| **Overlay (Chain)** | `overlay_chain` | User clicks a Chain chip. Explicitly calls `selectAsset`. |
| **Reset/Init** | `system_reset` | Calls `selectAsset({ asset: null, chain: null })` to neutralize. |

## 4. Invariants & Guarantees

### 馃攲 Invariant 1: Identity Pill Authority
The icon displayed in the "Identity Pill" (Card Header) **MUST ALWAYS** match `APP_STATE.asset`.
*   *Violation*: Showing an ETH logo while `APP_STATE.asset` is 'btc'.
*   *Fix*: `selectAsset` is the only path to update `APP_STATE`, and it strictly calls `resolveIconSources` and updates the DOM immediately.

### 馃攲 Invariant 2: Theme Consistency
The UI Theme (Background/Gradient) **MUST ALWAYS** derive strictly from `APP_STATE.asset`.
*   *Flow*: `selectAsset` -> `updateTheme(asset)`.
*   No other function may call `updateTheme`.

### 馃攲 Invariant 3: Overlay Statelessness
The Overlay is **VIEW-ONLY**. It does not hold "selection state".
*   When Overlay opens, it highlights the current `APP_STATE.asset`.
*   When User clicks an item, it calls `selectAsset` and closes.
*   It does **NOT** wait for "Confirmation". Selection is immediate.

### 馃攲 Invariant 4: Address Verification Priority
*   **Scenario**: User types ETH address (detected as ETH). User opens Overlay and selects BTC.
*   **Result**:
    *   `APP_STATE.asset` = 'btc'.
    *   `Identity Pill` = BTC Logo.
    *   `VALIDATION_STATE.isChainMatch` = **FALSE** (Address is ETH, Asset is BTC).
    *   `UI Gating` = **BLOCKED** (Send button disabled, Input neutralized/invalid).
*   **Rationale**: Explicit user selection overrides auto-detection, correctly leading to a "Mismatch" state rather than preventing the selection.

## 5. Implementation Roadmap (Reference Only)

1.  **Refactor `send.js`**:
    *   Extract `updateAssetLogo` logic into `selectAsset`.
    *   Remove state mutation from `updateAssetLogo` (make it a pure renderer or deprecated).
    *   Update `addressInput` listener to call `detect` -> `selectAsset`.

2.  **Update `send-overlay.js`**:
    *   Bind click events on rendered cards.
    *   Call `window.SendModule.selectAsset(...)` (or equivalent exposed method).

3.  **Verify**:
    *   Type ETH addr -> Auto-select ETH.
    *   Click BTC in overlay -> Switch to BTC -> mismatch error shown.
