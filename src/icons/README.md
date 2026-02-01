# Icon Subsystem

## 1. Purpose
This subsystem manages the resolution, mapping, and display of blockchain icons (chains) and asset icons (tokens/coins). It ensures a deterministic, fault-tolerant, and performance-optimized approach to handling visual assets in the Web3 wallet interface.

## 2. Resolution Order
The icon resolution strategy follows a strict **CDN-First** approach as defined in the governance contract:

1.  **High-Performance CDN**: Primary source for all icons (TrustWallet standard or similar).
2.  **Local Proxy**: Fallback for essential assets if CDN fails or is offline.
3.  **Generic Fallback**: Final resort if both CDN and Local sources are unavailable.

## 3. Contract Compliance
This subsystem strictly adheres to:
**[ICON_RESOLUTION_CONTRACT_v1.0](../../governance/icons/ICON_RESOLUTION_CONTRACT_v1.md)**

Refer to the contract for:
- Detailed resolution rules
- Naming conventions
- Forbidden behaviors (e.g., no runtime API lookups)

## 4. Usage Warning
> **WARNING:** Do not bypass slug normalization.

When using the icon resolver, always ensure inputs are normalized using `iconSlugMap.js` if they are not already guaranteed to be safe slugs. The core resolvers expect lowercase, kebab-case slugs for chains and lowercase slugs for assets.

## 5. Modules
- **`core/iconResolver.js`**: Pure function for local path resolution.
- **`core/iconSlugMap.js`**: Pure function for mapping human-readable names to slugs.
- **`core/iconCDNResolver.js`**: Main entry point returning prioritized icon sources.
