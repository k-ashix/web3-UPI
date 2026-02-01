/**
 * src/ui/screen/HeaderSection.js
 * SCREEN SECTION
 * Responsibilities:
 * - Manages the Header area (Profile Ring, Greeting, Notification Btn)
 * - Binds UI events to OverlayLifecycle (Open Profile/Notif)
 * - Updates Greeting/Avatar based on AppState
 */

import { AppState } from '../../core/AppState.js';
import { OverlayLifecycle } from '../effects/OverlayLifecycle.js';
import { OverlayAnimations } from '../effects/OverlayAnimations.js';

export const HeaderSection = {
    // Selectors
    _getGreeting: () => document.getElementById('greetingTitle'),
    _getAvatar: () => document.getElementById('headerAvatar'),
    _getProfileArea: () => document.querySelector('.user-profile'),
    _getNotifBtn: () => document.querySelector('.notification-btn'),
    _getNotifMenuBtn: () => document.querySelector('.menu-dots'),

    init() {
        try {
            console.log('[HeaderSection] Initializing...');
            this._setupEventListeners();

            // Initial Render
            this.render(AppState.state);

            // Subscribe to State Changes
            AppState.subscribe((state) => {
                this.render(state);
            });

        } catch (err) {
            console.warn('[HeaderSection] Failed to initialize:', err);
            // Failure is isolated; rest of app continues
        }
    },

    _setupEventListeners() {
        // 1. Profile Click -> Open Profile Overlay
        const profileArea = this._getProfileArea();
        if (profileArea) {
            profileArea.addEventListener('click', () => {
                // REMOVED: OverlayAnimations.applyGlassDepth() - Causes unwanted flash/blocking

                // Trigger Logic Open
                OverlayLifecycle.open('profileOverlay');
            });
        }

        // 2. Notification Click -> Open Notification Overlay
        const notifBtn = this._getNotifBtn();
        if (notifBtn) {
            notifBtn.addEventListener('click', () => {
                // Trigger Logic Open
                OverlayAnimations.applyGlassDepth();
                OverlayLifecycle.open('notificationOverlay');
            });
        }
    },

    render(state) {
        // Update Greeting
        const greetingEl = this._getGreeting();
        if (greetingEl && state.user) {
            greetingEl.textContent = `Hey, ${state.user.name}`;
        }

        // Update Avatar (Optional if dynamic)
        const avatarEl = this._getAvatar();
        if (avatarEl && state.user && state.user.avatar) {
            // Only update if changed to avoid flicker
            if (!avatarEl.src.includes(state.user.avatar)) {
                avatarEl.src = state.user.avatar;
            }
        }
    }
};
