/**
 * ICON RESOLUTION GUARD
 * Contract: governance/icons/ICON_RESOLUTION_CONTRACT_v1.md
 * 
 * A pure, deterministic utility to resolve asset and chain icon paths.
 * 
 * RULES (STRICT):
 * - Must return a string URL.
 * - No network requests (fetch/XHR).
 * - No filesystem probing.
 * - No global state or side effects.
 * - No exceptions thrown.
 * 
 * RESOLUTION ORDER:
 * 1. Chain Icon: If asset is 'native' or missing -> ./icons/chains/{chain}.svg
 * 2. Asset Icon: If asset provided -> ./icons/assets/{chain}/{asset}.svg
 * 3. Fallback: If chain missing -> ./icons/fallback/generic.svg
 */
export function resolveIconURL({ chain, asset }) {
    // Public Asset Path Contract (Phase 9G):
    // The application is served with `1_Scan` as the effective public root.
    // Therefore all local icon URLs must resolve under `./icons/...`.
    const BASE_PATH = './icons';
    const FALLBACK_PATH = `${BASE_PATH}/fallback/generic.svg`;

    // 1. Validate Inputs (Graceful Failure)
    if (!chain || typeof chain !== 'string') {
        return FALLBACK_PATH;
    }

    // Normalize chain slug (kebab-case/lowercase) to match filesystem attributes
    // e.g. "Ethereum" -> "ethereum"
    const chainSlug = chain.toLowerCase().trim().replace(/\s+/g, '-');

    // 2. Resolve Chain Icon (Native)
    // Contract Rule: "Identifier: chain_slug (lowercase, kebab-case)"
    if (!asset || asset === 'native') {
        return `${BASE_PATH}/chains/${chainSlug}.svg`;
    }

    // 3. Resolve Asset Icon
    // Contract Rule: "Path Structure: /blockchains/{chain_slug}/assets/{token_address}/logo.png"
    // (Adapted for local proxy: ./icons/assets/{chain}/{asset}.svg)
    const assetSlug = asset.toLowerCase().trim();
    return `${BASE_PATH}/assets/${chainSlug}/${assetSlug}.svg`;
}
