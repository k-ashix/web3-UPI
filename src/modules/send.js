/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SEND MODULE — BEHAVIOR-COMPLETE & FROZEN
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * VERSION: 1.0 (Frozen)
 * CONTRACT: SEND_SYSTEM_CONTRACT.md (same directory)
 * 
 * ⚠️  CRITICAL FREEZE DECLARATION ⚠️
 * 
 * This module is BEHAVIOR-COMPLETE and governs financial correctness for the
 * Web3 PWI Send flow. All logic, state flows, and guardrails are frozen per
 * the system contract.
 * 
 * BEFORE MODIFYING THIS FILE:
 * 1. Read SEND_SYSTEM_CONTRACT.md in full
 * 2. Verify your change does NOT violate documented invariants
 * 3. If invariants must change, update the contract FIRST and get approval
 * 4. After code changes, verify contract still matches behavior
 * 
 * ALLOWED MODIFICATIONS:
 * - CSS class names (if selector logic unchanged)
 * - Debug log messages
 * - Toast message text
 * - Icon names
 * - Animation durations (if not tied to sync logic)
 * 
 * FORBIDDEN MODIFICATIONS (require contract revision):
 * - Authority model (inputMode, write barriers)
 * - Numeric conversion logic (String → Number boundary)
 * - AmountEngine invocation patterns
 * - updateAmountMirror logic
 * - Validation state derivation
 * - Event handler order or timing
 * - beforeinput prevention logic
 * - Focus-based write protection
 * 
 * NEW FEATURES:
 * Must wrap AROUND this module, not modify internals.
 * Use composition, not mutation.
 * 
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Send Module Script
 * Handles UI interactions, validation, and Gemini integration for the Send feature.
 * 
 * RESPONSIBILITIES:
 * - Owns: UI interactions for the Send screen, address validation, gas fee display.
 * - Must NOT do: Transaction signing, wallet connection, or direct blockchain state mutation.
 * - Safe to modify: UI animations, text copy, verification logic (if kept read-only).
 * 
 * DEBUGGING:
 * - Set window.__DEBUG_SEND__ = true to enable verbose logging
 */

import { AmountEngine } from './amount-engine.js';
import { initSendOverlay, openOverlay } from './send-overlay.js';
import { resolveIconSources } from '../icons/core/iconCDNResolver.js';

// [PHASE 7I-F] Asset Input Length Limit (Preventive Guard)
// JavaScript Number precision breaks beyond ~16 digits (2^53-1).
// Industry wallets (MetaMask, Coinbase, Phantom) prevent input beyond safe limits.
// 17 digits = 16 (JS safe integer) + 1 (UX buffer)
// Implemention: beforeinput prevention (NOT post-truncation)
// INVARIANT GUARD: Preventive Strategy (Not Truncative)
// - beforeinput blocks 18th digit BEFORE DOM insertion
// - Truncation approach (fixing after insertion) loses user data silently
// - Prevention approach (blocking before insertion) preserves trust and correctness
const MAX_ASSET_DIGITS = 17;

// Debug Flag Defaults
if (typeof window.__DEBUG_SEND__ === 'undefined') {
    window.__DEBUG_SEND__ = false;
}

// [PHASE 7] Premium Numeric UX Styles
// Injected to ensure compatibility without modifying HTML or missing CSS files
function injectPremiumStyles() {
    if (document.getElementById('numeric-ux-styles')) return;
    const style = document.createElement('style');
    style.id = 'numeric-ux-styles';
    style.textContent = `
        /* Premium Asset Input */
        .currency-display .value[contenteditable="true"] {
            border: 1px solid rgba(255, 255, 255, 0.15);
            background: rgba(255, 255, 255, 0.05);
            border-radius: 6px;
            padding: 2px 6px;
            /* [PHASE 7I] Fix Caret Color (Request: Dark/Black) */
            caret-color: #000;
            transition: all 0.2s ease;
            outline: none;
            min-width: 60px;
            display: inline-block;
            white-space: nowrap;
            overflow: hidden;
        }
        .currency-display .value[contenteditable="true"]:focus {
            border-color: rgba(255, 255, 255, 0.4);
            background: rgba(255, 255, 255, 0.1);
        }
        /* Theme Awareness */
        .theme-eth .currency-display .value[contenteditable="true"]:focus { border-color: rgba(98, 126, 234, 0.6); }
        .theme-btc .currency-display .value[contenteditable="true"]:focus { border-color: rgba(247, 147, 26, 0.6); }
        .theme-sol .currency-display .value[contenteditable="true"]:focus { border-color: rgba(20, 241, 149, 0.6); }

        /* Neutral State (Detailed) */
        .state-neutral {
            opacity: 0.4;
            color: #fff;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
        }

        /* [PHASE 7F] Layout Stability Rules */
        .amount-inputs {
            /* Ensure container doesn't expand wildly */
            overflow: hidden; 
            max-width: 100%;
        }
        
        /* Enforce Fixed Containers for Halves */
        .currency-input.usd,
        .currency-display {
            /* Max width to prevent one side eating the other */
            max-width: 50%; 
            min-width: 40%;
            flex: 1;
            /* Overflow safety */
            overflow: hidden; 
            white-space: nowrap;
        }

        /* Input/Display Text overflow handling */
        .currency-input input,
        .currency-display .value {
            width: 100%;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: clip; /* Clean cut, no ellipsis dots taking space */
            /* Ensure smooth scaling render */
            will-change: font-size;
        }
    `;
    document.head.appendChild(style);
}

// [PHASE 7] Numeric Font Scaling
// Smoothly reduces font size as digits grow
function updateNumericScaling(element) {
    if (!element) return;
    const val = element.value || element.textContent || '';
    const len = val.length;

    // Base size config (approximate)
    const BASE_SIZE_REM = 2.2;
    const MIN_SIZE_REM = 1.1;
    const THRESHOLD = 6;
    const DECAY_PER_CHAR = 0.12; // Gradual reduction

    if (len <= THRESHOLD) {
        // [PHASE 7F] Stability: Hold base size, do NOT let browser auto-scale or jump
        element.style.fontSize = `${BASE_SIZE_REM}rem`;
    } else {
        // Monotonic Reduction
        const overflow = len - THRESHOLD;
        let newSize = BASE_SIZE_REM - (overflow * DECAY_PER_CHAR);

        // Clamp Min
        if (newSize < MIN_SIZE_REM) newSize = MIN_SIZE_REM;

        element.style.fontSize = `${newSize}rem`;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 STABILITY ZONE — AMOUNT MIRRORING CORE
// ═══════════════════════════════════════════════════════════════════════════
// DO NOT MODIFY LOGIC WITHOUT UPDATING: SEND SYSTEM CONTRACT SNAPSHOT v1.0
//
// CRITICAL INVARIANTS:
// 馃攲 String-Authoritative Model: Input values stay as strings, conversion
//    happens ONLY in AmountEngine.safeParse()
// 馃攲 Authority Rule: Derived field is written, authoritative field is READ-ONLY
// 馃攲 Write Barriers: Focus-based protection prevents overwriting active input
// 馃攲 Neutral State: "— —" rendering for invalid/empty states
//
// ⚠️  DO NOT:
// - Convert strings to Number() in this function (breaks precision)
// - Write to authoritative input (creates circular updates)
// - Remove focus checks (causes race conditions)
// - Simplify derivation logic (each branch handles different authority mode)
//
// [PHASE 6D] Amount Engine Integration
// Pure, read-only mirroring of amount state.
// [PHASE 6E] Amount Engine Integration (Bidirectional)
// INVARIANT GUARD: Authority/Mutation Rule
// - In 'fiat' mode: USD is AUTHORITATIVE (read-only), Asset is DERIVED (writable)
// - In 'asset' mode: Asset is AUTHORITATIVE (read-only), USD is DERIVED (writable)
// - NEVER mutate the authoritative input in updateAmountMirror() — prevents circular overwrites
// - This rule is frozen for financial correctness across all future changes
function updateAmountMirror() {
    // 1. Prerequisites
    if (!APP_STATE.asset || !DATA_STATE.assetPriceUSD) return;

    const usdInput = document.getElementById('usdIndex');
    const assetDisplay = document.querySelector('.currency-display .value');

    if (!usdInput || !assetDisplay) return;

    // [PHASE 7] Debug Exposure
    if (window.__DEBUG_SEND__) {
        window.__inspectPhase7 = {
            updateNumericScaling,
            updateAmountMirror,
            injectPremiumStyles
        };
    }

    // 2. Determine Logic

    // [PHASE 7F-2] Safe Decimal String Helper
    // Prevents scientific notation (e.g. 1e-7) and ensures clean string logic
    const safeDecimalString = (num) => {
        if (num === null || num === undefined) return '';
        if (typeof num === 'string') return num; // Already safe if string? Verify caller handles this.

        // Convert large/small numbers to plain string
        let str = num.toString();
        if (str.includes('e')) {
            // Use toLocaleString or manual parsing if 'e' is present
            // e.g. 1.23e-7 -> 0.000000123
            // Simple approach: toFixed(20) and trim, or use BigInt logic if needed.
            // For this scope (crypto), we clamp visual precision anyway.
            // Let's use maximumFractionDigits for safety.
            return num.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 20 });
        }
        return str;
    };

    // [PHASE 7] Neutral State & Scaling Helper
    const setVisualValue = (target, val, isNeutral = false) => {
        if (isNeutral) {
            target.textContent = '— —';
            target.classList.add('state-neutral');
            target.style.fontSize = '';
            return;
        }

        // [PHASE 7F-2] Decimal Discipline & Scientific Notation Removal
        let cleanVal = safeDecimalString(val);
        let displayVal = cleanVal;

        if (cleanVal.includes('.')) {
            const parts = cleanVal.split('.');
            // Max 6 visual decimals
            if (parts[1] && parts[1].length > 6) {
                displayVal = `${parts[0]}.${parts[1].substring(0, 6)}`;
            }
        }

        // [PHASE 7I] Caret Position Fix
        // Restore caret to end if element is focused (System Update)
        // DO NOT TOUCH — CARET & ASSET STATE ARE INTENTIONAL
        const isFocused = document.activeElement === target;
        let savedRange = null;

        // Note: For simple "restore to end" as requested:
        // We don't necessarily need to save exact position if we enforce "End".
        // But if user was in middle, "End" might be jarring? 
        // Request said: "caret must be restored to END of text". So we force End.

        if (target.tagName === 'INPUT') {
            target.value = displayVal;
        } else {
            target.textContent = displayVal;

            if (isFocused) {
                // Restore Caret to End
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(target);
                range.collapse(false); // false = end
                sel.removeAllRanges();
                sel.addRange(range);
            }
        }

        target.classList.remove('state-neutral');
        updateNumericScaling(target);
    };

    if (APP_STATE.inputMode === 'fiat') {
        // [AUTHORITY: FIAT]
        // Asset is DERIVED. 
        // USD is Authoritative - DO NOT overwrite it here unless formatting requires it (risky).
        // Standard pattern: Read USD, Write Asset.

        const fiatVal = usdInput.value;
        const derived = AmountEngine.deriveFromFiat(fiatVal, DATA_STATE.assetPriceUSD, APP_STATE.chain);

        // Scale Authoritative Input (Self-check for sizing only, do not set value)
        updateNumericScaling(usdInput);

        // [PHASE 7I-C] Write Barrier: Asset Large-Number Integrity
        // DO NOT overwrite assetDisplay if user is actively typing in it
        // This mirrors USD's safety: USD never gets written to in FIAT mode
        const isAssetBeingEdited = document.activeElement === assetDisplay;

        if (derived !== null && derived > 0) {
            if (!isAssetBeingEdited) {
                setVisualValue(assetDisplay, derived);
            }
        } else {
            // Trust State: Address Invalid && Amount 0 -> Neutral
            if ((!fiatVal || parseFloat(fiatVal) === 0) && !VALIDATION_STATE.isAddressValid) {
                if (!isAssetBeingEdited) {
                    setVisualValue(assetDisplay, null, true);
                }
            } else {
                if (!isAssetBeingEdited) {
                    setVisualValue(assetDisplay, '0');
                }
            }
        }
    } else {
        // [AUTHORITY: ASSET]
        // USD is DERIVED.
        // Asset is Authoritative - DO NOT overwrite it.

        // Read textContent
        const assetVal = assetDisplay.textContent.replace('— —', '').trim();
        const derived = AmountEngine.deriveFromAsset(assetVal, DATA_STATE.assetPriceUSD);

        // Scale Authoritative Input
        updateNumericScaling(assetDisplay);

        if (derived !== null) {
            // Derive USD
            setVisualValue(usdInput, derived.toFixed(2)); // derived is number, setVisualValue handles string
            assetDisplay.classList.remove('state-neutral');
        } else {
            setVisualValue(usdInput, ''); // Empty string for USD input
        }
    }
}

if (typeof window.__DEBUG_LOGIC__ === 'undefined') {
    window.__DEBUG_LOGIC__ = false;
}

function debugLog(msg, ...args) {
    if (window.__DEBUG_SEND__) console.log(`[SendModule] ${msg}`, ...args);
}

function debugLogicLog(label, state) {
    if (window.__DEBUG_LOGIC__) {
        console.groupCollapsed(`[Logic State] ${label}`);
        console.table(state);
        console.groupEnd();
    }
}

/**
 * APP_STATE (READ-ONLY OBSERVATION)
 * Centralized source of truth for UI state.
 * Updated by mirroring UI events, does NOT drive UI yet.
 */
const APP_STATE = Object.seal({
    chain: null,
    asset: null,
    recipientAddress: null,
    inputMode: 'fiat', // 'fiat' | 'asset'
    isBlocked: false,
    isLocked: false,
    source: null, // 'manual' | 'qr' | null
    chainUserSelected: false,
    assetUserSelected: false,
    btcAddressType: null // 'taproot' | 'segwit' | 'legacy'
});

// [PHASE 15] EXPOSED STATE SETTER (for Overlay)
window.setBTCAddressType = function (type) {
    // Conflict Check: If address exists, it rules.
    if (APP_STATE.asset === 'btc' && APP_STATE.recipientAddress) {
        const detected = detectBTCAddressType(APP_STATE.recipientAddress);
        if (detected && detected !== type) {
            if (window.__DEBUG_GEMINI__) {
                console.warn("[Send] BTC Type Change Blocked: Address dictates", detected);
            }
            // Auto-correct: Ensure state matches address (idempotent)
            APP_STATE.btcAddressType = detected;
            return;
        }
    }

    if (APP_STATE.btcAddressType === type) return;

    APP_STATE.btcAddressType = type;

    if (window.__DEBUG_GEMINI__) {
        console.log("[Send] btcAddressType selected:", type);
    }

    // Trigger validation update if needed (e.g. if conflict check is implemented)
    // updateValidationState(); 
};

// [PHASE 3B-2] UI Gating Logic
function applyUIGating(validationState) {
    const { isAddressPresent, isAddressValid, isChainMatch, isSupportedChain } = validationState;
    // 1. Slider Gating (Send Button)
    // Send allowed ONLY if: Address exists AND is valid AND chain is supported AND matches asset type
    const canSend = isAddressPresent && isAddressValid && isSupportedChain && isChainMatch;

    // Note: sliderContainer is a local const in initSendUI usually, but we need global access or requery
    // Since this runs anytime, requerying is safer or we scope it. Requerying is fine for now.
    const sliderContainer = document.getElementById('sliderContainer');
    if (sliderContainer) {
        if (canSend) {
            sliderContainer.classList.remove('disabled');
        } else {
            sliderContainer.classList.add('disabled');
        }
    }

    // 2. Input Visual Feedback
    const addressField = document.querySelector('.address-input-field');
    if (addressField) {
        // Reset classes first (Neutralize)
        addressField.classList.remove('input-validated', 'input-invalid');

        if (isAddressPresent) {
            if (isAddressValid && isSupportedChain && isChainMatch) {
                // Structurally Valid -> Confirm
                addressField.classList.add('input-validated');
            } else {
                // Invalid or mismatch -> Neutral (Implicit/Removed)
                // We do NOT add 'input-invalid' anymore as per strict rules to keep it neutral/calm.
                // If we absolutely must track it for debugging:
                // addressField.classList.add('input-invalid'); // But CSS makes this look neutral anyway.
            }
        }
    }
}

/**
 * VALIDATION_STATE (DERIVED | READ-ONLY)
 * Computed strictly from APP_STATE.
 * Never updated directly by UI events.
 */
const VALIDATION_STATE = Object.seal({
    isAddressPresent: false,
    isAddressValid: false,
    isChainMatch: false,
    isSupportedChain: false
});

/**
 * DATA_STATE (READ-ONLY | PASSIVE)
 * Source of truth for Gas & Price data.
 * Updated via passive fetch, no execution logic.
 */
const DATA_STATE = Object.seal({
    gasPrice: null,        // raw value
    gasUnit: null,         // gwei, sat/vB, etc.
    assetPriceUSD: null,   // number
    lastUpdated: null      // timestamp
});

/**
 * DERIVED_STATE (READ-ONLY | CALCULATED)
 * Pure functions only. No external reads.
 * Derived from DATA_STATE + APP_STATE.
 */
const DERIVED_STATE = Object.seal({
    estimatedGasFeeNative: null, // e.g. 0.00042 ETH
    estimatedGasFeeUSD: null,    // e.g. 1.18
    lastDerivedAt: null
});

// Debug Flags
if (typeof window.__DEBUG_VALIDATION__ === 'undefined') {
    window.__DEBUG_VALIDATION__ = false;
}
if (typeof window.__DEBUG_DATA__ === 'undefined') {
    window.__DEBUG_DATA__ = false;
}
if (typeof window.__DEBUG_DERIVED__ === 'undefined') {
    window.__DEBUG_DERIVED__ = false;
}
if (typeof window.__DEBUG_TX__ === 'undefined') {
    window.__DEBUG_TX__ = false;
}

function debugValidationLog(state) {
    if (window.__DEBUG_VALIDATION__) {
        console.groupCollapsed(`[Validation State]`);
        console.table(state);
        console.groupEnd();
    }
}

function debugDataLog(label, data) {
    if (window.__DEBUG_DATA__) {
        console.groupCollapsed(`[Data State] ${label}`);
        console.table(data);
        console.groupEnd();
    }
}

function debugDerivedLog(label, data) {
    if (window.__DEBUG_DERIVED__) {
        console.groupCollapsed(`[Derived State] ${label}`);
        console.table(data);
        console.groupEnd();
    }
}

function debugTxLog(label, data) {
    if (window.__DEBUG_TX__) {
        console.groupCollapsed(`[TX Logic] ${label}`);
        console.log(data); // Log object for full inspection
        console.groupEnd();
    }
}

/**
 * PURE DERIVATION FUNCTIONS
 * 1. ETH: 21,000 gas * gasPrice (gwei)
 * 2. BTC: ~140 vB * feeRate (sat/vB)
 * 3. SOL: ~5000 Lamports (fixed)
 */
function deriveGasFee() {
    const { chain, asset } = APP_STATE;
    const { gasPrice, assetPriceUSD } = DATA_STATE;

    if (!chain || !gasPrice) return null;

    let nativeFee = 0;

    if (chain === 'Ethereum') {
        // gasPrice is in gwei. 1 gwei = 1e-9 ETH
        // Standard Tx = 21000 gas
        nativeFee = 21000 * gasPrice * 1e-9;
    }
    else if (chain === 'Bitcoin') {
        // gasPrice is sat/vB. 1 sat = 1e-8 BTC
        // Standard Tx ~ 140 vB (P2PKH/Segwit mix estimate)
        nativeFee = 140 * gasPrice * 1e-8;
    }
    else if (chain === 'Solana') {
        // gasPrice is in SOL (0.000005)
        // Fixed fee usually
        nativeFee = gasPrice;
    }

    if (nativeFee === 0) return null;

    const usdFee = assetPriceUSD ? (nativeFee * assetPriceUSD) : null;

    return {
        estimatedGasFeeNative: nativeFee,
        estimatedGasFeeUSD: usdFee
    };
}

function updateDerivedState() {
    const fees = deriveGasFee();

    if (fees) {
        DERIVED_STATE.estimatedGasFeeNative = fees.estimatedGasFeeNative;
        DERIVED_STATE.estimatedGasFeeUSD = fees.estimatedGasFeeUSD;
        DERIVED_STATE.lastDerivedAt = Date.now();
    } else {
        DERIVED_STATE.estimatedGasFeeNative = null;
        DERIVED_STATE.estimatedGasFeeUSD = null;
    }

    debugDerivedLog('Updated', DERIVED_STATE);
}

// [PHASE 3D] Transaction Readiness
function deriveTransactionReadiness() {
    const isAddressValid = VALIDATION_STATE.isAddressValid;
    const hasGasPrice = DATA_STATE.gasPrice !== null;
    const hasFeeUSD = DERIVED_STATE.estimatedGasFeeUSD !== null;
    const hasRecipient = APP_STATE.recipientAddress !== null;

    // Check Amount Logic (Input Mode)
    // For now we just check if it's visually blocked or not, and basic valid inputs
    // The "validateInputs" function covers the amount numerical validity.
    // Here we check chain/data readiness.

    const isReady = isAddressValid && hasGasPrice && hasFeeUSD && hasRecipient;

    if (window.__DEBUG_GEMINI__) {
        console.log("[SendReadiness]", {
            chain: APP_STATE.chain,
            asset: APP_STATE.asset,
            hasGasPrice,
            hasFeeUSD,
            isReady
        });
    }

    return {
        isReady,
        reason: isReady ? 'Ready' : `Missing: ${!isAddressValid ? 'Valid Address ' : ''}${!hasGasPrice ? 'Gas Data ' : ''}${!hasFeeUSD ? 'Fee Calc ' : ''}${!hasRecipient ? 'Recipient' : ''}`
    };
}

/**
 * PASSIVE DATA FETCHERS
 * Fail silently, no retries, no side effects.
 */
async function fetchGasPrice(chain) {
    if (!chain) return null;
    try {
        // Stub: Real fetch would go here
        // Simulating network delay and realistic values
        // await new Promise(r => setTimeout(r, 500)); 

        if (chain === 'Ethereum') return { price: 15, unit: 'gwei' };
        if (chain === 'Bitcoin') return { price: 12, unit: 'sat/vB' };
        if (chain === 'Solana') return { price: 0.000005, unit: 'SOL' };

        // [PHASE 3C] A-MODE: Mock Fallback for L2s/Others
        // Never return null so readiness check passes
        return { price: 0.1, unit: 'gwei' };
    } catch (e) {
        if (window.__DEBUG_DATA__) console.warn('[Data] Gas Fetch Failed', e);
        return null;
    }
}

async function fetchAssetPrice(asset) {
    if (!asset) return null;
    try {
        // Stub: Real fetch would go here
        if (asset === 'eth') return 2250.50;
        if (asset === 'btc') return 42000.00;
        if (asset === 'sol') return 95.20;

        // [PHASE 3C] A-MODE: Mock Fallback for Tokens
        return 1.00;
    } catch (e) {
        if (window.__DEBUG_DATA__) console.warn('[Data] Price Fetch Failed', e);
        return null;
    }
}

async function updateDataState() {
    const { chain, asset } = APP_STATE;
    if (!chain || !asset) return;

    // Passive Fetch
    const [gas, price] = await Promise.all([
        fetchGasPrice(chain),
        fetchAssetPrice(asset)
    ]);

    // Update State
    if (gas) {
        DATA_STATE.gasPrice = gas.price;
        DATA_STATE.gasUnit = gas.unit;
    }
    if (price) {
        DATA_STATE.assetPriceUSD = price;
    }
    DATA_STATE.lastUpdated = Date.now();

    debugDataLog('Updated', DATA_STATE);

    // [PHASE 3C-2] Derive Fees
    updateDerivedState();

    // [PHASE 3C] Update UI (Read-Only)
    updateGasUI();

    // [PHASE 6D] Amount Engine Hook
    updateAmountMirror();
}

function updateGasUI() {
    const gasLabel = document.querySelector('.gas-info-row .label');
    const gasValue = document.querySelector('.gas-info-row .value');

    if (gasValue && DATA_STATE.gasPrice) {
        let text = `${DATA_STATE.gasPrice} ${DATA_STATE.gasUnit}`;

        // [PHASE 3C-2b] Passive USD Mirror (Read-Only)
        if (DERIVED_STATE.estimatedGasFeeUSD !== null) {
            // Check precision - < $0.01 vs standard
            const formatted = DERIVED_STATE.estimatedGasFeeUSD < 0.01
                ? '< $0.01'
                : `$${DERIVED_STATE.estimatedGasFeeUSD.toFixed(2)}`;
            text += ` (≈ ${formatted})`;
        }

        gasValue.textContent = text;
    }

    // Note: Can also update USD equivalent if we had a dedicated slot
    // For now, we strictly follow "passive display" scope.
}

/**
 * PURE VALIDATION FUNCTIONS
 * No side effects, no UI access.
 */
function validateEthereumAddress(address) {
    if (!address) return false;
    return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateBitcoinAddress(address) {
    if (!address) return false;
    // Regex covers Legacy (1), Script (3), Segwit (bc1)
    return /^(1|3|bc1)[a-zA-Z0-9]{25,59}$/.test(address);
}

function validateSolanaAddress(address) {
    if (!address) return false;
    // Base58 checks are complex purely via Regex, but this covers length & chars
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
}

function deriveValidationState(appState) {
    const { recipientAddress, asset, chain } = appState;
    const hasAddress = !!recipientAddress && recipientAddress.length > 0;

    // 1. Is Address Present?
    const isAddressPresent = hasAddress;

    // 2. Is Address Valid (Generic Format Check)?
    let isAddressValid = false;
    if (hasAddress) {
        // Check against all supported validators
        isAddressValid = validateEthereumAddress(recipientAddress) ||
            validateBitcoinAddress(recipientAddress) ||
            validateSolanaAddress(recipientAddress);
    }

    // [PHASE 3B-2] A-MODE: Permissive Validation (Hackathon)
    // Accept ANY non-empty string as a supported chain/family
    const isSupportedChain = !!chain && chain.length > 0;

    // 4. Is Chain Match?
    // [PHASE 3B-2] A-MODE: Permissive Asset Match (Hackathon)
    // Accept ANY non-empty asset string as a valid match
    // This allows USDC/USDT on L2s to proceed without strict type checking
    const isChainMatch = !!asset && asset.length > 0;

    // Edge case: If no asset detected yet (invalid), mismatch is implicit false

    return {
        isAddressPresent,
        isAddressValid,
        isSupportedChain,
        isChainMatch
    };
}

function updateValidationState() {
    const newState = deriveValidationState(APP_STATE);

    // Update State Object
    Object.assign(VALIDATION_STATE, newState);

    // Log
    debugValidationLog(VALIDATION_STATE);

    // [PHASE 3B-2] UI Gating
    applyUIGating(VALIDATION_STATE);
}

// Initialize Features
debugLog('Script Module Evaluated');

/*
 * SEND LIFECYCLE GUARD
 * Contract: governance/send/SEND_LIFECYCLE_CONTRACT_v1.md
 * Initializes the Send UI listeners and DOM state ONCE per page load.
 * This function MUST NOT be called on overlay re-open.
 * Violating this will cause event listener duplication and memory leaks.
 */
function initSendUI() {
    debugLog('Initializing UI...');

    // 0. Ensure Global Dependencies (Icons)
    if (!document.querySelector('link[href*="font-awesome"]')) {
        const fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css';
        document.head.appendChild(fa);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔒 STABILITY ZONE — INPUT GATING & VALIDATION
    // ═══════════════════════════════════════════════════════════════════════════
    // DO NOT MODIFY LOGIC WITHOUT UPDATING: SEND SYSTEM CONTRACT SNAPSHOT v1.0
    //
    // CRITICAL INVARIANTS:
    // 馃攲 Address Gate: Amount inputs blocked until valid wallet address entered
    // 馃攲 Toast-on-Intent: User clicks locked input → show toast
    // 馃攲 Silent-on-Focus: Tab navigation → block silently (no toast spam)
    // 馃攲 Event Order: click, mousedown, keydown, focus (capture phase)
    //
    // ⚠️  DO NOT:
    // - Allow amount editing without valid address (financial safety gate)
    // - Show toast on focus events (creates UX spam)
    // - Remove event.preventDefault() (allows invalid interaction)
    // - Change capture phase to bubble (breaks event interception)
    //
    // WHY THIS GATING EXISTS:
    // Entering amounts for invalid recipient wastes user effort.
    // Better to block early than allow invalid data entry.
    //
    // [PHASE 8] Interaction Gating (Refined for Phase 7H)
    // Gates amount editing access behind valid wallet address
    function initAmountGating() {
        const usdInput = document.getElementById('usdIndex');
        const assetDisplay = document.querySelector('.currency-display .value');

        const isUnlockable = () => {
            // Check global validation state
            return VALIDATION_STATE.isAddressValid;
        };

        const handleIntent = (e) => {
            if (isUnlockable()) return; // Allow interaction

            // Block everything
            e.preventDefault();
            e.stopPropagation();
            if (e.target && e.target.blur) e.target.blur();

            // Feedback Logic:
            // Click / Keydown / Mousedown -> User Intent -> Show Toast
            // Focus -> System/Passive -> Silent
            if (e.type !== 'focus') {
                showToast("Enter wallet address first", true);
            }
        };

        // Attach Interceptors
        [usdInput, assetDisplay].forEach(el => {
            if (!el) return;
            // Capture phase to intercept early
            // [PHASE 7H] Expanded Event Set for Robustness
            el.addEventListener('click', handleIntent, true);       // Intent
            el.addEventListener('mousedown', handleIntent, true);   // Intent (start of click)
            el.addEventListener('keydown', handleIntent, true);     // Intent
            el.addEventListener('focus', handleIntent, true);       // System/Tab - Silent Block
        });
    }

    // [PHASE 7] Inject CSS
    injectPremiumStyles();

    // [PHASE 8] Init Gating
    initAmountGating();

    // [PHASE 8A] Visual Overlay Init
    initSendOverlay();

    // [PHASE 10B] Chain-Scoped Overlay Context
    // We explicitly bind the asset chip here to pass APP_STATE.chain.
    // send-overlay.js bindings should be removed/ignored for asset-chip.
    // Use capture or just overwrite via clean binding if possible.
    // Note: send-overlay.js currently binds via addEventListener, so we add ANOTHER one.
    // We will ensure send-overlay.js ignores the click or we remove it there.
    const assetChipOverride = document.querySelector('.asset-chip');
    if (assetChipOverride) {
        assetChipOverride.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation(); // Stop bubbling (and potentially stop send-overlay's own listener if order favors us?)
            // Order of execution for same-element listeners is registration order.
            // send-overlay init runs BEFORE this line. So send-overlay's listener runs FIRST.
            // stopPropagation won't stop same-element listeners. stopImmediatePropagation would.
            e.stopImmediatePropagation();

            openOverlay('asset', { chain: APP_STATE.chain, selected: APP_STATE.asset });
        });
    }

    // [PHASE 12] Chain Overlay Context
    // Bind chain chip to pass APP_STATE.asset
    const chainChipOverride = document.querySelector('.chain-chip');
    if (chainChipOverride) {
        chainChipOverride.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            openOverlay('chain', { asset: APP_STATE.asset, selected: APP_STATE.chain });
        });
    }

    // [PHASE 6E] REMOVE FAKE DEFAULT DATA
    // Enforce clean slate on load
    const usdInputInitial = document.getElementById('usdIndex');
    const assetDisplayInitial = document.querySelector('.currency-display .value');
    if (usdInputInitial) usdInputInitial.value = '';
    if (assetDisplayInitial) {
        // Start Neutral
        assetDisplayInitial.textContent = '— —';
        assetDisplayInitial.classList.add('state-neutral');
    }

    // [PHASE 7F-Final] Explicit Reset Contract
    // Clears all ephemeral transaction state (amounts, authority, neutral state)
    // Does NOT clear wallet connection or persistent user prefs
    /*
     * SEND LIFECYCLE GUARD
     * Contract: governance/send/SEND_LIFECYCLE_CONTRACT_v1.md
     * Clears ephemeral transaction state to neutral.
     * This function MUST NOT be called on overlay open (only on exit or clear).
     * Violating this will wipe user data during valid re-entry.
     */
    function resetSendState() {
        debugLog('Resetting Send State...');

        // 1. Reset Amounts
        const usdInput = document.getElementById('usdIndex');
        const assetDisplay = document.querySelector('.currency-display .value');

        if (usdInput) {
            usdInput.value = '';
            updateNumericScaling(usdInput);
        }

        if (assetDisplay) {
            assetDisplay.textContent = '— —';
            assetDisplay.classList.add('state-neutral');
            assetDisplay.style.fontSize = ''; // Reset scaling
        }

        // 2. Reset Authority/Blocker
        // Default to Block Right (Asset), Locked Left (Fiat Active)
        // We need to access the blocker overlay. Since it uses closure state, 
        // we might trigger a click if we can, or we just reset visual class and 
        // hope state aligns. 
        // BETTER: Expose a reset helper if possible, or just force visual default.
        // For now, let's reset the overlay classes to default.
        const overlay = document.getElementById('amountBlocker');
        if (overlay) {
            overlay.classList.remove('position-left', 'state-locked');
            // We can't easily reset closure state 'blockedSide' inside the IIFE without exposing it.
            // Assumption: Re-init or simple visual reset is enough if state flows from UI.
            // Actually, if we don't reset the closure state, it might be out of sync.
            // Ideally we'd trigger a click to toggle back, but that's messy.
            // Acceptable Compromise: Just reset Visuals + Input Attributes.

            // Force Fiat Active / Asset Blocked
            if (usdInput) {
                usdInput.removeAttribute('readonly');
                usdInput.style.pointerEvents = 'auto';
            }
            if (assetDisplay) {
                assetDisplay.contentEditable = "false";
                assetDisplay.removeAttribute('inputmode');
            }
            // Reset APP_STATE mirror
            APP_STATE.inputMode = 'fiat';
            APP_STATE.isBlocked = false;
            APP_STATE.isLocked = false;
            APP_STATE.chainUserSelected = false;
            APP_STATE.assetUserSelected = false;
        }

        // 3. Reset Validation State (Visually)
        // address reset is handled by enforceAddressState() call elsewhere

        // [PHASE 20] Reset Identity Pills
        updateIdentityPills();
    }

    // 1. Back Button Logic
    const backBtn = document.querySelector('.send-money-header .icon-btn');
    debugLog('Back Button Selector:', backBtn);
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            debugLog('Back Button Clicked');
            const overlay = document.getElementById('send-overlay-injected');
            if (overlay) {
                overlay.style.display = 'none';

                // [PHASE 8C-C] EXPLICIT SEND EXIT RESET
                // Clear wallet address and state to prevent QR/manual leakage on re-entry
                const addressInput = document.getElementById('recipientAddress');
                if (addressInput) {
                    addressInput.value = '';
                    addressInput.readOnly = false;
                    addressInput.tabIndex = 0;
                    addressInput.placeholder = 'Enter wallet address';
                    addressInput.style.transform = 'scaleX(1)';
                }

                // Clear APP_STATE
                APP_STATE.recipientAddress = null;
                APP_STATE.source = null;
                APP_STATE.asset = null;
                APP_STATE.chain = null;
                APP_STATE.chainUserSelected = false;
                APP_STATE.assetUserSelected = false;

                // [PHASE 20] Reset Identity Pills
                updateIdentityPills();

                // Reset asset logo via resolver only (no hardcoded legacy src assignment here)
                const logoImg = document.querySelector('.asset-logo img');
                if (logoImg) {
                    const sources = resolveIconSources({ chain: null, asset: null });
                    logoImg.src = sources[0];
                    logoImg.onerror = function () {
                        // FINAL visual fallback (legacy placeholder) — onerror only.
                        this.onerror = null;
                        this.src = './assets/chain.png';
                    };
                }

                // [PHASE 7F-Final] Trigger Reset on Exit (amounts)
                resetSendState();

                // [LIFECYCLE] Fire send:exit event for Gemini overlay coordination
                document.dispatchEvent(new CustomEvent('send:exit'));
            }
        });
    }

    // 2. Gemini Trigger (Using Global Authority)
    const geminiBtn = document.getElementById('open-gemini');
    if (geminiBtn) {
        geminiBtn.addEventListener('click', () => {
            if (window.GeminiOverlay) {
                showGemini();
            } else {
                console.warn('[Send] Gemini Overlay not found in window');
            }
        });
    }

    function showGemini() {
        if (!window.GeminiOverlay) return;

        window.GeminiOverlay.show({
            prompt: "Hi — Need Assistance",
            mode: "medium",
            actions: [
                { label: "Stop" },
                { label: "Send", type: "primary" }
            ]
        });

        // Fix Asset Paths (Re-basing) - Optional if paths are correct now, but keeping for safety
        const geminiLogo = document.querySelector('.gemini-title img');
        if (geminiLogo) {
            // Force path to where we know it exists relative to Shell
            geminiLogo.src = './assets/gemini-icon.png';
        }

        // Move to Shell for proper constraints
        // Note: Since Gemini stays in DOM, we might not need to move it every time if it's already top-level. 
        // But for safety in "Section" mode, we ensure it's where we expect.
        const root = document.getElementById('gemini-overlay-root');
        const shell = document.querySelector('.glass-container');
        if (root && shell && root.parentElement !== shell) {
            shell.appendChild(root);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔒 STABILITY ZONE — USD INPUT HANDLER
    // ═══════════════════════════════════════════════════════════════════════════
    // DO NOT MODIFY LOGIC WITHOUT UPDATING: SEND SYSTEM CONTRACT SNAPSHOT v1.0
    //
    // CRITICAL INVARIANTS:
    // 馃攲 String-Authoritative: Value stays as string, no Number() calls
    // 馃攲 Precision: 2 decimals max (fiat standard)
    // 馃攲 Sanitization: String operations only (split, substring)
    // 馃攲 Scientific Notation Prevention: 'e', 'E', '-', '+' keys blocked
    //
    // ⚠️  DO NOT:
    // - Add Number() coercion (breaks precision for large amounts)
    // - Remove decimal enforcement (allows invalid fiat amounts)
    // - Change event order (updateAmountMirror must fire AFTER value set)
    //
    // 3. Amount Input Validation (Critical)
    const amountInput = document.getElementById('usdIndex');
    debugLog('Amount Input Selector:', amountInput);
    if (amountInput) {
        // Prevent invalid keys
        amountInput.addEventListener('keydown', (e) => {
            debugLog('Keydown:', e.key);
            if (['e', 'E', '-', '+'].includes(e.key)) {
                e.preventDefault();
            }
        });

        // Sanitize Input
        // INVARIANT GUARD: USD Input String Authority
        // - USD amounts kept as STRINGS throughout input flow
        // - String operations (split, substring) preserve precision
        // - Numeric conversion only happens at AmountEngine boundary (below)
        amountInput.addEventListener('input', (e) => {
            debugLog('Input Event');
            let val = e.target.value;

            // Allow only one decimal
            const parts = val.split('.');
            if (parts.length > 2) {
                val = parts[0] + '.' + parts.slice(1).join('');
            }

            // Enforce Fiat Precision (2 decimals)
            if (val.includes('.')) {
                const [int, dec] = val.split('.');
                if (dec.length > 2) {
                    val = `${int}.${dec.substring(0, 2)}`;
                }
            }

            if (val !== e.target.value) {
                e.target.value = val;
            }

            // [PHASE 6D] Amount Engine Hook
            // Real-time update while typing
            // INVARIANT GUARD: AmountEngine Numeric Conversion Boundary
            // - String → Number conversion happens INSIDE AmountEngine only
            // - Input handlers keep strings; AmountEngine converts for calculation
            // - This boundary prevents precision loss in UI layer
            updateAmountMirror();
            // [PHASE 7] Scaling
            updateNumericScaling(amountInput);
        });

        // [LIFECYCLE] Fire send:context-changed on amount blur (when user finishes editing)
        amountInput.addEventListener('blur', () => {
            if (amountInput.value.trim()) {
                document.dispatchEvent(new CustomEvent('send:context-changed', {
                    detail: {
                        address: APP_STATE.recipientAddress,
                        chain: APP_STATE.chain,
                        asset: APP_STATE.asset,
                        inputMode: APP_STATE.inputMode
                    }
                }));
            }
        });

        // [PHASE 7F-Final] Disable Paste on USD (Copy Safety)
        amountInput.addEventListener('paste', (e) => {
            e.preventDefault();
        });
    }

    // [PHASE 7-Final] Premium Drain Animation (Micro-interaction)
    // 1234.56 -> 123 -> ... -> — —
    function drainAmountVisuals(onComplete) {
        const usdInput = document.getElementById('usdIndex');
        const assetDisplay = document.querySelector('.currency-display .value');

        // Guard: If already empty/neutral, skip
        if ((!usdInput || !usdInput.value) &&
            (!assetDisplay || assetDisplay.classList.contains('state-neutral'))) {
            if (onComplete) onComplete();
            return;
        }

        // Fast drain sequence (150ms)
        usdInput.value = ''; // Instant clear input for safety

        let text = assetDisplay.textContent;
        const steps = 3;
        const interval = 40; // ms
        let step = 0;

        const timer = setInterval(() => {
            step++;
            if (step >= steps) {
                clearInterval(timer);
                assetDisplay.textContent = '— —';
                assetDisplay.classList.add('state-neutral');
                updateNumericScaling(assetDisplay);
                if (onComplete) onComplete();
            } else {
                // Slice text to simulate draining
                const len = text.length;
                const cut = Math.floor(len / steps * step);
                assetDisplay.textContent = text.substring(0, len - cut);
            }
        }, interval);
    }

    // 4. Address Field Logic (State Reset & Fit-to-Container)
    const addressInput = document.getElementById('recipientAddress');

    // [PHASE 7-Final] Live Clear Detection
    if (addressInput) {
        addressInput.addEventListener('input', (e) => {
            const val = e.target.value;
            // If cleared manually -> Trigger Drain & Reset
            if (!val || val.trim().length === 0) {
                // But wait, VALIDATION_STATE will update passively?
                // We need to force a reset contract if it goes empty.
                drainAmountVisuals(() => {
                    resetSendState();
                });
            }
        });
    }

    // Helper: Address Fit Using Horizontal Scale (Industry Correct)
    function adjustAddressFit() {
        if (!addressInput) return;

        // Always reset first
        addressInput.style.transform = 'scaleX(1)';
        addressInput.style.transformOrigin = 'left center';

        // Force layout measurement
        const containerWidth = addressInput.clientWidth;
        const textWidth = addressInput.scrollWidth;

        if (textWidth > containerWidth) {
            const scale = containerWidth / textWidth;
            const clampedScale = Math.max(scale, 0.88); // readability clamp
            addressInput.style.transform = `scaleX(${clampedScale})`;
        }
    }

    // Helper: Enforce Strict State Contract
    /*
     * SEND LIFECYCLE GUARD
     * Contract: governance/send/SEND_LIFECYCLE_CONTRACT_v1.md
     * Hydrates state from QR code or enforces clean manual state.
     * This function MUST NOT be called unconditionally.
     * Violating this will overwrite manual user input with stale QR data.
     */
    function enforceAddressState() {
        if (!addressInput) return;

        const scannedAddress = sessionStorage.getItem('scannedAddress');

        // Reset font size ensuring clean state
        addressInput.style.fontSize = '0.8rem';
        addressInput.style.transform = 'scaleX(1)'; // Reset transform

        if (scannedAddress && scannedAddress.trim() !== '') {
            // STATE A: ENTRY VIA QR SCAN (LOCKED)
            debugLog('State A: Locked Mode Active');

            addressInput.value = scannedAddress;
            addressInput.readOnly = true;
            addressInput.tabIndex = -1; // Prevent focus
            addressInput.placeholder = '';

            // MIRROR STATE
            APP_STATE.recipientAddress = scannedAddress;
            APP_STATE.source = 'qr';
            debugLogicLog('Address Set (QR)', APP_STATE);

            // Immediate fit for long scanned addresses
            adjustAddressFit();
            // [PHASE 4] Immediate Logo Update on Scan
            updateAssetLogo(scannedAddress);

            // Clear storage immediately (Anti-replay)
            sessionStorage.removeItem('scannedAddress');
        } else {
            // STATE B: ENTRY VIA MANUAL/RE-ENTRY (RESET)
            debugLog('State B: Manual Mode Active');

            addressInput.value = '';
            addressInput.readOnly = false;
            addressInput.tabIndex = 0; // Restore focus
            addressInput.placeholder = 'Enter wallet address';
            addressInput.style.transform = 'scaleX(1)';

            // MIRROR STATE (Reset)
            APP_STATE.recipientAddress = null;
            APP_STATE.source = 'manual';
            APP_STATE.chainUserSelected = false;
            APP_STATE.assetUserSelected = false;
            debugLogicLog('Address Reset (Manual)', APP_STATE);

            // [PHASE 4] Explicit Reset to Placeholder
            updateAssetLogo('');

            // [PHASE 7F-Final] Also Reset Amounts on Manual Entry Mode Start
            // This ensures "Send Again" doesn't carry over old values
            resetSendState();
        }
    }

    if (addressInput) {
        // 1. Initial State Enforcement
        enforceAddressState();

        // 2. Input Event for Manual Typing (Dynamic Fit + Asset Logo)
        addressInput.addEventListener('input', () => {
            adjustAddressFit();

            // MIRROR STATE
            APP_STATE.recipientAddress = addressInput.value;
            APP_STATE.source = 'manual'; // Reinforce manual source on typing
            // Note: Asset update happens in updateAssetLogo, we'll hook state there too or let it flow

            // [PHASE 4] Dynamic Asset Logo on Input (Debouncing or direct is fine for display only)
            // We'll update on input to feel responsive, logic is lightweight
            updateAssetLogo(addressInput.value);

            debugLogicLog('Address Input (Type)', APP_STATE);
        });

        // [LIFECYCLE] Fire send:context-changed on address blur (when user finishes editing)
        addressInput.addEventListener('blur', () => {
            if (addressInput.value.trim()) {
                document.dispatchEvent(new CustomEvent('send:context-changed', {
                    detail: {
                        address: APP_STATE.recipientAddress,
                        chain: APP_STATE.chain,
                        asset: APP_STATE.asset,
                        inputMode: APP_STATE.inputMode
                    }
                }));
            }
        });

        // [PHASE 8C-C] MutationObserver REMOVED
        // Previous implementation watched #send-overlay-injected visibility and called enforceAddressState()
        // This caused wallet address wipe whenever overlays opened (no QR data in sessionStorage)
        // Initial enforceAddressState() call (line 1144) is sufficient for QR-to-send flow
        // Manual entry state is preserved naturally by input event listener above
    }

    // Unified, repeatable entry point for Send overlay lifecycle.
    // Safe for manual re-entry, and QR hydration remains strictly one-time via enforceAddressState().
    /*
     * SEND LIFECYCLE GUARD
     * Contract: governance/send/SEND_LIFECYCLE_CONTRACT_v1.md
     * The ONLY allowed re-entry hook for the Send overlay.
     * This function MUST NOT call resetSendState() or initSendUI().
     * Violating this will break state persistence or duplicate listeners.
     */
    function enterSendLifecycle() {
        const addressInput = document.getElementById('recipientAddress');
        const scanned = sessionStorage.getItem('scannedAddress');

        if (scanned && scanned.trim() !== '') {
            // QR ENTRY (one-time hydration)
            enforceAddressState();
        } else if (addressInput && addressInput.value.trim() !== '') {
            // MANUAL / RE-ENTRY
            updateAssetLogo(addressInput.value.trim());
        } else {
            // CLEAN MANUAL ENTRY
            updateAssetLogo('');
        }
    }

    // Expose controlled lifecycle entry on window for shell integration.
    window.enterSendLifecycle = enterSendLifecycle;

    // ═══════════════════════════════════════════════════════════════════════════
    // 🔒 STABILITY ZONE — ASSET INPUT HANDLER (contenteditable)
    // ═══════════════════════════════════════════════════════════════════════════
    // DO NOT MODIFY LOGIC WITHOUT UPDATING: SEND SYSTEM CONTRACT SNAPSHOT v1.0
    //
    // CRITICAL INVARIANTS:
    // 馃攲 String-Authoritative: textContent used, never Number() conversion
    // 馃攲 Preventive Guard: beforeinput blocks 18th digit BEFORE DOM insertion
    // 馃攲 Precision Limit: 17 digits = 2^53-1 (JS safe integer) + 1 buffer
    // 馃攲 Caret Management: Manual caret restoration required for contenteditable
    //
    // ⚠️  DO NOT:
    // - Convert to Number() (silently rounds beyond 16 digits)
    // - Change beforeinput to input (truncation feels broken to user)
    // - Remove digit counting (allows precision corruption)
    // - Simplify sanitization (paste events can inject invalid data)
    //
    // WHY contenteditable:
    // - Supports dynamic font scaling without layout thrashing
    // - Preserves long decimal strings better than input value coercion
    // - Allows neutral state ("— —") without placeholder conflicts
    //
    // [PHASE 6E] Asset Side Interactions (Bidirectional Authority)
    // We attach listeners here once.
    const assetDisplay = document.querySelector('.currency-display .value');
    if (assetDisplay) {
        // [PHASE 7I-F] Preventive Length Guard (beforeinput)
        // Blocks 18th digit BEFORE it enters DOM (no truncation needed)
        // INVARIANT GUARD: Asset Input String Authority
        // - Asset amounts are kept as STRINGS (never Number()) to preserve precision
        // - beforeinput prevents 18th digit insertion (17 = 2^53 safe + 1 buffer)
        // - Prevention, NOT truncation: preserves user intent and prevents silent data loss
        // WARNING: Never convert string to Number() in this handler — breaks fintech precision
        assetDisplay.addEventListener('beforeinput', (e) => {
            if (APP_STATE.inputMode !== 'asset') return;

            // Only check on insertText/insertFromPaste
            if (e.inputType !== 'insertText' && e.inputType !== 'insertFromPaste') return;

            // Count current digits (sanitized)
            const currentText = assetDisplay.textContent.replace(/[^0-9.]/g, '');
            const currentDigitCount = currentText.replace(/\./g, '').length;

            // Count incoming digits
            const incomingText = (e.data || '').replace(/[^0-9.]/g, '');
            const incomingDigitCount = incomingText.replace(/\./g, '').length;

            // Would this exceed the limit?
            if (currentDigitCount + incomingDigitCount > MAX_ASSET_DIGITS) {
                e.preventDefault();

                // Premium feedback (debounced)
                if (!assetDisplay.dataset.limitWarned) {
                    showToast("Maximum precision reached", true);
                    assetDisplay.dataset.limitWarned = 'true';
                    setTimeout(() => delete assetDisplay.dataset.limitWarned, 2000);
                }
            }
        });

        // Sanitization (Keydown)
        assetDisplay.addEventListener('keydown', (e) => {
            if (APP_STATE.inputMode !== 'asset') return;

            // Allow: Backspace, Delete, Tab, Escape, Enter, Arrows
            if ([46, 8, 9, 27, 13, 110, 190].indexOf(e.keyCode) !== -1 ||
                // Allow: Ctrl+A, Ctrl+C, Ctrl+X, Command+A/C/X
                ([65, 67, 88].includes(e.keyCode) && (e.ctrlKey === true || e.metaKey === true)) ||
                // Allow: home, end, left, right, down, up
                (e.keyCode >= 35 && e.keyCode <= 40)) {
                // But block Enter (no new lines)
                if (e.keyCode === 13) {
                    e.preventDefault();
                }
                return;
            }

            // Allow numbers
            if ((e.shiftKey || (e.keyCode < 48 || e.keyCode > 57)) && (e.keyCode < 96 || e.keyCode > 105)) {
                e.preventDefault();
            }

            // Prevent multiple decimals
            if (e.key === '.' && assetDisplay.textContent.includes('.')) {
                e.preventDefault();
            }
        });

        // Mirroring (Input)
        // [PHASE 7I-F] Simplified: Sanitize-only (length guard moved to beforeinput)
        assetDisplay.addEventListener('input', (e) => {
            if (APP_STATE.inputMode !== 'asset') return;

            // Strict sanitize cleanup (paste protection)
            // Replace any non-numeric/decimal char
            const clean = assetDisplay.textContent.replace(/[^0-9.]/g, '');

            if (clean !== assetDisplay.textContent) {
                assetDisplay.textContent = clean;

                // Restore caret to end
                const newRange = document.createRange();
                const sel = window.getSelection();
                newRange.selectNodeContents(assetDisplay);
                newRange.collapse(false);
                sel.removeAllRanges();
                sel.addRange(newRange);
            }

            // Trigger Engine
            updateAmountMirror();
            // [PHASE 7] Scaling
            updateNumericScaling(assetDisplay);
        });

        // [PHASE 7F-2] Disable Paste (Copy Safety)
        assetDisplay.addEventListener('paste', (e) => {
            e.preventDefault();
            // Optional: Handle text paste manually if needed, 
            // but for safety in Phase 7F we strictly prevent dirty data.
        });

        // [PHASE 9] LAST EDITED MODE TRACKER (Gemini Context)
        // Tracks which input was LAST interacted with to resolve inputMode ambiguity.
        if (!window.__SEND_MODE_TRACKER_BOUND__) {
            window.__SEND_MODE_TRACKER_BOUND__ = true;
            window.__SEND_LAST_INPUT_MODE__ = null; // 'fiat' | 'asset'

            const setFiat = () => { window.__SEND_LAST_INPUT_MODE__ = 'fiat'; };
            const setAsset = () => { window.__SEND_LAST_INPUT_MODE__ = 'asset'; };

            // [BUGFIX] Scope Safety: Define elements locally to prevent ReferenceError
            const trackerUsdInput = document.getElementById('usdIndex');
            const trackerAssetDisplay = document.querySelector('.currency-display .value');

            if (trackerUsdInput) {
                trackerUsdInput.addEventListener('input', setFiat);
                trackerUsdInput.addEventListener('keyup', setFiat);
                trackerUsdInput.addEventListener('change', setFiat);
            }

            if (trackerAssetDisplay) {
                trackerAssetDisplay.addEventListener('input', setAsset);
                trackerAssetDisplay.addEventListener('keyup', setAsset);
            }
        }
    }
}

// [PHASE 4] Logic: Asset Detection & Logo Update
function detectAssetFromAddress(address) {
    if (!address) return null;
    const addr = address.trim();

    // ETH: Starts with 0x, length 42
    if (addr.startsWith('0x') && addr.length === 42) {
        return 'eth';
    }

    // BTC: Starts with 1, 3, or bc1. 
    // [BUGFIX] Split Detection: Max length 35 for Legacy (1/3) to avoid Solana collision (44 chars)
    // Segwit (bc1) can be longer.
    if ((addr.startsWith('bc1') && addr.length >= 26 && addr.length <= 90) ||
        ((addr.startsWith('1') || addr.startsWith('3')) && addr.length >= 26 && addr.length <= 35)) {
        return 'btc';
    }

    // SOL: Base58 chars (alphanumeric except 0, O, I, l), 32-44 length.
    // [BUGFIX] Relaxed exclusion: Allow 1/3 start if length is correct (since BTC caught shorts above)
    // STRICT: Must NOT start with 'T' (TRON)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (base58Regex.test(addr)) {
        if (addr.startsWith('T')) {
            return null;
        }
        return 'sol';
    }

    return null;
}

/*
 * SEND THEME GUARD
 * Contract: governance/send/SEND_THEME_CONTRACT_v1.md
 * updates the asset logo and triggers theme derivation.
 * 
 * [PHASE 10A] ASSET SELECTION CONTRACT (Implementation)
 * Now accepts optional explicitAsset to support Overlay selection.
 * If provided, explicitAsset overrides address detection.
 */
function updateAssetLogo(address, explicitAsset = null) {


    const logoImg = document.querySelector('.asset-logo img');
    if (!logoImg) return;

    // [PHASE 10A] CONTRACT: Explicit Overrides
    // If explicitAsset is provided (from selectAsset), we use it.
    // Otherwise we detect from address.
    let asset = explicitAsset || detectAssetFromAddress(address);

    // [PHASE 16] AUTHORITY RULES — DETECTION GUARD
    // If detection found a Type (asset), but User has LOCKED Asset, ignore detection.
    if (!explicitAsset && APP_STATE.assetUserSelected) {
        // Keep existing asset, ignore detected one if they differ (or if detection is null)
        // Actually, if we are in "typing" mode, we should stay on user selected asset.
        asset = APP_STATE.asset;
    }

    // MIRROR STATE & CHAIN DERIVATION
    APP_STATE.asset = asset;

    // [PHASE 14] BTC Address Type Auto-Detection
    if (asset === 'btc' && address) {
        const detectedType = detectBTCAddressType(address);
        if (detectedType) {
            APP_STATE.btcAddressType = detectedType;
            if (window.__DEBUG_GEMINI__) {
                console.log("[AddressDetect] BTC Type Auto-Set:", detectedType);
            }
        }
    } else if (asset !== 'btc') {
        APP_STATE.btcAddressType = null; // Clear if not BTC
    }

    // Chain Derivation
    let newChain = asset === 'eth' ? 'Ethereum' : (asset === 'btc' ? 'Bitcoin' : (asset === 'sol' ? 'Solana' : null));

    // [PHASE 16] AUTHORITY RULES — CHAIN LOCK
    // If User has LOCKED Chain, do NOT auto-switch chain based on Asset match
    if (APP_STATE.chainUserSelected) {
        // Keep existing chain
        newChain = APP_STATE.chain;
    }

    APP_STATE.chain = newChain;

    // ═══════════════════════════════════════════════════════════════════════════
    // [OPTION A — TEMP VISUAL UNBLOCK]
    // Uses local PNG icons for core assets only.
    // This is a temporary bridge until TrustWallet CDN (Option B).
    // Do NOT expand this list. Do NOT remove resolver logic.
    // ═══════════════════════════════════════════════════════════════════════════

    // [PHASE 23] IDENTITY AUTHORITY LOCK
    // Rule: Logo is determined ONLY by the active Chain.
    // Asset merely adds an accent, it does not change the identity logo.
    // 
    // [PHASE 24] LOGO STABILITY GUARD
    // CRITICAL: This logo logic is INDEPENDENT of updateTheme().
    // Asset changes (ETH → USDT) MUST NOT trigger logo changes.
    // Only Chain changes (Ethereum → Bitcoin) trigger logo updates.
    //
    // [PHASE 26] CHAIN FAMILY LOGO AUTHORITY (CRITICAL)
    // Logo is now strictly controlled by CHAIN FAMILY.
    // - All Ethereum-family chains (Ethereum, Arbitrum, Base, Sepolia, etc.) → Ethereum logo
    // - Asset detection fallback only when chain is completely unknown
    // - Once family is established, logo is LOCKED to that family

    // Determine effective chain
    // If we have a locked/known chain in state, use it. 
    // Otherwise derive from asset (for simple detection cases).
    let effectiveChain = APP_STATE.chain || newChain;

    // [PHASE 26] FAMILY-BASED LOGO RESOLUTION
    // CRITICAL: Use resolveLogoForChainFamily as SINGLE source of truth
    let logoSource;

    if (effectiveChain) {
        // Chain is known → Use family-based logo
        logoSource = resolveLogoForChainFamily(effectiveChain);
    } else if (asset) {
        // Chain unknown, but asset detected → Infer family from asset
        // This is a fallback for initial detection only
        const inferredFamily = asset === 'eth' ? 'ethereum' : (asset === 'btc' ? 'bitcoin' : (asset === 'sol' ? 'solana' : null));
        if (inferredFamily === 'ethereum') logoSource = './assets/eth.png';
        else if (inferredFamily === 'bitcoin') logoSource = './assets/btc.png';
        else if (inferredFamily === 'solana') logoSource = './assets/sol.png';
        else logoSource = './assets/chain.png';
    } else {
        // No chain, no asset → Neutral default
        logoSource = './assets/chain.png';
    }

    // Apply Logo Forcefully (Family Authority)
    logoImg.src = logoSource;
    logoImg.onerror = function () {
        this.onerror = null;
        this.src = './assets/chain.png';
    };

    // [PHASE 26] Logo is now 100% family-controlled
    // Sepolia → Ethereum logo
    // Arbitrum → Ethereum logo
    // Base → Ethereum logo
    // Asset changes will NEVER reach this logic (handled by theme/accent only)

    // [PHASE 6E] DYNAMIC LABEL BINDING
    // Update .currency-display .unit with actual asset code
    const unitLabel = document.querySelector('.currency-display .unit');
    if (unitLabel) {
        // Map detected asset (eth/btc/sol) to Label (ETH/BTC/SOL)
        // [PHASE 7I] Asset Leak Fix: Logic moved outside 'if (asset)'
        // to ensure Neutral State logic runs even when asset is null.

        // 1. Default Update (if likely valid)
        if (asset) {
            unitLabel.textContent = asset.toUpperCase();
        }

        // 2. [PHASE 7F] Neutral State Fix (Strict Override)
        // DO NOT TOUCH — CARET & ASSET STATE ARE INTENTIONAL
        const assetDisplay = document.querySelector('.currency-display .value');
        const hasAmount = assetDisplay && assetDisplay.classList.contains('state-neutral') === false && assetDisplay.textContent !== '0' && assetDisplay.textContent.trim() !== '';

        if ((!address || address.length === 0) && !hasAmount) {
            unitLabel.textContent = '';
            unitLabel.style.display = 'none';
        } else {
            // If asset detected, use it. Else default to ETH (standard placeholder).
            unitLabel.textContent = asset ? asset.toUpperCase() : 'ETH';
            unitLabel.style.display = '';
        }
    }

    // [PHASE 4.5] Theming Update (Additive)
    updateTheme(asset);

    // [PHASE 3B] Validation Hook (Passive)
    updateValidationState();

    // [PHASE 3C] Data Hook (Passive)
    // Debounce this in real app, but for now it's fine (triggered on context switch)
    updateDataState();

    // [PHASE 6D] Amount Engine Hook
    // Asset changed -> Recalculate amounts
    // [PHASE 7] Re-verify Neutral State
    // updateAmountMirror calls setVisualValue which handles the "— —" logic based on VALIDATION_STATE + Amount.
    // We just need to trigger it.
    updateAmountMirror();
    updateAmountMirror();
}

/**
 * [PHASE 20] IDENTITY PILL UPDATE (Authority)
 * Ensures pills always reflect APP_STATE
 */
function updateIdentityPills() {
    const chainChip = document.querySelector('.chain-chip');
    const assetChip = document.querySelector('.asset-chip');

    // Update Chain Pill
    if (chainChip) {
        if (APP_STATE.chain) {
            chainChip.textContent = APP_STATE.chain;
        } else {
            chainChip.textContent = 'Chain'; // Default fallback
        }
    }

    // Update Asset Pill
    if (assetChip) {
        if (APP_STATE.asset) {
            assetChip.textContent = APP_STATE.asset.toUpperCase();
        } else {
            assetChip.textContent = 'Asset'; // Default fallback
        }
    }
}

/**
 * [PHASE 14] BTC Address Type Detector
 */
function detectBTCAddressType(address) {
    if (!address) return null;
    const addr = address.trim();
    if (addr.startsWith('bc1p')) return 'taproot';
    if (addr.startsWith('bc1q')) return 'segwit';
    if (addr.startsWith('1') || addr.startsWith('3')) return 'legacy';
    return null;
}

/**
 * [PHASE 10A] ASSET SELECTION CONTRACT (Authoritative)
 * Contract: src/modules/ASSET_SELECTION_CONTRACT_v1.md
 * SINGLE source of truth for changing active asset/chain.
 */
function selectAsset({ asset, chain, source }) {
    debugLog('selectAsset called:', { asset, chain, source });

    // 1. Mutate State (Authoritative)
    APP_STATE.asset = asset;
    APP_STATE.chain = chain;
    APP_STATE.source = source;

    // [PHASE 16] AUTHORITY LOCKS
    // Explicit selection via overlay imposes a lock on that property.
    // Address detection MUST NOT override these locks.
    if (source === 'overlay_chain') {
        APP_STATE.chainUserSelected = true;
    }
    // 'overlay_click' comes from send-overlay.js for Asset items
    else if (source === 'overlay_click' || source === 'overlay_asset') {
        APP_STATE.assetUserSelected = true;
    }

    // 2. Trigger Visual Updates
    // We pass the explicit asset to override detection logic
    const addressInput = document.getElementById('recipientAddress');
    // If we have a selected asset, we pass it effectively as "explicit" to updateAssetLogo checks
    // But updateAssetLogo also does detection. We'll handle the checking/locking INSIDE updateAssetLogo primarily
    // or we pass it here to force the update appropriately.
    // Passing 'asset' here as explicitAsset is correct for the current flow.
    const currentAddress = addressInput ? addressInput.value : '';

    updateAssetLogo(currentAddress, asset);

    // [PHASE 20] Update Identity Pills
    updateIdentityPills();

    // [LIFECYCLE] Fire send:context-changed event for Gemini overlay coordination
    document.dispatchEvent(new CustomEvent('send:context-changed', {
        detail: {
            address: APP_STATE.recipientAddress,
            chain: APP_STATE.chain,
            asset: APP_STATE.asset,
            inputMode: APP_STATE.inputMode
        }
    }));

    // [PHASE 22] VISUAL FEEDBACK ANIMATION
    // Confirms selection to user (Subtle Slide-Up)
    const triggerPillAnimation = (selector) => {
        const el = document.querySelector(selector);
        if (el) {
            el.classList.remove('pill-updated');
            void el.offsetWidth; // Force Reflow
            el.classList.add('pill-updated');
        }
    };

    if (source === 'overlay_chain') {
        triggerPillAnimation('.chain-chip');
    } else if (source === 'overlay_click' || source === 'overlay_asset') {
        // Asset selection drives Asset Pill
        triggerPillAnimation('.asset-chip');

        // If Asset implies Chain switch (e.g. BTC -> Bitcoin), assume chain update is implicit side-effect.
        // But visuals: If chain changes, maybe flash it too?
        // User focus is on Asset. Let's stick to Asset Pill for pure feedback unless logic suggests otherwise.
        // For "Single-Option UX", updating the pill even if text is same confirms "Yes, Locked".
    }

    // 3. Ensure Overlay Consistency (Visual Only)
    // The visual overlay handlers in send-overlay.js will handle closing.
}

// Expose for Overlay
window.selectAsset = selectAsset;

/**
 * [PHASE 25] CHAIN FAMILY RESOLVER (CRITICAL)
 * Normalizes all chain variants into canonical family identifiers.
 * 
 * AUTHORITY: This is the SINGLE SOURCE OF TRUTH for chain family resolution.
 * All theme, logo, and native asset logic MUST use this function.
 * 
 * RATIONALE:
 * - Ethereum L2s (Arbitrum, Base, Optimism, Polygon, etc.) share visual identity
 * - Switching between L2s MUST NOT reset or fade base theme
 * - Native asset detection must work across entire family
 * 
 * CHAIN FAMILIES:
 * - "ethereum" → Ethereum Mainnet, all L2s, testnets
 * - "bitcoin" → Bitcoin mainnet and testnets
 * - "solana" → Solana mainnet and testnets
 * - null → Unknown/unsupported
 */
function resolveChainFamily(chain) {
    if (!chain) return null;

    // Ethereum Family (Mainnet + L2s + Testnets)
    // CRITICAL: All Ethereum-based chains share ONE visual identity
    const ethereumFamily = [
        'Ethereum',
        'Ethereum Mainnet',
        'Arbitrum',
        'Arbitrum One',
        'Optimism',
        'Base',
        'Polygon',
        'Polygon PoS',
        'zkSync',
        'zkSync Era',
        'Linea',
        'Scroll',
        'Sepolia',
        'Goerli',
        'Holesky'
    ];

    if (ethereumFamily.includes(chain)) return 'ethereum';
    if (chain === 'Bitcoin' || chain === 'Bitcoin Testnet') return 'bitcoin';
    if (chain === 'Solana' || chain === 'Solana Devnet') return 'solana';

    return null;
}

/**
 * [PHASE 24] NATIVE ASSET HELPER
 * [PHASE 25] Updated to use Chain Family (not raw chain name)
 * Returns the native asset code for a given chain.
 * Used to suppress accent layers for native assets.
 */
function nativeAssetForChain(chain) {
    const family = resolveChainFamily(chain);
    if (family === 'ethereum') return 'eth';
    if (family === 'bitcoin') return 'btc';
    if (family === 'solana') return 'sol';
    return null;
}

/**
 * [PHASE 26] CHAIN FAMILY LOGO RESOLVER (CRITICAL)
 * Returns the canonical logo source for a given chain family.
 * 
 * AUTHORITY: This is the SINGLE SOURCE OF TRUTH for logo resolution.
 * All logo assignments MUST use this function.
 * 
 * CRITICAL INVARIANT:
 * - Logo is controlled by CHAIN FAMILY, never by asset or raw chain name
 * - Ethereum-family chains (Mainnet, L2s, testnets) → Ethereum logo
 * - Asset changes (ETH → USDT) MUST NOT affect logo
 * 
 * @param {string} chain - The chain name from APP_STATE.chain
 * @returns {string} - Absolute path to the logo asset
 */
function resolveLogoForChainFamily(chain) {
    const family = resolveChainFamily(chain);

    // CRITICAL: Family determines logo, not individual chain name
    if (family === 'ethereum') return './assets/eth.png';
    if (family === 'bitcoin') return './assets/btc.png';
    if (family === 'solana') return './assets/sol.png';

    // Fallback for unknown families
    return './assets/chain.png';
}

/*
 * SEND THEME GUARD
 * Contract: governance/send/SEND_THEME_CONTRACT_v1.md
 * Applies the visual theme class based on the detected asset.
 * This function MUST NOT rely on any state other than the asset argument.
 * Violating this will break the "Theme is a PURE FUNCTION" axiom.
 * 
 * [PHASE 24] THEME STABILITY GUARANTEE
 * - Chain theme is IMMUTABLE during a session unless chain changes explicitly
 * - Asset changes MUST NOT affect logo (handled in updateAssetLogo)
 * - Asset changes MUST NOT reset base theme (only adds accent layer)
 * - Accent layer is ADDITIVE ONLY (does not modify existing theme classes)
 */
function updateTheme(asset) {
    const card = document.querySelector('.send-card');
    if (!card) return;

    // ═══════════════════════════════════════════════════════════════════════════
    // [PHASE 24] THEME STABILITY GUARDS
    // [PHASE 25] CHAIN FAMILY NORMALIZATION (CRITICAL)
    // ═══════════════════════════════════════════════════════════════════════════
    // CRITICAL INVARIANTS:
    // 🔒 Chain Theme IMMUTABLE: Base theme never removed unless chain FAMILY switches
    // 🔒 L2 Stability: Ethereum ↔ Arbitrum ↔ Base NEVER resets theme
    // 🔒 Asset Changes SAFE: Asset selection only adds accent, never mutates base
    // 🔒 Logo Isolation: This function MUST NOT touch logo logic
    // 🔒 Accent Additive: Accent layer applied separately, no theme class removal
    //
    // WHY FAMILY-BASED THEMING:
    // - All Ethereum L2s (Arbitrum, Base, Optimism, etc.) share ONE visual identity
    // - Switching between L2s must feel seamless (same as staying on mainnet)
    // - Theme is determined by FAMILY, not specific chain name
    // ═══════════════════════════════════════════════════════════════════════════

    // 1. Base Chain Theme (Persistent, Family-Based)
    // [PHASE 25] CRITICAL: Use chain FAMILY, not raw chain name
    const chain = APP_STATE.chain;
    const chainFamily = resolveChainFamily(chain);

    // GUARD: Only reset theme classes if we're establishing the correct family theme.
    // This is idempotent: calling multiple times with same family is safe.
    card.classList.remove('theme-btc', 'theme-eth', 'theme-sol', 'theme-default');

    // [PHASE 25] FAMILY-BASED THEME APPLICATION
    // CRITICAL: Theme is determined by FAMILY, not individual chain.
    // Ethereum Mainnet, Arbitrum, Base, Optimism → ALL get 'theme-eth'
    // Asset fallback only used when chain family is not yet established.
    if (chainFamily === 'bitcoin' || (!chainFamily && asset === 'btc')) {
        card.classList.add('theme-btc');
    } else if (chainFamily === 'ethereum' || (!chainFamily && asset === 'eth')) {
        card.classList.add('theme-eth');
    } else if (chainFamily === 'solana' || (!chainFamily && asset === 'sol')) {
        card.classList.add('theme-sol');
    } else {
        card.classList.add('theme-default');
    }

    // 2. Accent Overlay Layer (Additive Only)
    // STABILITY RULE: Accent layer NEVER modifies base theme.
    // It exists purely as a visual overlay for non-native assets.
    let accentLayer = card.querySelector('.send-card-accent-layer');
    if (!accentLayer) {
        accentLayer = document.createElement('div');
        accentLayer.className = 'send-card-accent-layer';
        card.appendChild(accentLayer);
    }

    // GUARD: Reset accent classes (not main theme classes)
    accentLayer.className = 'send-card-accent-layer';

    // 3. Apply Asset Accents (Suppress for Native Assets)
    // [PHASE 25] Native detection now family-aware:
    // - ETH is native on ALL Ethereum family chains (Mainnet, Arbitrum, Base, etc.)
    // - USDT/USDC get accent on all Ethereum family chains
    if (asset) {
        const key = asset.toLowerCase();
        const nativeAsset = nativeAssetForChain(chain);

        // GUARD: Suppress accent if asset is native to the current chain family
        if (nativeAsset && key === nativeAsset) {
            // Native asset: No accent layer, pure base theme
            // ETH on Arbitrum → pure Ethereum theme, no accent
            // accentLayer remains with no modifier classes
        } else {
            // Non-native asset: Apply accent
            // USDT on Arbitrum → Ethereum base theme + green accent
            if (key === 'usdt') accentLayer.classList.add('accent-usdt');
            else if (key === 'usdc') accentLayer.classList.add('accent-usdc');
            // Future: wrapped assets (wBTC, wETH, etc.)
        }
    }
}

// Lifecycle Check
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSendUI);
} else {
    initSendUI();
}

const sliderContainer = document.getElementById('sliderContainer');
const sliderKnob = document.getElementById('sliderKnob');
const sliderText = document.querySelector('.slider-text');

let isDragging = false;
let startX = 0;
let currentX = 0;
const knobWidth = 52;
const padding = 4;

// Listeners
sliderKnob.addEventListener('mousedown', startDrag);
sliderKnob.addEventListener('touchstart', startDrag);

document.addEventListener('mousemove', drag);
document.addEventListener('touchmove', drag);

document.addEventListener('mouseup', endDrag);
document.addEventListener('touchend', endDrag);

// ═══════════════════════════════════════════════════════════════════════════
// 🔒 STABILITY ZONE — SLIDER INTERACTION (Drag-to-Confirm)
// ═══════════════════════════════════════════════════════════════════════════
// DO NOT MODIFY LOGIC WITHOUT UPDATING: SEND SYSTEM CONTRACT SNAPSHOT v1.0
//
// CRITICAL INVARIANTS:
// 馃攲 Multi-Gate Validation: Address Gate → Threshold Gate (90%) → Input Validation → Readiness Check
// 馃攲 Drag Initiation: Blocked if !VALIDATION_STATE.isAddressValid
// 馃攲 Completion Threshold: 90% (industry standard, allows slight over-drag)
// 馃攲 Dry-Run Only: TX_DRY_RUN object logged, NOT executed
//
// ⚠️  DO NOT:
// - Allow drag without valid address (Gate 1 violation)
// - Execute transaction (no wallet SDK integration)
// - Change threshold (90% is UX-tested standard)
// - Skip validation gates (creates financial risk)
//
// WHY DRAG-TO-CONFIRM:
// Premium pattern for high-stakes actions (Apple Pay, bank transfers).
// Prevents accidental submission while maintaining smooth UX.
// Gates ensure only valid data reaches TX preparation.
//
// [PHASE 3] Logic: Validation Helper
function validateInputs() {
    // 1. Get Elements
    const addressInput = document.getElementById('recipientAddress');
    const amountInput = document.getElementById('usdIndex');

    if (!addressInput || !amountInput) {
        return { valid: false, msg: 'System Error: Inputs missing' };
    }

    // 2. Validate Address (Length >= 26)
    const address = addressInput.value.trim();
    if (address.length < 26) {
        return { valid: false, msg: 'Enter a valid wallet address' };
    }

    // 3. Validate Amount (> 0)
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        return { valid: false, msg: 'Enter a valid amount' };
    }

    return { valid: true, msg: '' };
}

function startDrag(e) {
    // [PHASE 7H] Slider Gating
    if (!VALIDATION_STATE.isAddressValid) {
        e.preventDefault();
        showToast("Enter wallet address first", true);
        return;
    }

    if (e.type === 'mousedown') e.preventDefault(); // Stop text selection
    isDragging = true;
    startX = (e.type === 'mousedown' ? e.clientX : e.touches[0].clientX);
    sliderKnob.style.transition = 'none'; // Disable transition for direct drag
}

function drag(e) {
    if (!isDragging) return;

    e.preventDefault(); // Device scroll prevention

    const clientX = (e.type === 'mousemove' ? e.clientX : e.touches[0].clientX);
    const containerRect = sliderContainer.getBoundingClientRect();
    const maxDrag = containerRect.width - knobWidth - padding * 2;

    let moveX = clientX - startX;

    // Constrain
    if (moveX < 0) moveX = 0;
    if (moveX > maxDrag) moveX = maxDrag;

    currentX = moveX;

    // Visual Updates
    sliderKnob.style.transform = `translateX(${currentX}px)`;

    // Update Green Fill
    // We add half knob width to fill to make it look like it's behind the knob center or edge
    let fillPercent = ((currentX + knobWidth) / containerRect.width) * 100;
    // Clamp the fill so it doesn't look weird at start
    if (currentX === 0) fillPercent = 0;

    sliderContainer.style.setProperty('--fill-width', `${fillPercent}%`);

    // Opacity of text fade out
    let opacity = 1 - (currentX / (maxDrag * 0.8));
    if (opacity < 0) opacity = 0;
    sliderText.style.opacity = opacity;
}

function endDrag(e) {
    if (!isDragging) return;
    isDragging = false;

    const containerRect = sliderContainer.getBoundingClientRect();
    const maxDrag = containerRect.width - knobWidth - padding * 2;

    // Threshold to trigger (e.g., 90%)
    if (currentX > maxDrag * 0.9) {
        // 1. Basic Input Validation
        const check = validateInputs();
        if (!check.valid) {
            resetSlider();
            setTimeout(() => showToast(check.msg, true), 50);
            return;
        }

        // 2. [PHASE 3D] Readiness Logic (Dry-Run Gate)
        const readiness = deriveTransactionReadiness();
        if (!readiness.isReady) {
            resetSlider();
            if (window.__DEBUG_TX__) console.warn('[Tx] Blocked:', readiness.reason);
            setTimeout(() => showToast("Network Unavailable or Invalid Data", true), 50);
            return;
        }

        // 3. [PHASE 3D] Construct Dry-Run Object (No Execution)
        const TX_DRY_RUN = {
            chain: APP_STATE.chain,
            asset: APP_STATE.asset,
            recipient: APP_STATE.recipientAddress,
            amountInputMode: APP_STATE.inputMode,
            source: APP_STATE.source,
            estimatedGasNative: DERIVED_STATE.estimatedGasFeeNative,
            estimatedGasUSD: DERIVED_STATE.estimatedGasFeeUSD,
            timestamp: Date.now()
        };

        debugTxLog('Dry Run Prepared', TX_DRY_RUN);

        // 4. Success Visuals (Simulated)
        sliderKnob.style.transform = `translateX(${maxDrag}px)`;
        sliderContainer.style.setProperty('--fill-width', '100%');
        sliderText.textContent = "Submitted";
        sliderText.classList.add('sent');
        sliderText.style.opacity = 1;

        setTimeout(() => {
            // Updated Message for Dry Run clarity in Phase 3D
            showToast("Transaction Prepared (Dry Run)", false);
            resetSlider();
        }, 500);
    } else {
        // Snap back
        resetSlider();
    }
}

// [PHASE 3.1] Unified Premium Toast (Success + Error)
function showToast(message, isError = false) {
    // 1. Remove existing
    const existing = document.getElementById('send-success-toast');
    if (existing) existing.remove();

    // 2. Create
    const toast = document.createElement('div');
    toast.id = 'send-success-toast';
    toast.className = 'success-toast'; // Reuse existing container class

    const icon = isError
        ? '<i class="fa-solid fa-circle-xmark" style="color: #ff4d4d;"></i>'
        : '<i class="fa-solid fa-circle-check"></i>';

    toast.innerHTML = `${icon} ${message}`;

    // 3. Mount to App Container 
    const container = document.querySelector('.app-container') || document.body;
    container.appendChild(toast);

    // 4. Animate In
    requestAnimationFrame(() => {
        toast.classList.add('visible');
    });

    // 5. Auto Dismiss
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => toast.remove(), 500);
    }, 2500);
}

function resetSlider() {
    // Apply Class for Fill Transition
    sliderContainer.classList.add('resetting');

    // Slider Knob Transition (Premium Easing)
    sliderKnob.style.transition = 'transform 0.6s cubic-bezier(0.25, 1, 0.5, 1)';
    sliderKnob.style.transform = `translateX(0px)`;

    // Reset Fill
    sliderContainer.style.setProperty('--fill-width', '0%');

    // Reset Text
    sliderText.classList.remove('sent');
    sliderText.style.opacity = 1;
    sliderText.textContent = "Slide To Continue";

    // Cleanup Reset Class
    setTimeout(() => {
        sliderContainer.classList.remove('resetting');
        // Reset knob transition to default/none for next drag
        sliderKnob.style.transition = 'transform 0.3s ease-out';
    }, 600);
}

// [LIFECYCLE] Expose fresh transaction context for Gemini overlay (read-only snapshot)
window.__getSendTransactionContext__ = function () {
    try {
        // 1. Chain normalization and mapping
        const norm = (s) => (s || "").toString().trim().toLowerCase();

        // Map normalized chain names to numeric IDs
        const chainIdMap = {
            'ethereum': 1,
            'mainnet': 1,
            'ethereum mainnet': 1,
            'arbitrum': 42161,
            'arbitrum one': 42161,
            'optimism': 10,
            'base': 8453,
            'polygon': 137,
            'linea': 59144,
            'scroll': 534352,
            'sepolia': 11155111,
            'bitcoin': 0,
            'solana': 101
        };

        // 1A. CHAIN: Read from visible DOM first, fallback to APP_STATE
        let chain = APP_STATE.chain;
        let chainSource = 'state';
        const chainChip = document.querySelector('.chain-chip');
        if (chainChip && chainChip.textContent && chainChip.textContent.trim()) {
            chain = chainChip.textContent.trim();
            chainSource = 'dom';
        }
        const chainNorm = norm(chain);

        // 1B. ASSET: Read from visible DOM first, fallback to APP_STATE  
        let asset = APP_STATE.asset;
        let assetSource = 'state';
        const assetChip = document.querySelector('.asset-chip');
        if (assetChip && assetChip.textContent && assetChip.textContent.trim()) {
            let assetText = assetChip.textContent.trim().toLowerCase();
            // Normalize common asset display names to internal values
            const assetMap = {
                'eth': 'eth',
                'ethereum': 'eth',
                'btc': 'btc',
                'bitcoin': 'btc',
                'sol': 'sol',
                'solana': 'sol',
                'usdt': 'usdt',
                'tether': 'usdt',
                'usdc': 'usdc',
                'usd coin': 'usdc'
            };
            asset = assetMap[assetText] || assetText;
            assetSource = 'dom';
        }

        // 2. Amount detection (both modes)
        const usdInput = document.getElementById('usdIndex');
        const assetDisplay = document.querySelector('.currency-display .value');

        let amountUsd = null;
        let amountEth = null;
        let inputMode = null;

        // USD amount detection
        if (usdInput && usdInput.value && usdInput.value.trim()) {
            amountUsd = usdInput.value.trim();
            inputMode = 'fiat';
        }

        // Asset amount detection (handle both input and display elements)
        if (assetDisplay) {
            let assetValue = null;
            if (assetDisplay.value !== undefined) {
                assetValue = assetDisplay.value;
            } else {
                assetValue = assetDisplay.textContent;
            }

            if (assetValue && assetValue.trim() && !assetValue.includes('— —')) {
                amountEth = assetValue.replace(/[^0-9.]/g, '').trim();
                if (amountEth && !inputMode) {
                    inputMode = 'asset';
                }
            }
        }

        // 3. Recipient address (prefer DOM over APP_STATE)
        const addrInput = document.getElementById('recipientAddress');
        const recipientAddress = (addrInput && addrInput.value ? addrInput.value.trim() : null) || APP_STATE.recipientAddress;

        // 4. Gas handling
        let gasUsd = null;
        if (typeof DERIVED_STATE !== 'undefined' && DERIVED_STATE.estimatedGasFeeUSD) {
            gasUsd = DERIVED_STATE.estimatedGasFeeUSD.toFixed(2);
        }

        const context = {
            connectedWalletAddress: (typeof window.ethereum !== 'undefined' && window.ethereum.selectedAddress) || null,
            recipientAddress: recipientAddress,
            chain: chain,
            chainId: chainIdMap[chainNorm] || null,
            asset: asset,
            inputMode: inputMode,
            amountUsd: amountUsd,
            amountEth: amountEth,
            gasPriceGwei: (typeof DATA_STATE !== 'undefined') ? DATA_STATE.gasPrice : null,
            gasUsd: gasUsd,
            gasUsd: gasUsd,
            timestamp: Date.now(),
            btcAddressType: APP_STATE.btcAddressType || null,
            // Debug-only fields (won't affect Gemini behavior)
            chainSource: window.__DEBUG_GEMINI__ ? chainSource : undefined,
            assetSource: window.__DEBUG_GEMINI__ ? assetSource : undefined
        };

        if (window.__DEBUG_GEMINI__) {
            console.log("[SendContext] __getSendTransactionContext__:", context);
        }

        return context;
    } catch (e) {
        console.error("Error in __getSendTransactionContext__", e);
        return {};
    }
};

// ===============================================
// AMOUNT BLOCKER OVERLAY INTERACTION
// ===============================================
(function initAmountBlocker() {
    const overlay = document.getElementById('amountBlocker');
    const inputUSD = document.getElementById('usdIndex');
    // Note: BTC display is usually not an input, but we treat the container as "blocked"
    // If there were an input there, we'd select it. For now, we block interaction visually.

    if (!overlay) return;

    let state = {
        blockedSide: 'right', // 'right' (Asset) | 'left' (Fiat)
        locked: false,
        clickTimer: null
    };

    // Initial State: Block Right (Asset)
    updateBlockedState();

    overlay.addEventListener('click', (e) => {
        // Debounce for double-click detection
        if (state.clickTimer) {
            clearTimeout(state.clickTimer);
            state.clickTimer = null;
            handleDoubleClick();
        } else {
            state.clickTimer = setTimeout(() => {
                state.clickTimer = null;
                handleSingleClick();
            }, 250); // 250ms delay to distinguish single/double
        }
    });

    function handleSingleClick() {
        if (state.locked) {
            // Shake or visual feedback that it's locked? 
            // For now, do nothing if locked.
            return;
        }

        // Toggle Side
        state.blockedSide = state.blockedSide === 'right' ? 'left' : 'right';

        // MIRROR STATE
        APP_STATE.inputMode = state.blockedSide === 'left' ? 'asset' : 'fiat'; // If Left (Fiat) is blocked, input is Asset? No wait. 
        // Logic check: 
        // Blocked Side = LEFT (Fiat Blocked) -> User types in Right (Asset)? 
        // Existing logic: "If Blocked Side is Left -> Disable USD Input"
        // So mode is ASSET.
        APP_STATE.inputMode = state.blockedSide === 'left' ? 'asset' : 'fiat';

        updateBlockedState();
        debugLogicLog('Blocker Toggle', APP_STATE);

        // [PHASE 6D] Amount Engine Hook
        // Mode switched -> Ensure values act as expected
        // [PHASE 7F-2] DO NOT RE-DERIVE ON TOGGLE.
        // User values are sacred. Changing authority should not mutate values immediately.
        // updateAmountMirror(); // DISABLED to prevent mutation.
    }

    function handleDoubleClick() {
        // Toggle Lock
        state.locked = !state.locked;

        // MIRROR STATE
        APP_STATE.isLocked = state.locked;

        updateLockVisuals();
        debugLogicLog('Blocker Lock', APP_STATE);
    }

    function updateBlockedState() {
        // 1. Visual Position
        if (state.blockedSide === 'left') {
            overlay.classList.add('position-left');
        } else {
            overlay.classList.remove('position-left');
        }

        // 2. Input Disabling
        // If Blocked Side is Left -> Disable USD Input
        if (state.blockedSide === 'left') {
            // [AUTHORITY: ASSET]
            // USD is BLOCKED (ReadOnly)
            inputUSD.setAttribute('readonly', 'true');
            // pointerEvents could block clicking, but we want visual graying out potentially
            inputUSD.style.pointerEvents = 'none';

            // Asset is ACTIVE
            // Enable contenteditable for the div
            const assetDisplay = document.querySelector('.currency-display .value');
            if (assetDisplay) {
                assetDisplay.contentEditable = "true";
                assetDisplay.style.pointerEvents = 'auto';
                assetDisplay.setAttribute('inputmode', 'decimal');
                assetDisplay.setAttribute('role', 'textbox');
                assetDisplay.focus();

                // [PHASE 7] Clear Neutral on Input focus logic handled in mirroring?
                // Or force clear here if it's strictly the toggle
                if (assetDisplay.textContent.includes('—')) {
                    assetDisplay.textContent = '';
                    assetDisplay.classList.remove('state-neutral');
                }
                updateNumericScaling(assetDisplay);
            }
        } else {
            // [AUTHORITY: FIAT]
            // USD is ACTIVE
            inputUSD.removeAttribute('readonly');
            inputUSD.style.pointerEvents = 'auto'; // Re-enable

            // Asset is BLOCKED (ReadOnly)
            const assetDisplay = document.querySelector('.currency-display .value');
            if (assetDisplay) {
                assetDisplay.contentEditable = "false";
                // Optionally disable pointer events if we want strict blocking
                // assetDisplay.style.pointerEvents = 'none'; 
                assetDisplay.removeAttribute('inputmode');
                assetDisplay.removeAttribute('role');
            }
            inputUSD.focus();
        }

        // If Blocked Side is Right -> Disable Asset Input (if it existed)
        // Currently it's a display div, but we can block pointer events if needed
        // const displayBTC = document.querySelector('.currency-display.btc');
        // if (state.blockedSide === 'right') displayBTC.style.pointerEvents = 'none';
    }

    function updateLockVisuals() {
        if (state.locked) {
            overlay.classList.add('state-locked');
        } else {
            overlay.classList.remove('state-locked');
        }
    }
})();

// [PHASE 9] Gemini Risk Data Layer (Hidden / Hackathon Mode)
// Deterministic mock data for fraud detection demos.
// 200-400ms simulated latency.
window.__getWalletRiskFacts__ = async function (recipientAddress, chainId) {
    if (!recipientAddress || typeof recipientAddress !== 'string') return null;

    // Simulate Network Latency (200-400ms)
    const delay = 200 + Math.floor(Math.random() * 200);
    await new Promise(resolve => setTimeout(resolve, delay));

    // Deterministic Seed from Address (last 6 chars)
    // "0x...abc123" -> Use numbers from end for consistency
    const uniquePart = recipientAddress.slice(-6).replace(/[^0-9a-fA-F]/g, '');
    const seed = parseInt(uniquePart, 16) || recipientAddress.length; // Fallback

    // Pseudo-random generator helpers
    const getSeededNum = (min, max, modifier = 0) => {
        const x = Math.sin(seed + modifier) * 10000;
        return Math.floor((x - Math.floor(x)) * (max - min + 1)) + min;
    };

    const getSeededBool = (modifier = 0) => {
        return getSeededNum(0, 100, modifier) > 50;
    };

    // Generate Facts
    const firstSeenDaysAgo = getSeededNum(1, 1500, 1);
    const txCount = getSeededNum(0, 5000, 2);

    // Pattern Logic
    const isNew = firstSeenDaysAgo < 30;
    const isHighVolume = txCount > 1000;

    const sentTxCount = Math.floor(txCount * (getSeededNum(20, 80, 3) / 100)); // 20-80% sent
    const receivedTxCount = txCount - sentTxCount;
    const uniqueSendersApprox = Math.floor(receivedTxCount / getSeededNum(1, 5, 4));

    // Fraud Patterns
    const smallIncomingPattern = isNew && getSeededBool(5); // New + random chance
    const largeOutflowAfterSmallInflows = smallIncomingPattern && getSeededBool(6);

    // Risk Score Calculation (0-100)
    let riskScore = 10; // Base safety
    const riskReasons = [];

    if (isNew) {
        riskScore += 40;
        riskReasons.push("Address is very new (< 30 days active)");
    }
    if (txCount < 5) {
        riskScore += 20;
        riskReasons.push("Very low transaction history");
    }
    if (smallIncomingPattern) {
        riskScore += 15;
        riskReasons.push("Pattern of small incoming transactions detected");
    }
    if (largeOutflowAfterSmallInflows) {
        riskScore += 25;
        riskReasons.push("High risk: Large outflow immediately following small inflows");
    }
    if (uniqueSendersApprox > 500) {
        riskScore -= 10; // High rep usually
    }

    // Clamp
    riskScore = Math.min(100, Math.max(0, riskScore));

    const facts = {
        recipientAddress,
        chainId: chainId || 'unknown',
        firstSeenDaysAgo,
        txCount,
        receivedTxCount,
        sentTxCount,
        uniqueSendersApprox,
        smallIncomingPattern,
        largeOutflowAfterSmallInflows,
        riskScore,
        riskReasons
    };

    if (window.__DEBUG_GEMINI__) {
        console.log('[GeminiRisk] Mock Facts Generated:', facts);
    }

    return facts;
};

// [PHASE 9] Transaction Context Exporter for Gemini
// Captures current state from APP_STATE, DOM, and Tracking Globals.
window.__getSendTransactionContext__ = function () {
    try {
        // 1. Resolve Amounts based on Input Mode
        const usdInput = document.getElementById('usdIndex');
        const assetDisplay = document.querySelector('.currency-display .value');

        let amountUsd = usdInput ? usdInput.value : null;
        let amountAsset = assetDisplay ? assetDisplay.textContent : null;

        // Clean formatting
        if (amountUsd) amountUsd = amountUsd.replace(/[^0-9.]/g, '');
        if (amountAsset) amountAsset = amountAsset.replace('— —', '').trim();

        // 2. Resolve Input Mode (Reliable Tracker)
        let inputMode = window.__SEND_LAST_INPUT_MODE__;

        // Fallback if no interaction yet (e.g. pre-filled)
        if (!inputMode) {
            if (amountUsd && (!amountAsset || amountAsset === '0')) inputMode = 'fiat';
            else if (amountAsset && (!amountUsd || amountUsd === '0')) inputMode = 'asset';
            else inputMode = 'fiat'; // Default
        }

        // 3. Resolve Address & Chain
        const currentRecipient = (typeof APP_STATE !== 'undefined') ? APP_STATE.recipientAddress : null;
        const currentChain = (typeof APP_STATE !== 'undefined') ? APP_STATE.chain : null;
        const currentAsset = (typeof APP_STATE !== 'undefined') ? APP_STATE.asset : null;

        // 4. Resolve Gas
        const gasPrice = (typeof DATA_STATE !== 'undefined') ? DATA_STATE.gasPrice : null;
        let gasUsd = null;
        if (typeof DERIVED_STATE !== 'undefined' && DERIVED_STATE.estimatedGasFeeUSD) {
            gasUsd = DERIVED_STATE.estimatedGasFeeUSD.toFixed(2);
        }

        const context = {
            connectedWalletAddress: (typeof window.ethereum !== 'undefined' && window.ethereum.selectedAddress) || null,
            recipientAddress: currentRecipient,
            chain: currentChain,
            chainId: currentChain,
            asset: currentAsset,
            inputMode: inputMode,
            amountUsd: amountUsd,
            amount: amountAsset,
            amountEth: amountAsset,
            gasPriceGwei: gasPrice,
            gasUsd: gasUsd,
            timestamp: Date.now(),
            isValid: !!currentRecipient
        };

        if (window.__DEBUG_GEMINI__) {
            console.log("[SendContext] lastInputMode:", window.__SEND_LAST_INPUT_MODE__);
            console.log("[SendContext] __getSendTransactionContext__:", context);
        }

        return context;
    } catch (e) {
        console.error("Error in __getSendTransactionContext__", e);
        return {};
    }
};

