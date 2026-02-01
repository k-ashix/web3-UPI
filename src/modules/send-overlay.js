/*
PHASE 8A — VISUAL OVERLAY ONLY
DO NOT:
- Bind business logic
- Mutate send.js behavior
- Touch numeric logic
- Add APIs
This file is visual scaffolding only.
*/

import { resolveIconSources } from '../icons/core/iconCDNResolver.js';

/**
 * MOCK DATA - VISUAL ONLY
 */
const MOCK_CHAINS = [
    { header: 'Mainnet Networks' },
    { name: 'Ethereum Mainnet', icon: '', type: 'Mainnet' },
    { name: 'Bitcoin Network', icon: '', type: 'Mainnet' },
    { name: 'Solana Mainnet', icon: '', type: 'Mainnet' },
    { name: 'BNB Chain', icon: '', type: 'Mainnet' },
    { name: 'Ethereum Classic', icon: '', type: 'Mainnet' },
    { header: 'Layer 2 & Sidechains' },
    { name: 'Arbitrum One', icon: '', type: 'L2' },
    { name: 'Optimism', icon: '', type: 'L2' },
    { name: 'Polygon', icon: '', type: 'Sidechain' },
    { name: 'Base', icon: '', type: 'L2' },
    { name: 'Linea', icon: '', type: 'zkEVM' },
    { name: 'Scroll', icon: '', type: 'zkEVM' },
    { header: 'Test Networks' },
    { name: 'Sepolia', icon: '', type: 'Testnet' },
    { name: 'Monad', icon: '', type: 'Devnet' }
];

const MOCK_ASSETS = [
    { header: 'Native Assets' },
    { name: 'ETH', fullName: 'Ethereum', icon: '' },
    { name: 'BTC', fullName: 'Bitcoin', icon: '' },
    { name: 'SOL', fullName: 'Solana', icon: '' },
    { header: 'Stablecoins' },
    { name: 'USDT', fullName: 'Tether USD', icon: '' },
    { name: 'USDC', fullName: 'USD Coin', icon: '' },
    { header: 'Tokens' },
    { name: 'MATIC', fullName: 'Polygon', icon: '' },
    { name: 'BNB', fullName: 'Binance Coin', icon: '' }
];

// [PHASE 10B] Helper: Gating Pure Function
// [PHASE 19] Helper: Chain-Scoped Asset Availability
function getAllowedAssetsForChain(chain) {
    if (!chain) return ['ETH', 'USDT', 'USDC']; // Default to ETH scope (Phase 19 Rule)

    const c = chain.toLowerCase();

    // Ethereum & L2s & Sidechains (EVM Scope)
    // "Arbitrum / Optimism / Base / Polygon / Linea / Scroll"
    if (c.includes('ethereum') ||
        c.includes('arbitrum') ||
        c.includes('optimism') ||
        c.includes('base') ||
        c.includes('polygon') ||
        c.includes('linea') ||
        c.includes('scroll') ||
        c.includes('sepolia') || // Testnet
        c.includes('monad')) {   // Devnet (EVM)
        return ['ETH', 'USDT', 'USDC'];
    }

    // Bitcoin Scope
    if (c.includes('bitcoin')) {
        return ['BTC'];
    }

    // Solana Scope
    if (c.includes('solana')) {
        return ['SOL', 'USDC'];
    }

    // Fallback for unknown chains
    return ['ETH', 'USDT', 'USDC'];
}

// [PHASE 12] Helper: Chain Gating
function getAllowedChainsForAsset(asset) {
    if (!asset) return null; // Default to all? Or specific default?
    // Contract says: NULL -> Default to ETH scope.
    // So distinct from "all".

    const a = asset.toLowerCase();

    // BTC -> Bitcoin Mainnet ONLY
    if (a === 'btc') return ['Bitcoin Network'];

    // SOL -> Solana Mainnet ONLY
    if (a === 'sol') return ['Solana Mainnet'];

    // ETH/USDT/USDC -> ETH Scope
    if (['eth', 'usdt', 'usdc'].includes(a)) {
        return [
            'Ethereum Mainnet',
            'Arbitrum One',
            'Optimism',
            'Polygon',
            'Base',
            'Linea',
            'Scroll',
            'Sepolia'
        ];
    }

    // Default Fallback (Contract Rule 3.2: Null -> ETH scope)
    // Also covers unknown assets for now to be safe, or should we show nothing?
    // Contract says "Overlay MUST NOT show chains unrelated".
    // If unknown asset, maybe show nothing or default? 
    // Let's stick to ETH scope as safe default for "generic" behavior.
    return [
        'Ethereum Mainnet',
        'Arbitrum One',
        'Optimism',
        'Polygon',
        'Base',
        'Linea',
        'Scroll',
        'Sepolia'
    ];
}

/**
 * INJECT HTML STRUCTURE
 * Target: .app-container (To allow full height overlay without clipping)
 * WAS: .send-card__inner
 */
function injectOverlayHTML() {
    // [PHASE 8B] Mount Point Adjustment -> .app-container
    const container = document.querySelector('.app-container');
    if (!container) {
        console.warn('[SendOverlay] Container .app-container not found. Overlay injection failed.');
        return;
    }

    // Check if already injected
    if (document.getElementById('selectionOverlayContainer')) return;

    // Create Container
    const overlay = document.createElement('div');
    overlay.id = 'selectionOverlayContainer';
    overlay.className = 'selection-overlay-container';

    // Create Header
    const header = document.createElement('div');
    header.className = 'overlay-header';
    header.innerHTML = `
        <div class="text-group">
            <div class="overlay-title" id="overlayTitle">Select Network</div>
            <div class="overlay-subtitle" id="overlaySubtitle">Choose destination chain</div>
        </div>
        <div class="close-icon" style="cursor: pointer; opacity: 0.5; padding: 8px;">
            <i class="fa-solid fa-times"></i>
        </div>
    `;

    // Create List Container
    const list = document.createElement('div');
    list.id = 'overlayList';
    list.className = 'overlay-list';

    // Assemble
    overlay.appendChild(header);
    overlay.appendChild(list);
    container.appendChild(overlay);

    // Wire Close Icon
    header.querySelector('.close-icon').addEventListener('click', (e) => {
        e.stopPropagation();
        closeOverlay();
    });
}

/**
 * RENDER LIST ITEMS
 */
/**
 * RENDER LIST ITEMS
 */
function renderList(type, chainContext = null, selectedItem = null) {
    const list = document.getElementById('overlayList');
    if (!list) return;
    list.innerHTML = ''; // Clear

    let data = type === 'chain' ? MOCK_CHAINS : MOCK_ASSETS;

    // [PHASE 10B] Gating Logic (Asset List)
    if (type === 'asset' && chainContext) {
        const allowed = getAllowedAssetsForChain(chainContext);
        if (allowed) {
            data = data.filter(item => {
                if (item.header) return true;
                return allowed.includes(item.name);
            });
        }
    }

    // [PHASE 12] Gating Logic (Chain List)
    // Here chainContext is actually the "Asset Context" passed from openOverlay('chain', { asset: ... })
    // We reused the 2nd arg name but it represents the *Filter Context*.
    if (type === 'chain') {
        // If context is null, getAllowedChainsForAsset handles default (ETH scope)
        const allowedChains = getAllowedChainsForAsset(chainContext);

        if (allowedChains) {
            data = data.filter(item => {
                if (item.header) return true;
                return allowedChains.includes(item.name);
            });
        }
    }

    // [PHASE 12] Cleanup Empty Headers
    // After filtering, some sections might be empty.
    // We need to remove headers that have no following items.
    // Simple 2-pass approach or smart filter?
    // Let's filter first, then check headers.

    // We have 'data' with headers and items.
    // We want to remove a header if the NEXT item is a header or end of list.
    // Actually, 'data' is the filtered list now.
    // Let's loop and rebuild.
    const cleanData = [];
    for (let i = 0; i < data.length; i++) {
        const item = data[i];
        if (item.header) {
            // Peek next
            const next = data[i + 1];
            // If next exists and is NOT a header, keep this header.
            if (next && !next.header) {
                cleanData.push(item);
            }
        } else {
            cleanData.push(item);
        }
    }
    data = cleanData;

    data.forEach(item => {
        // Render Header
        if (item.header) {
            const header = document.createElement('div');
            header.className = 'overlay-section-header';
            header.textContent = item.header;
            list.appendChild(header);
            return;
        }

        // Render Card
        const card = document.createElement('div');
        card.className = 'overlay-card-item';

        // [PHASE 17] Visual Selection Feedback
        // Check if this item matches the currently selected one
        // Normalization needed for chains (e.g. 'Ethereum Mainnet' vs 'Ethereum') or assets ('ETH' vs 'eth')
        let isSelected = false;
        if (selectedItem) {
            if (type === 'chain') {
                // Chain Layout: item.name = 'Ethereum Mainnet', selectedItem = 'Ethereum'
                // Simple includes check or strict mapping?
                // selectedItem comes from APP_STATE.chain which is 'Ethereum', 'Bitcoin', 'Solana'.
                // item.name is verbose.
                const n = item.name.toLowerCase();
                const s = selectedItem.toLowerCase();
                if (n.includes(s) || s.includes(n)) isSelected = true;
            } else {
                // Asset Layout: item.name = 'ETH', selectedItem = 'eth'
                if (item.name.toLowerCase() === selectedItem.toLowerCase()) isSelected = true;
            }
        }

        if (isSelected) {
            card.classList.add('selected');
        }

        // Mock Lock Check (Visual Only)
        const addrInput = document.getElementById('recipientAddress');
        const isEmpty = !addrInput || !addrInput.value || addrInput.value.trim() === '';

        if (isEmpty) {
            // [PHASE 8B] Lock State - Visual Dismissal/Opacity
            card.classList.add('disabled');
        }

        // Icon Rendering (ONLY) — prefer local, avoid 404s for unknown mock networks.
        const isChain = type === 'chain';
        const normalizeOverlayChain = (name) => {
            if (!name || typeof name !== 'string') return null;
            const n = name.toLowerCase();
            if (n.includes('ethereum')) return 'Ethereum';
            if (n.includes('bitcoin')) return 'Bitcoin';
            if (n.includes('solana')) return 'Solana';
            return null; // Unknown mock networks -> generic fallback only
        };

        const chainName = isChain
            ? normalizeOverlayChain(item.name)
            : (item.name === 'ETH'
                ? 'Ethereum'
                : (item.name === 'BTC'
                    ? 'Bitcoin'
                    : (item.name === 'SOL'
                        ? 'Solana'
                        : (item.name === 'USDT' || item.name === 'USDC' ? 'Ethereum' : null))));

        const assetName = isChain ? 'native' : item.name;

        const sources = resolveIconSources({ chain: chainName, asset: assetName });

        // Inline Error Handler for Fallback Strategy
        // We use a small inline script or purely rely on <img> fallback if we could, 
        // but since we are injecting HTML string, we need a robust way.
        // We will set src to sources[0] and use onerror to try next.
        // Since sources is an array [CDN, Local, Generic], we can just try index 0.
        // If it fails, the onerror will set to generic fallback (sources[last]).
        // To be safe and avoid complex inline JS, we can just use sources[0] and fallback to generic.

        // Actually, let's use the simplest robust pattern:
        // Use the first source. If it fails, use the generic fallback (sources[sources.length-1]).
        const primarySrc = sources[1] || sources[0];
        const fallbackSrc = sources[sources.length - 1]; // Always generic

        const iconHTML = `<img src="${primarySrc}" onerror="this.onerror=null;this.src='${fallbackSrc}'" class="card-icon-img" alt="${item.name}" style="width: 32px; height: 32px; border-radius: 50%; object-fit: cover; margin-right: 12px;">`;

        const label = type === 'chain'
            ? `<div class="card-name">${item.name}</div><div class="card-tag">${item.type}</div>`
            : `<div class="card-name">${item.name}</div><div class="card-tag">${item.fullName}</div>`;

        // [PHASE 17] Checkmark Icon
        const checkmarkHTML = isSelected
            ? `<div class="card-checkmark"><i class="fa-solid fa-check"></i></div>`
            : '';

        // [PHASE 14] Bitcoin Transfer Mode - Visual Only
        const isBitcoinAsset = !isChain && item.name === 'BTC';
        let modeContainer = null; // [BUGFIX] Hoist variable to outer scope

        if (isBitcoinAsset) {
            // [PHASE 15.1] Wrap chevron + container in isolated controls wrapper
            card.innerHTML = `
                ${iconHTML}
                <div class="card-info">${label}</div>
                ${checkmarkHTML}
                <div class="btc-mode-controls" data-btc-controls>
                    <div class="btc-mode-chevron" data-btc-chevron>
                        <i class="fa-solid fa-chevron-down"></i>
                    </div>
                </div>
            `;

            // Create inline expandable container for Bitcoin modes
            // [BUGFIX] Assignment instead of const
            modeContainer = document.createElement('div');
            modeContainer.className = 'btc-mode-container';
            modeContainer.innerHTML = `
                <div class="btc-mode-pills">
                    <div class="btc-mode-pill">
                        <i class="fa-solid fa-star"></i>
                        <span>Taproot</span>
                        <span class="btc-mode-badge">Recommended</span>
                    </div>
                    <div class="btc-mode-pill">
                        <i class="fa-solid fa-shield-halved"></i>
                        <span>SegWit</span>
                    </div>
                    <div class="btc-mode-pill">
                        <i class="fa-solid fa-clock"></i>
                        <span>Legacy</span>
                    </div>
                </div>
            `;
        } else {
            card.innerHTML = `
                ${iconHTML}
                <div class="card-info">${label}</div>
                ${checkmarkHTML}
            `;
        }

        // [PHASE 10A] CONTRACT BINDING
        // Bind click to authoritative selectAsset()
        card.addEventListener('click', (e) => {
            e.stopPropagation();

            if (card.classList.contains('disabled')) return;

            // [PHASE 15.2] Intent-aware BTC row selection
            // If user clicked inside the BTC controls area (chevron/pills), ignore row selection
            if (e.target.closest('[data-btc-controls]')) {
                return; // Early exit - no asset selection
            }

            // [PHASE 18] AUTHORITY BRIDGE
            // Use passed context (chainContext) for the complementary state
            const selection = {};

            if (isChain) {
                // Selecting Chain
                selection.chain = normalizeOverlayChain(item.name) || item.name;
                selection.asset = chainContext; // Passed from openOverlay as context.asset
                selection.source = 'overlay_chain';
            } else {
                // Selecting Asset
                selection.asset = item.name.toLowerCase(); // ETH -> eth
                selection.chain = chainContext; // Passed from openOverlay as context.chain
                selection.source = 'overlay_asset'; // Explicit source
            }

            if (window.selectAsset) {
                window.selectAsset(selection);
                closeOverlay();
            } else {
                console.warn('[Overlay] selectAsset not found');
            }
        });

        list.appendChild(card);

        // [PHASE 15.1] Append mode container for Bitcoin and bind handlers
        if (isBitcoinAsset && modeContainer) {
            list.appendChild(modeContainer);

            // [PHASE 15.1] Single wrapper handler - stops ALL propagation to card
            const controlsWrapper = card.querySelector('[data-btc-controls]');
            if (controlsWrapper) {
                controlsWrapper.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent card selection for ANY click inside wrapper
                });
            }

            // [PHASE 15.1] Chevron toggle handler (no stopPropagation needed - wrapper handles it)
            const chevron = card.querySelector('[data-btc-chevron]');
            if (chevron) {
                chevron.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Toggle expanded state visually
                    card.classList.toggle('btc-expanded');
                    modeContainer.classList.toggle('btc-expanded');
                });
            }

            // [PHASE 15] Pill click handlers - Local UI state only
            const pills = modeContainer.querySelectorAll('.btc-mode-pill');
            pills.forEach(pill => {
                pill.addEventListener('click', (e) => {
                    e.preventDefault();
                    // Remove active from all pills
                    pills.forEach(p => p.classList.remove('active'));
                    // Add active to clicked pill
                    pill.classList.add('active');

                    // [PHASE 15] Update Global State
                    // Extract type from text content (Taproot/SegWit/Legacy)
                    const typeText = pill.querySelector('span:not(.btc-mode-badge)').textContent.toLowerCase();
                    if (window.setBTCAddressType) {
                        window.setBTCAddressType(typeText);
                    }
                });
            });
        }
    });
}

/**
 * STATE MANAGEMENT (VISUAL ONLY)
 */
let isOverlayOpen = false;

// [PHASE 10B] Context-Aware Open
export function openOverlay(type, context = {}) {
    const overlay = document.getElementById('selectionOverlayContainer');
    const title = document.getElementById('overlayTitle');
    const subtitle = document.getElementById('overlaySubtitle');

    if (overlay && title) {
        // [PHASE 8B] Theme Awareness: Handled via CSS :has() selector
        // No manual class sync required
    }

    if (!overlay || !title) return;

    // Update Text
    if (type === 'chain') {
        title.textContent = 'Select Network';
        subtitle.textContent = 'Choose destination chain';
    } else {
        title.textContent = 'Select Asset';
        subtitle.textContent = 'Choose token to send';
    }

    // [PHASE 8B] Contextual Behavior: Event Signal
    // Priority Rule: Signal that an authoritative overlay is opening
    document.dispatchEvent(new CustomEvent('overlay:opened'));

    // Render Content (Pass Context)
    // Chain open -> Pass asset context (context.asset)
    // Asset open -> Pass chain context (context.chain)
    // [PHASE 17] Pass selected item from context

    if (type === 'chain') {
        renderList(type, context.asset, context.selected);
    } else {
        renderList(type, context.chain, context.selected);
    }

    // Show
    overlay.classList.add('active');
    isOverlayOpen = true;

    // [PHASE 8C] KEYBOARD DISMISSAL (CRITICAL)
    if (document.activeElement && document.activeElement.tagName === 'INPUT') {
        document.activeElement.blur();
    }

    // [PHASE 8C] BACKGROUND SCROLL LOCK
    // Lock both global document and app container
    document.body.style.overflow = 'hidden';
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.style.overflow = 'hidden';
        appContainer.style.pointerEvents = 'none'; // Disable background interaction
    }
}

export function closeOverlay() {
    const overlay = document.getElementById('selectionOverlayContainer');
    if (overlay) {
        overlay.classList.remove('active');
    }
    isOverlayOpen = false;

    // [PHASE 15] Reset BTC mode selection (local UI state cleanup)
    const btcPills = document.querySelectorAll('.btc-mode-pill');
    btcPills.forEach(pill => pill.classList.remove('active'));

    // [PHASE 15] Collapse any expanded BTC rows
    const expandedCards = document.querySelectorAll('.overlay-card-item.btc-expanded');
    expandedCards.forEach(card => card.classList.remove('btc-expanded'));
    const expandedContainers = document.querySelectorAll('.btc-mode-container.btc-expanded');
    expandedContainers.forEach(container => container.classList.remove('btc-expanded'));

    // [PHASE 8C] RESTORE BACKGROUND STATE
    document.body.style.overflow = ''; // Clears inline style, reverts to CSS
    const appContainer = document.querySelector('.app-container');
    if (appContainer) {
        appContainer.style.overflow = ''; // Clears inline style, reverts to CSS (overflow: hidden or auto)
        appContainer.style.pointerEvents = ''; // Restore interaction
    }
}

/**
 * EVENT HANDLERS
 */
function handleOutsideClick(e) {
    if (!isOverlayOpen) return;

    const overlay = document.getElementById('selectionOverlayContainer');
    const triggers = document.querySelectorAll('.chain-chip, .asset-chip');

    // Ignore clicks inside overlay
    if (overlay && overlay.contains(e.target)) return;

    // Ignore clicks on triggers
    let isTrigger = false;
    triggers.forEach(t => {
        if (t.contains(e.target)) isTrigger = true;
    });

    if (!isTrigger) {
        closeOverlay();
    }
}

function handleEscapeKey(e) {
    if (e.key === 'Escape' && isOverlayOpen) {
        closeOverlay();
    }
}

/**
 * INIT (EXPOSED)
 */
export function initSendOverlay() {
    console.log('[SendOverlay] Initializing Visual Scaffolding...');

    // 1. Inject CSS
    if (!document.querySelector('link[href*="send-overlay.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = '/css/modules/send-overlay.css';
        document.head.appendChild(link);
    }

    // 2. Inject HTML
    injectOverlayHTML();

    // 3. Bind Triggers
    const chainChip = document.querySelector('.chain-chip');
    if (chainChip) {
        chainChip.style.cursor = 'pointer';
        chainChip.style.pointerEvents = 'auto'; // Ensure clickable even if app is locked
        chainChip.style.position = 'relative'; // Ensure z-index works
        chainChip.style.zIndex = '200'; // Make sure it sits above blocked app container
        chainChip.addEventListener('click', (e) => {
            e.preventDefault(); // STOP RELOAD / SUBMIT
            e.stopPropagation();
            openOverlay('chain');
        });
    }

    const assetChip = document.querySelector('.asset-chip');
    if (assetChip) {
        assetChip.style.cursor = 'pointer';
        assetChip.style.pointerEvents = 'auto'; // Ensure clickable even if app is locked
        assetChip.style.position = 'relative'; // Ensure z-index works
        assetChip.style.zIndex = '200'; // Make sure it sits above blocked app container
        assetChip.addEventListener('click', (e) => {
            e.preventDefault(); // STOP RELOAD / SUBMIT
            e.stopPropagation();
            openOverlay('asset');
        });
    }

    // 4. Bind Global Dismiss
    document.addEventListener('click', handleOutsideClick);
    document.addEventListener('keydown', handleEscapeKey);
}
