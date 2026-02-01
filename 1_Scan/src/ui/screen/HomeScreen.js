/**
 * src/ui/screen/HomeScreen.js
 * SCREEN ORCHESTRATOR
 * Responsibilities:
 * - Initializes Child Sections (Header, Dock, Profile)
 * - Manages Identity Carousel (Swipe, Render)
 * - Handles Global Blur Click
 * - (Wallet/Landing logic moved to LandingFlow.js)
 */

import { AppState } from '../../core/AppState.js';
import { OverlayLifecycle } from '../effects/OverlayLifecycle.js';
import { OverlayAnimations } from '../effects/OverlayAnimations.js';
import { HeaderSection } from './HeaderSection.js';
import { DockSection } from './DockSection.js';

import { ProfileSection } from './ProfileSection.js';
import { NotificationSection } from './NotificationSection.js';

export const HomeScreen = {
    // Selectors
    _getCarousel: () => document.getElementById('chainCarousel'),
    _getBlur: () => document.getElementById('overlayBlur'),

    init() {
        console.log('[HomeScreen] Initializing...');

        // 1. Init Children
        HeaderSection.init();
        DockSection.init();
        ProfileSection.init();
        NotificationSection.init();

        // 2. Init Local Logic
        this._setupCarousel();
        this._setupBlur();
        this._setupGlobalControls();

        // 3. Initial Render (Carousel)
        this.renderCarousel(AppState.state);

        // 4. Subscribe
        AppState.subscribe((state) => {
            // RE-RENDER CAROUSEL to show/hide status pills
            this.renderCarousel(state);
        });
    },

    // --- Carousel Logic ---

    _setupCarousel() {
        const carousel = this._getCarousel();
        if (!carousel) return;

        // Swipe Logic
        let startX = 0;

        carousel.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
        });

        carousel.addEventListener('touchend', e => {
            const endX = e.changedTouches[0].clientX;
            const threshold = 50;
            if (startX - endX > threshold) {
                this._nextChain();
            } else if (endX - startX > threshold) {
                this._prevChain();
            }
        });

        carousel.addEventListener('click', (e) => {
            // Cycle if not copying
            if (!e.target.closest('.copy-icon-btn')) {
                this._nextChain();
            }
        });
    },

    _nextChain() {
        const state = AppState.state;
        const nextIdx = (state.currentChainIndex + 1) % state.chains.length;
        AppState.setChainIndex(nextIdx);
    },

    _prevChain() {
        const state = AppState.state;
        const prevIdx = (state.currentChainIndex - 1 + state.chains.length) % state.chains.length;
        AppState.setChainIndex(prevIdx);
    },

    renderCarousel(state) {
        const carousel = this._getCarousel();
        if (!carousel) return;

        carousel.innerHTML = '';

        // If not connected, hide the entire carousel
        if (!AppState.hasWalletAuthority()) {
            carousel.style.display = 'none';
            return;
        }

        // Wallet is connected - show carousel
        carousel.style.display = '';

        // Wallet is connected - show identity pills with real data
        state.chains.forEach((chain) => {
            const card = document.createElement('div');
            card.className = 'identity-card';

            // Only show if this chain matches the connected wallet type
            let showIdentity = false;
            let displayAddress = null;
            let displayENS = null;

            if (chain.id === 'eth' && state.wallet.type === 'ethereum') {
                showIdentity = true;
                displayAddress = state.wallet.address; // Real checksummed address
                displayENS = state.user.ens || null; // Real ENS or null
            } else if (chain.id === 'sol' && state.wallet.type === 'solana') {
                showIdentity = true;
                displayAddress = state.wallet.address; // Real Solana address
                displayENS = null; // Solana doesn't have ENS
            }

            if (showIdentity && displayAddress) {
                card.innerHTML = `
                    <div class="chain-logo-wrapper">
                        <img src="${chain.logo}" alt="${chain.name}">
                    </div>
                    <div class="identity-pill" style="--chain-bg: ${chain.theme.bg}">
                        <div class="id-text-group">
                            <span class="wallet-address">${this._shorten(displayAddress)}</span>
                            ${displayENS ? `<span class="ens-name">${displayENS}</span>` : ''}
                        </div>
                    </div>
                `;

                // Add copy-to-clipboard functionality
                const pill = card.querySelector('.identity-pill');
                if (pill) {
                    pill.style.cursor = 'pointer';
                    pill.addEventListener('click', (e) => {
                        e.stopPropagation(); // Prevent carousel cycling
                        this._copyAddress(displayAddress);
                    });
                }
            } else {
                // Non-active chain - just show logo
                card.innerHTML = `
                    <div class="chain-logo-wrapper">
                        <img src="${chain.logo}" alt="${chain.name}">
                    </div>
                `;
            }

            carousel.appendChild(card);
        });

        this.updateCarouselView(state.currentChainIndex);
    },

    updateCarouselView(index) {
        const carousel = this._getCarousel();
        if (carousel) {
            const offset = -(index * 100);
            carousel.style.transform = `translateX(${offset}%)`;
        }
    },

    _shorten(addr) {
        if (!addr || addr.length < 10) return addr;
        // Preserve original case - do NOT transform
        return `${addr.substring(0, 10)}...${addr.substring(addr.length - 4)}`;
    },

    /**
     * Copy full address to clipboard
     * Preserves checksummed case
     */
    _copyAddress(address) {
        if (!address) {
            console.warn('[HomeScreen] No address to copy');
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(address)
                .then(() => {
                    console.log('[HomeScreen] Copied address:', address);
                })
                .catch(err => {
                    console.error('[HomeScreen] Copy failed:', err);
                });
        } else {
            console.warn('[HomeScreen] Clipboard API not available');
        }
    },

    // --- Global Interactions ---

    _setupBlur() {
        const blur = this._getBlur();
        if (blur) {
            blur.addEventListener('click', () => {
                OverlayLifecycle.closeAll();
                OverlayAnimations.removeGlassDepth();
            });
        }
    },

    _setupGlobalControls() {
        // 5. Global Controls
        // Legacy 'onclick' cleanup handled by HTML removal
        // New Control Authority (OverlayControls.js) handles Skip & Close buttons globally
    }
};
