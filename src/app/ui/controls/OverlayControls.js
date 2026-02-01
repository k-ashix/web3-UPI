/**
 * src/ui/controls/OverlayControls.js
 * CONTROL AUTHORITY
 * Responsibilities:
 * - Handles ALL overlay control interactions (Close, Skip, Menu)
 * - Uses Document-Level Event Delegation (Robust against DOM changes)
 * - Dispatches Intent to Logic Layers (OverlayLifecycle, etc.)
 * - NO Direct DOM Manipulation (Visuals)
 */

import { OverlayLifecycle } from '../effects/OverlayLifecycle.js';
import { OverlayAnimations } from '../effects/OverlayAnimations.js';
import { LandingFlow } from '../flow/LandingFlow.js';

export const OverlayControls = {
    init() {
        console.log('[OverlayControls] Initializing Global Control Authority...');
        this._bindGlobalControls();
    },

    _bindGlobalControls() {
        document.addEventListener('click', (e) => {
            // 1. Close Buttons (.close-btn)
            // Universal handler for any "X" button inside an overlay
            const closeBtn = e.target.closest('.close-btn');
            if (closeBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[OverlayControls] Close Action Detected');
                OverlayLifecycle.closeAll();
                OverlayAnimations.removeGlassDepth(); // Ensure Visual Reset
                return;
            }

            // 2. Skip Wallet Button (#skipWalletBtn)
            // Specific handler for the "Skip for now" text
            const skipBtn = e.target.closest('#skipWalletBtn');
            if (skipBtn) {
                e.preventDefault();
                e.stopPropagation();
                // DELEGATE: Landing Flow Authority handles the consequences
                LandingFlow.onSkip();
                return;
            }

            // 3. Notification Menu (•••)
            // Handler for the 3-dot menu in notifications
            const menuBtn = e.target.closest('.menu-dots');
            if (menuBtn) {
                e.preventDefault();
                e.stopPropagation();
                console.log('[OverlayControls] Menu Toggle');

                const menu = document.getElementById('notificationMenu');
                if (menu) menu.classList.toggle('active');
                return;
            }

            // 4. Notification Menu Items
            const menuItem = e.target.closest('.menu-item');
            if (menuItem) {
                e.preventDefault();
                e.stopPropagation();

                const action = menuItem.dataset.action;
                console.log(`[OverlayControls] Menu Action: ${action}`);

                // Close Menu
                const menu = document.getElementById('notificationMenu');
                if (menu) menu.classList.remove('active');
                return;
            }

            // 5. Global Close (Design: Click Outside Menu)
            // If we clicked something else, and the menu is open, close it.
            const menu = document.getElementById('notificationMenu');
            if (menu && menu.classList.contains('active')) {
                // If the click was NOT on the menu button (handled above) 
                // and NOT on the menu itself (handled somewhat, but let's be safe)
                if (!e.target.closest('.notification-menu')) {
                    menu.classList.remove('active');
                }
            }
        });
    }
};
