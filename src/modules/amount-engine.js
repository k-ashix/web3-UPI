/**
 * Amount Engine
 * 
 * RESPONSIBILITY:
 * - Pure, deterministic conversion between Fiat (USD) and Native Assets (ETH, BTC, SOL).
 * - Single source of truth for math logic.
 * - ZERO side effects (no DOM, no network, no state mutation).
 * - Mathematical correctness > Cleverness.
 * 
 * CONTRACT:
 * - All inputs must be passed explicitly.
 * - Returns null or strictly typed numbers.
 * - Never throws uncaught errors.
 */

// CONFIGURATION (Internal)
const PRECISION = {
    fiat: 2,
    eth: 6,
    btc: 8,
    sol: 6,
    default: 0
};

/**
 * Safe helper to parse input to number.
 * Returns null if invalid, NaN, or negative.
 */
function safeParse(val) {
    if (val === null || val === undefined || val === '') return null;
    const num = Number(val);
    if (Number.isNaN(num)) return null;
    if (num < 0) return 0; // Clamp negative to 0
    return num;
}

/**
 * rounds a number to specific decimals using safe math.
 * Handles floating point epsilon issues via scaling.
 */
function safeRound(value, decimals) {
    if (value === null) return null;
    const multiplier = Math.pow(10, decimals);
    // Round half-up
    return Math.round(value * multiplier) / multiplier;
}

/**
 * Derives asset amount from a fiat input.
 * 
 * @param {number|string} fiatAmount - The source fiat amount (e.g. "100.50")
 * @param {number} assetPriceUSD - The price of 1 unit of asset in USD
 * @param {string} chain - 'Ethereum' | 'Bitcoin' | 'Solana' (or lowercase asset code)
 * @returns {number|null} The derived asset amount, or null if invalid.
 */
function deriveFromFiat(fiatAmount, assetPriceUSD, chain) {
    const amount = safeParse(fiatAmount);
    const price = safeParse(assetPriceUSD);

    if (amount === null || price === null || price <= 0) return null;
    if (amount === 0) return 0;

    const derived = amount / price;
    return roundAsset(derived, chain);
}

/**
 * Derives fiat amount from an asset input.
 * 
 * @param {number|string} assetAmount - The source asset amount
 * @param {number} assetPriceUSD - The price of 1 unit of asset in USD
 * @returns {number|null} The derived fiat amount, or null.
 */
function deriveFromAsset(assetAmount, assetPriceUSD) {
    const amount = safeParse(assetAmount);
    const price = safeParse(assetPriceUSD);

    if (amount === null || price === null || price <= 0) return null;
    if (amount === 0) return 0;

    const derived = amount * price;
    return roundFiat(derived);
}

/**
 * Normalizes a fiat input to a safe standard number.
 * 
 * @param {string|number} rawInput 
 * @returns {number|null} Normalized number or null
 */
function normalizeFiat(rawInput) {
    const val = safeParse(rawInput);
    if (val === null) return null;
    return roundFiat(val);
}

/**
 * Normalizes an asset input to chain-safe precision.
 * 
 * @param {string|number} rawInput 
 * @param {string} chain 
 * @returns {number|null} Normalized number or null
 */
function normalizeAsset(rawInput, chain) {
    const val = safeParse(rawInput);
    if (val === null) return null;
    return roundAsset(val, chain);
}

/**
 * Rounds a number to standard Fiat currency (2 decimals).
 * USE: Display or Final Calculation.
 * 
 * @param {number|string} amount 
 * @returns {number|null}
 */
function roundFiat(amount) {
    const val = safeParse(amount);
    if (val === null) return null;
    return safeRound(val, PRECISION.fiat);
}

/**
 * Rounds a number to Chain-Specific precision.
 * - ETH: 6
 * - SOL: 6
 * - BTC: 8
 * 
 * @param {number|string} amount 
 * @param {string} chain 
 * @returns {number|null}
 */
function roundAsset(amount, chain) {
    const val = safeParse(amount);
    if (val === null) return null;

    let decimals = PRECISION.default;
    if (chain) {
        const c = chain.toLowerCase();
        if (c.includes('eth')) decimals = PRECISION.eth;
        else if (c.includes('btc') || c.includes('bitcoin')) decimals = PRECISION.btc;
        else if (c.includes('sol')) decimals = PRECISION.sol;
    }

    return safeRound(val, decimals);
}

// Frozen Public API
export const AmountEngine = Object.freeze({
    deriveFromFiat,
    deriveFromAsset,
    normalizeFiat,
    normalizeAsset,
    roundFiat,
    roundAsset
});
