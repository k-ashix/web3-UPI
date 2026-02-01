/**
 * src/ui/screen/DockSection.js
 * SCREEN SECTION
 * Responsibilities:
 * - Manages Balance Strip (Privacy Shutter, Value)
 * - Manages Action Grid & Dock Buttons
 * - Handles "Feature Gating" (Prompts wallet connect if locked)
 */

import { AppState } from '../../core/AppState.js';
import { OverlayLifecycle } from '../effects/OverlayLifecycle.js';
import { OverlayAnimations } from '../effects/OverlayAnimations.js';
import { InteractionUtils } from '../../utils/InteractionUtils.js';

export const DockSection = {
    // Selectors
    _getBalanceValue: () => document.getElementById('balanceValue'),
    _getShutter: () => document.getElementById('privacyShutter'),
    _getActions: () => document.querySelectorAll('.action-btn, .scan-btn, .utility-left, .utility-right'),
    _getBlur: () => document.getElementById('overlayBlur'),

    // Logic State
    _shutterTimer: null,

    init() {
        console.log('[DockSection] Initializing...');
        this._setupShutter();
        this._setupActions();

        // Initial Render
        this.render(AppState.state);

        // Subscribe
        AppState.subscribe((state) => {
            this.render(state);
        });
    },

    /**
     * Replicates exactly the Privacy Shutter logic
     */
    _setupShutter() {
        const shutter = this._getShutter();
        if (!shutter) return;

        const closeShutter = () => {
            shutter.classList.remove('revealed');
        };

        const resetTimer = () => {
            clearTimeout(this._shutterTimer);
            if (shutter.classList.contains('revealed')) {
                this._shutterTimer = setTimeout(closeShutter, 5000);
            }
        };

        // Click Handler
        shutter.addEventListener('click', (e) => {
            e.stopPropagation();
            shutter.classList.toggle('revealed');

            if (shutter.classList.contains('revealed')) {
                resetTimer();
            } else {
                clearTimeout(this._shutterTimer);
            }
        });

        // Global Auto-Close
        document.addEventListener('click', (e) => {
            if (!shutter.contains(e.target)) {
                if (shutter.classList.contains('revealed')) {
                    resetTimer();
                }
            }
        });
    },

    /**
     * Replicates Action Button logic + Feature Gating
     */
    _setupActions() {
        // We use delegation or iteration. Iteration is fine for this fixed set.
        const actions = this._getActions();
        const blur = this._getBlur();

        actions.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // 1. Check Connection Requirement
                // STRICT AUTHORITY GATE
                if (!AppState.hasWalletAuthority()) {
                    e.preventDefault();
                    e.stopImmediatePropagation();

                    // STRICT AUTHORITY GATE
                    // UX FIX: Re-Gate instead of Alert
                    OverlayLifecycle.open('walletOverlay');
                    OverlayAnimations.animateFromOrigin(btn, 'walletOverlay');
                    return;
                }

                // 2. Normal Behavior (Connected)

                // Visual Recoil
                document.body.style.transform = "scale(0.98)";
                setTimeout(() => document.body.style.transform = "scale(1)", 150);

                // Flash Blur
                if (blur) {
                    blur.classList.add('active');
                    setTimeout(() => blur.classList.remove('active'), 800);
                }

                // (Stub) Logic for Send/Swap/Scan would go here
                const actionName = btn.dataset.action || 'Unknown Feature';

                if (actionName === 'send') {
                    // Feature Implemented: Directly trigger integration
                    InteractionUtils.openSend();
                    return;
                }

                // Scan button handler
                if (btn.classList.contains('scan-btn')) {
                    InteractionUtils.openScan();
                    return;
                }

                InteractionUtils.handleWIP(actionName);
                console.log('[Dock] Action triggered:', actionName);
            });
        });
    },

    render(state) {
        // 1. Update Balance Text
        const balanceEl = this._getBalanceValue();
        if (balanceEl) {
            balanceEl.textContent = state.wallet.balance || '≈ $0.00';
        }

        // 2. Update Feature Lock Visuals
        // (Optional: Grey out buttons if not connected)
        const lockedClass = 'feature-locked';
        const els = [
            document.querySelector('.action-grid'),
            document.querySelector('.balance-strip'),
            document.querySelector('.scan-btn-wrapper'),
            document.querySelector('.utility-left'),
            document.querySelector('.utility-right')
        ];

        const isConnected = AppState.hasWalletAuthority();

        els.forEach(el => {
            if (!el) return;
            if (isConnected) {
                el.classList.remove(lockedClass);
            } else {
                el.classList.add(lockedClass);
            }
        });
    }
};
