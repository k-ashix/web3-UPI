/**
 * src/ui/effects/OverlayLifecycle.js
 * LIFECYCLE MANAGEMENT ONLY
 * Responsibilities:
 * - DOM existence (display: flex/none)
 * - Lifecycle State (active class)
 * - Pointer Event Locking (auto/none)
 * - Timer Cleanup
 * 
 * DOMAINS:
 * - Does NOT handle 'scale-back' (Visual)
 * - Does NOT handle 'expand-from-origin' (Visual)
 */

import { OverlayAnimations } from './OverlayAnimations.js';

export const OverlayLifecycle = {
    ANIMATION_DURATION: 500,

    /**
     * Sets the overlay to OPEN state
     * @param {string} id 
     */
    open(id) {
        // Enforce Single Active Overlay
        this.closeAll();

        const overlay = document.getElementById(id);
        if (overlay) {
            // 1. Enter Flow
            overlay.style.display = 'flex';

            // 2. Force Reflow (Safety for transitions)
            void overlay.offsetWidth;

            // 3. Set Lifecycle State
            overlay.classList.add('active');

            // 4. Unlock Input
            overlay.style.pointerEvents = 'auto';
        }
    },

    /**
     * Sets the overlay to CLOSED state
     * @param {string} id 
     */
    close(id) {
        const overlay = document.getElementById(id);
        if (overlay) {
            // 1. Remove Lifecycle State
            overlay.classList.remove('active');

            // 2. Lock Input Immediately
            overlay.style.pointerEvents = 'none';

            // 3. Cleanup after transition
            setTimeout(() => {
                // Guard: Ensure it hasn't been re-opened
                if (!overlay.classList.contains('active')) {
                    overlay.style.display = 'none';
                }
            }, this.ANIMATION_DURATION);
        }
    },

    /**
     * Closes ALL known overlays
     */
    closeAll() {
        const overlays = document.querySelectorAll('.liquid-overlay, #walletOverlay');
        const blurObj = document.getElementById('overlayBlur');

        overlays.forEach(el => {
            if (el.id) this.close(el.id);
        });

        // Handle global blur layer lifecycle
        if (blurObj) {
            blurObj.classList.remove('active');
            blurObj.style.pointerEvents = 'none';
        }

        // Release Global Body Lock
        document.body.style.pointerEvents = 'auto';

        // Ensure Environment Resets (Visuals)
        OverlayAnimations.removeGlassDepth();
    }
};
