# WEB3 PWI SEND FLOW — SYSTEM CONTRACT SNAPSHOT

**Document Version**: 1.0  
**System Analyzed**: Web3 PWI Send Module  
**Date**: 2026-01-28  
**Purpose**: Long-term conceptual documentation. NOT a code tutorial.

---

## 1. SYSTEM OVERVIEW

### Architecture Pipeline

The Send flow operates as a deterministic pipeline:

```
User Intent → Authority Resolution → Derivation → Rendering → Guardrails
```

**Pipeline Stages:**

1. **User Intent**: User types in either USD input (`<input type="text">`) or Asset display (`contenteditable` div)
2. **Authority Resolution**: System determines which input is authoritative based on `APP_STATE.inputMode` ('fiat' or 'asset')
3. **Derivation**: AmountEngine performs pure math conversion (USD ↔ Asset)
4. **Rendering**: updateAmountMirror() writes derived value to non-authoritative field
5. **Guardrails**: Input sanitization, length limits, focus barriers, neutral state management

### USD vs Asset Input

**USD Input** (`#usdIndex`):
- Standard `<input type="text">` element
- 2-decimal precision enforced
- Sanitization via string operations (split, substring)
- Prevents: scientific notation keys (e, E, -, +)

**Asset Input** (`.currency-display .value`):
- Uses `contenteditable="true"` div (NOT input element)
- Variable precision (6 for ETH/SOL, 8 for BTC)
- 17-digit cap (preventive, not truncative)
- Requires manual caret management

### Why contenteditable for Asset?

Three technical reasons:

1. **Visual Scaling**: Asset amounts scale font-size dynamically based on length. contenteditable divs support this without layout thrashing.

2. **Numeric Precision**: Asset amounts can be very long (e.g., 0.000000123 ETH). contenteditable preserves raw string better than input value coercion.

3. **UX Polish**: Allows inline neutral state rendering ("— —") without fighting browser input placeholders.

**Trade-off**: Requires manual caret position management and beforeinput event handling.

---

## 2. AUTHORITY MODEL

### String-Authoritative Definition

**Core Principle**: The field currently being edited by the user is the "source of truth" and MUST NEVER be overwritten by the system.

**String-Authoritative** means:
- Input values are stored as STRINGS throughout the UI layer
- String operations (split, substring, replace) preserve precision
- Numeric conversion happens ONLY at the AmountEngine boundary
- No intermediate Number() calls in input handlers

**Authority Flow:**

```
User types "100" in USD → APP_STATE.inputMode = 'fiat'
  → USD input is AUTHORITATIVE (read-only from system perspective)
  → Asset display is DERIVED (writable by updateAmountMirror)

User clicks Asset blocker → APP_STATE.inputMode = 'asset'
  → Asset display is AUTHORITATIVE (read-only from system perspective)
  → USD input is DERIVED (writable by updateAmountMirror)
```

### Focus and Intent Determine Authority

Authority is NOT determined by focus alone. It's determined by `APP_STATE.inputMode`, which is set by:

1. **User clicking the blocker overlay** (explicit authority switch)
2. **System initialization** (default: 'fiat' mode)

Focus-based protection is additive:

```javascript
const isAssetBeingEdited = document.activeElement === assetDisplay;
if (!isAssetBeingEdited) {
    setVisualValue(assetDisplay, derived); // Safe to update
}
```

This prevents race conditions where updateAmountMirror() fires while user is mid-type in the opposite field.

### Why Derived Values Must Never Overwrite Active Input

**Fintech Correctness Rule**:

If the system overwrites what the user is typing, it creates:

1. **Data Loss**: User typing "1000" gets overwritten at "10" → user sees "10.00" → trust violation
2. **Circular Overwrites**: USD writes Asset → Asset triggers engine → Engine writes USD → infinite loop
3. **Precision Corruption**: String → Number → String loses trailing zeros and precision

**Enforcement Mechanism**:

```javascript
// In updateAmountMirror(), FIAT mode branch:
const fiatVal = usdInput.value; // READ ONLY
const derived = AmountEngine.deriveFromFiat(...);
// NEVER: usdInput.value = ... (would overwrite authoritative input)
setVisualValue(assetDisplay, derived); // Write to DERIVED field only
```

---

## 3. NUMERIC SAFETY MODEL

### JavaScript Precision Limits

**IEEE 754 Double-Precision Constraint**:
- JavaScript Number is 64-bit floating point
- Safe integer range: -(2^53 - 1) to (2^53 - 1)
- This is approximately 16 decimal digits

**Financial Implications**:
- Asset amounts can exceed 16 digits (e.g., 12345678901234567.89)
- Beyond 16 digits, Number() silently rounds
- Scientific notation (1e-7) breaks string-based UI

### Why Asset is Capped at 17 Digits

**Industry Standard**:
- MetaMask: Prevents input beyond safe integer limits
- Coinbase Wallet: Caps precision display
- Phantom (SOL): Enforces 9-decimal lamport precision

**17-Digit Rationale**:
- 16 digits = JavaScript safe integer limit
- +1 digit = UX buffer (allows 17 without breaking math)
- Further digits are mathematically unrepresentable

**Constant Definition**:

```javascript
const MAX_ASSET_DIGITS = 17; // 2^53 safe + 1 buffer
```

### Why beforeinput Instead of Truncation

**Two Strategies Compared**:

| Strategy | Mechanism | User Experience | Data Integrity |
|----------|-----------|-----------------|----------------|
| **Truncation** | User types 18th digit → system deletes it after insertion | Jarring, feels broken | Silent data loss |
| **Prevention** (chosen) | User presses 18th digit → beforeinput blocks insertion | Clear feedback, no surprise | No data loss |

**Implementation**:

```javascript
assetDisplay.addEventListener('beforeinput', (e) => {
    // Count current + incoming digits
    if (currentDigitCount + incomingDigitCount > MAX_ASSET_DIGITS) {
        e.preventDefault(); // Block BEFORE DOM mutation
        showToast("Maximum precision reached", true);
    }
});
```

**Why This Matters**:
- Truncation happens AFTER the character enters DOM → caret jumps, user confused
- Prevention happens BEFORE DOM mutation → clean UX, no layout shift

### Why Scientific Notation is Forbidden

**Problem**:
- JavaScript converts small decimals to scientific notation: `0.0000001` → `"1e-7"`
- UI layer operates on strings → "1e-7" displayed raw is confusing
- String operations (split('.')) fail on "e" format

**Solution**:

```javascript
const safeDecimalString = (num) => {
    if (str.includes('e')) {
        return num.toLocaleString('en-US', { 
            useGrouping: false, 
            maximumFractionDigits: 20 
        });
    }
    return str;
};
```

**Enforcement**:
- Input handlers prevent 'e' and 'E' key insertion
- AmountEngine returns numbers → UI immediately converts to safe string

---

## 4. AMOUNT ENGINE CONTRACT

### What AmountEngine Does

**Responsibilities**:
1. **Pure Math**: Convert USD ↔ Asset using price data
2. **Precision Rounding**: Apply chain-specific decimal limits (ETH: 6, BTC: 8, SOL: 6)
3. **Safe Parsing**: Validate inputs, return null on invalid data
4. **Zero Side Effects**: No DOM access, no network calls, no state mutation

**Public API**:

```javascript
AmountEngine.deriveFromFiat(fiatAmount, assetPriceUSD, chain)
  → Returns asset amount or null

AmountEngine.deriveFromAsset(assetAmount, assetPriceUSD)
  → Returns USD amount or null

AmountEngine.roundFiat(amount) → 2 decimals
AmountEngine.roundAsset(amount, chain) → 6 or 8 decimals
```

**Determinism Guarantee**:
- Same inputs → same outputs (always)
- No hidden state, no closures, no async

### What AmountEngine MUST NEVER Do

**Forbidden Operations**:

1. **DOM Manipulation**: Cannot read or write to input elements
2. **State Mutation**: Cannot modify APP_STATE, DATA_STATE, or any global
3. **Network Calls**: Cannot fetch prices or gas data
4. **Uncaught Errors**: Must return null on invalid input, never throw
5. **Precision Loss**: Must use safeRound(), not raw Math.round()
6. **Business Logic**: Cannot know about authority, focus, or UI state

**Why These Restrictions Exist**:

AmountEngine is the **single source of truth** for numeric conversion. If it had side effects:
- Unit tests would fail (non-deterministic)
- Circular dependencies would form (UI ↔ Engine ↔ State)
- Precision bugs would be untraceable

### Boundary Between String Input and Numeric Math

**Strict Rule**:

```
┌─────────────────────┐
│   UI Layer (Strings) │ ← Input handlers, event listeners
└──────────┬──────────┘
           │ String passed here
           ▼
    ┌──────────────┐
    │ AmountEngine │ ← safeParse() converts String → Number
    └──────────────┘
           │ Number returned here
           ▼
┌─────────────────────┐
│   UI Layer (Render) │ ← setVisualValue() converts Number → String
└─────────────────────┘
```

**Boundary Enforcement**:

```javascript
// CORRECT:
const fiatVal = usdInput.value; // String
const derived = AmountEngine.deriveFromFiat(fiatVal, ...); // Engine handles conversion
setVisualValue(assetDisplay, derived); // Render handles Number → String

// FORBIDDEN:
const num = Number(usdInput.value); // Precision loss!
assetDisplay.textContent = num.toFixed(6); // Bypasses engine rounding!
```

**Invariant**: String → Number happens EXACTLY ONCE (inside AmountEngine.safeParse())

---

## 5. MIRRORING RULES

### updateAmountMirror Responsibility

**Single Purpose**: Synchronize the derived (non-authoritative) field with the calculated value from the authoritative field.

**Control Flow**:

```
1. Check prerequisites (asset, price data exists)
2. Identify authority mode (fiat or asset)
3. Read authoritative input (as string)
4. Pass to AmountEngine (string → number conversion happens here)
5. Write derived value to non-authoritative field (number → string)
6. Skip write if derived field has focus (write barrier)
```

**What It Does NOT Do**:
- Does NOT read both inputs and reconcile
- Does NOT validate amounts (validation is passive, separate)
- Does NOT execute transactions
- Does NOT update APP_STATE (APP_STATE is a mirror, not a driver)

### Write Barriers

**Problem**: updateAmountMirror() is called frequently (on input events, price updates, asset changes). Without barriers, it would overwrite user typing.

**Write Barrier Pattern**:

```javascript
const isAssetBeingEdited = document.activeElement === assetDisplay;

if (APP_STATE.inputMode === 'fiat') {
    // USD is authoritative → Asset is derived
    if (!isAssetBeingEdited) { // BARRIER
        setVisualValue(assetDisplay, derived);
    }
    // USD is NEVER written to (it's authoritative)
}
```

**Barriers in Effect**:

| Mode | Authoritative | Derived | Write Barrier Check |
|------|--------------|---------|---------------------|
| 'fiat' | USD | Asset | `!isAssetBeingEdited` |
| 'asset' | Asset | USD | (none needed, USD input prevents focus) |

**Why Asset Mode Doesn't Need Barrier**:
- Asset mode is locked behind address validation
- User cannot simultaneously type in both fields
- USD is always writable in asset mode (no focus conflict)

### Focus-Based Protection

**Mechanism**: `document.activeElement` check before DOM write.

**Race Condition Prevention**:

Scenario WITHOUT protection:
```
1. User types "5" in Asset (asset mode)
2. Price update fires → updateAmountMirror() triggered
3. System calculates new USD value
4. System writes "5.00" to Asset (overwrites "5" → "5.00" → caret jumps)
```

Scenario WITH protection:
```
1. User types "5" in Asset (asset mode)
2. Price update fires → updateAmountMirror() triggered
3. isAssetBeingEdited = true (focus check)
4. System SKIPS assetDisplay write
5. User completes typing "500" → then system updates USD
```

**Implementation Detail**:

```javascript
const isFocused = document.activeElement === target;
if (isFocused) {
    // Restore caret to END after textContent mutation
    const range = document.createRange();
    range.selectNodeContents(target);
    range.collapse(false); // false = end
    sel.addRange(range);
}
```

This is ONLY used when updateAmountMirror() writes to a focused field (e.g., neutral state override). Normal flow skips focused fields entirely.

---

## 6. UX GUARDRAILS

### Toast-on-Intent vs Silent Prevention

**Design Philosophy**: Distinguish between user-initiated actions and system-initiated actions.

**Toast Triggers (User Intent)**:
- Click on locked input → "Enter wallet address first"
- Keydown on locked input → Same toast
- Attempt 18th digit insertion → "Maximum precision reached"

**Silent Prevention (System/Passive)**:
- Focus event (tab navigation) → Block silently (no toast)
- Paste event → Prevent silently (copy still works for read-only use)

**Implementation**:

```javascript
const handleIntent = (e) => {
    if (isUnlockable()) return; // Allow

    e.preventDefault();
    if (e.target) e.target.blur();

    // Show toast ONLY for active intent
    if (e.type !== 'focus') {
        showToast("Enter wallet address first", true);
    }
};
```

**Why This Split**:
- Intent actions → User CHOSE to interact → Deserves feedback
- Passive actions → System-driven (tab, autofocus) → Silent block avoids spam

### Why Paste is Blocked but Copy Allowed

**Security & Correctness Rationale**:

1. **Paste is Blocked**:
   - Pasted data may contain:
     - Scientific notation (1e-7)
     - Thousands separators (1,000.50)
     - Non-numeric chars ($ 100.00)
   - Sanitization is complex and error-prone
   - Simpler to block and force manual typing (verified by keydown filters)

2. **Copy is Allowed**:
   - Read-only operation
   - User may need to copy amount for external verification
   - Industry standard (MetaMask, Coinbase allow copy)

**Trade-off Accepted**:
- Slight UX friction (no paste) for guaranteed data integrity

### Why Neutral State ("— —") Exists

**Problem**: Empty input fields in fintech UI create ambiguity.

| Display | Interpretation | User Confusion |
|---------|----------------|----------------|
| ` ` (empty) | Not loaded? Bug? Zero? | High |
| `0` | Zero value OR placeholder? | Medium |
| `— —` | Explicitly neutral, awaiting input | Low |

**Neutral State Rules**:

1. **Trigger Conditions**:
   - No wallet address entered
   - No amount entered
   - Price data not loaded

2. **Visual Encoding**:
   - Asset display shows "— —"
   - `.state-neutral` class adds opacity, monospace font
   - Asset unit label hidden

3. **Exit Conditions**:
   - Valid address entered + amount \u003e 0
   - Derived value calculated

**Code Path**:

```javascript
if ((!fiatVal || parseFloat(fiatVal) === 0) && !VALIDATION_STATE.isAddressValid) {
    setVisualValue(assetDisplay, null, true); // isNeutral = true
}
```

**Why NOT "0.00"**:
- "0.00" implies mathematical zero (valid amount)
- "— —" implies "not yet determined" (system state)

---

## 7. NON-GOALS (IMPORTANT)

### What This System Intentionally Does NOT Handle

**Transaction Execution**:
- Does NOT sign transactions
- Does NOT submit to blockchain
- Does NOT manage private keys
- Dry-run only: Prepares TX object, logs to console

**Balance Validation**:
- Does NOT check user wallet balance
- Does NOT prevent overdraft
- Assumes external wallet connection handles this

**Fraud & Risk**:
- Does NOT detect phishing addresses
- Does NOT flag high-risk transactions
- Does NOT implement rate limiting

**Network/Chain Integration**:
- Does NOT query blockchain state
- Gas prices are STUBBED (fetchGasPrice returns hardcoded values)
- Asset prices are STUBBED (fetchAssetPrice returns hardcoded values)

**Multi-Asset Send**:
- Single asset per transaction only
- Does NOT support ERC-20 token selection
- Chain detection = address format detection (simple heuristic)

**Decimal Precision Beyond Display**:
- Displays 6-8 decimals max
- Does NOT preserve full on-chain precision (e.g., ETH has 18 decimals)
- This is a DISPLAY-layer decision (business logic must handle full precision)

**Internationalization**:
- USD-only fiat currency
- English-only error messages
- No locale-specific number formatting

**Accessibility**:
- contenteditable has limited screen reader support
- No ARIA labels on dynamic toast messages
- Slider is mouse/touch only (no keyboard alternative)

### Why These Are Non-Goals

**Current Scope**: UI/UX prototype for Send flow demonstration.

**Production Requirements** (not implemented):
1. Wallet SDK integration (MetaMask, WalletConnect)
2. Real-time price feeds (Coingecko, Chainlink)
3. Gas estimation APIs (Etherscan, Infura)
4. Transaction signing (ethers.js, web3.js)
5. Balance queries (RPC nodes)
6. Error recovery (retry logic, fallbacks)

**Intentional Simplification**:
- Allows focus on fintech UX patterns without blockchain complexity
- Makes code auditable for financial correctness principles
- Permits unit testing without mock blockchain infrastructure

---

## SYSTEM INTEGRITY CHECKLIST

For any future modifications, verify these invariants hold:

- [ ] Authoritative input is NEVER overwritten by system
- [ ] String → Number conversion happens ONLY in AmountEngine
- [ ] updateAmountMirror() respects focus-based write barriers
- [ ] beforeinput prevents (not truncates) 18th digit
- [ ] Scientific notation is stripped before display
- [ ] Paste is blocked on both USD and Asset inputs
- [ ] Neutral state appears when address invalid AND amount zero
- [ ] Slider cannot drag without valid address
- [ ] APP_STATE is a mirror (read by validation, written by UI events)
- [ ] AmountEngine has zero side effects (pure functions only)

**Violation Detection**:
- Enable debug flags: `window.__DEBUG_SEND__ = true`
- Check console for state mutation warnings
- Verify caret position after updateAmountMirror()
- Test 17-digit precision boundary

---

**END OF SYSTEM CONTRACT SNAPSHOT**
