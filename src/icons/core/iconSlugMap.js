/**
 * ICON SLUG MAP GUARD
 * Contract: governance/icons/ICON_RESOLUTION_CONTRACT_v1.md
 * 
 * A pure, deterministic utility to map human-readable inputs to filesystem-safe slugs.
 * 
 * RULES (STRICT):
 * - Pure functions only.
 * - No side effects or global state.
 * - No guessing (unknown inputs return null).
 * - No exceptions thrown.
 * 
 * MAPPING STRATEGY:
 * - Chains: Human names ('Ethereum') -> Folder slugs ('ethereum')
 * - Assets: Tickers ('ETH') -> Asset slugs ('eth')
 */

// CHAIN MAPPING
const CHAIN_SLUG_MAP = {
    'ethereum': 'ethereum',
    'eth': 'ethereum',
    'bitcoin': 'bitcoin',
    'btc': 'bitcoin',
    'solana': 'solana',
    'sol': 'solana',
    // Future Expansion Here (e.g., 'polygon' -> 'polygon')
};

// ASSET MAPPING (Essential Assets Only per Contract Priority 2)
const ASSET_SLUG_MAP = {
    'eth': 'eth',
    'btc': 'btc',
    'sol': 'sol',
    'usdc': 'usdc',
    'usdt': 'usdt',
    'dai': 'dai',
    'matic': 'matic',
    // Add more essential assets here as needed
};

/**
 * Normalizes a chain input to a guaranteed safe slug.
 * @param {string} input - The raw chain identifier (e.g., 'Ethereum', 'ETH')
 * @returns {string|null} - Normalized slug or null if unknown
 */
export function normalizeChainSlug(input) {
    if (!input || typeof input !== 'string') return null;
    const key = input.toLowerCase().trim();
    return CHAIN_SLUG_MAP[key] || null;
}

/**
 * Normalizes an asset input to a guaranteed safe slug.
 * @param {string} input - The raw asset identifier (e.g., 'USDC', 'ETH')
 * @returns {string|null} - Normalized slug or null if unknown
 */
export function normalizeAssetSlug(input) {
    if (!input || typeof input !== 'string') return null;
    const key = input.toLowerCase().trim();
    return ASSET_SLUG_MAP[key] || null;
}
