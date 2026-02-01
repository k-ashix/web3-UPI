/**
 * ICON CDN RESOLVER GUARD
 * Contract: governance/icons/ICON_RESOLUTION_CONTRACT_v1.md
 * 
 * A pure utility to return an prioritized list of icon sources.
 * 
 * RESOLUTION STRATEGY:
 * 1. High-Performance CDN (TrustWallet Standard)
 * 2. Local Proxy (Deterministic SVG)
 * 3. Generic Fallback
 * 
 * RULES:
 * - Pure function.
 * - No network calls (URL construction only).
 * - No async.
 * - Silent failure (fallback always present).
 * 
 * USAGE PATTERN:
 * <img src={sources[0]} onError={(e) => {
 *     const next = sources.indexOf(e.target.src) + 1;
 *     if (sources[next]) e.target.src = sources[next];
 * }} />
 */

import { resolveIconURL } from './iconResolver.js';

const CDN_BASE_URL = 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains';
const FALLBACK_ICON = './icons/fallback/generic.svg';

export function resolveIconSources({ chain, asset }) {
    if (!chain) return [FALLBACK_ICON];

    // Normalize inputs for URL construction
    const chainSlug = chain.toLowerCase().trim();
    const assetSlug = asset ? asset.toLowerCase().trim() : null;

    const sources = [];

    // 1. CDN SOURCE (Priority 1)
    // Structure: .../blockchains/{chain}/info/logo.png OR .../assets/{asset}/logo.png
    if (!assetSlug || assetSlug === 'native') {
        // Chain Logo
        sources.push(`${CDN_BASE_URL}/${chainSlug}/info/logo.png`);
    } else {
        // Asset Logo
        // Note: TrustWallet uses address-based paths. If assetSlug is a ticker (e.g. 'usdc'),
        // this might 404 on the real CDN, but it satisfies the deterministic contract.
        // A mapping layer would be required for strict ticker->address resolution if not provided.
        sources.push(`${CDN_BASE_URL}/${chainSlug}/assets/${assetSlug}/logo.png`);
    }

    // 2. LOCAL PROXY SOURCE (Priority 2)
    // Uses existing deterministic resolver
    const localPath = resolveIconURL({ chain, asset });
    if (localPath && localPath !== FALLBACK_ICON) {
        sources.push(localPath);
    }

    // 3. GENERIC FALLBACK (Priority 3)
    sources.push(FALLBACK_ICON);

    return sources;
}
