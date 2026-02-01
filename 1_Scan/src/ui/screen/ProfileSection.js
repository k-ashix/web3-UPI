/**
 * src/ui/screen/ProfileSection.js
 * PROFILE FORM MANAGEMENT
 * Responsibilities:
 * - Manages Profile Overlay Inputs (Name, Email, ENS, Address)
 * - Persists User Data to AppState
 * - Handles Change Detection (Show/Hide Save Button)
 * - Handles Wallet Disconnect
 */

import { AppState } from '../../core/AppState.js';
import { OverlayLifecycle } from '../effects/OverlayLifecycle.js';
import { OverlayAnimations } from '../effects/OverlayAnimations.js';

export const ProfileSection = {
    // Selectors
    _getNameInput: () => document.getElementById('inputName'),
    _getEmailInput: () => document.getElementById('inputEmail'),
    _getEnsInput: () => document.getElementById('inputENS'),
    _getAddrInput: () => document.getElementById('inputAddress'),
    _getDisconnectBtn: () => document.getElementById('disconnectBtn'),
    _getSaveBtn: () => document.getElementById('saveProfileBtn'),

    init() {
        console.log('[ProfileSection] Initializing...');
        this._setupListeners();

        // Initial Render
        this.render(AppState.state);

        // Subscribe to State
        AppState.subscribe((state) => {
            this.render(state);
        });
    },

    _setupListeners() {
        const nameInput = this._getNameInput();
        const emailInput = this._getEmailInput();
        const saveBtn = this._getSaveBtn();
        const disconnectBtn = this._getDisconnectBtn();

        // 1. Change Detection
        const checkChanges = () => {
            const state = AppState.state.user;
            if (!nameInput || !emailInput || !state) return;

            // Strict comparison
            const hasChanges = (
                nameInput.value.trim() !== state.name ||
                emailInput.value.trim() !== state.email
            );

            if (saveBtn) {
                // Feature Requirement: Hide/Disable when no changes
                saveBtn.style.display = hasChanges ? 'block' : 'none';
            }
        };

        if (nameInput) nameInput.addEventListener('input', checkChanges);
        if (emailInput) emailInput.addEventListener('input', checkChanges);

        // 2. Save Action
        if (saveBtn) {
            saveBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this._handleSave();
            });
        }

        // 3. Disconnect Action (App-Level)
        if (disconnectBtn) {
            disconnectBtn.addEventListener('click', () => {
                console.log('[ProfileSection] App-level disconnect requested');

                // 1. Close profile overlay
                OverlayLifecycle.close('profileOverlay');

                // 2. Clear app state (wallet data, ENS)
                AppState.disconnectWallet();

                // 3. Remove glass depth effect
                OverlayAnimations.removeGlassDepth();

                // 4. Reopen wallet gate for reconnection
                setTimeout(() => {
                    OverlayLifecycle.open('walletOverlay');
                }, 300); // Small delay for smooth transition
            });
        }
    },

    _handleSave() {
        const nameInput = this._getNameInput();
        const emailInput = this._getEmailInput();

        if (nameInput && emailInput) {
            const newName = nameInput.value.trim();
            const newEmail = emailInput.value.trim();

            if (!newName) return; // Basic validation

            // 1. Update State (Single Source of Truth)
            AppState.updateUser({
                name: newName,
                email: newEmail
            });

            // 2. Persist (Mock for now, typically AppState handles this but requirement asked here)
            // Ideally AppState should handle persistence, but we'll follow instructions.
            localStorage.setItem('user_profile', JSON.stringify({ name: newName, email: newEmail }));

            // Fix: Reset UI state (Hide Save Button)
            const saveBtn = this._getSaveBtn();
            if (saveBtn) {
                saveBtn.style.display = 'none';
            }

            // 3. Quiet Close (No delay, no flash)
            OverlayLifecycle.close('profileOverlay');
        }
    },

    render(state) {
        const user = state.user;
        const wallet = state.wallet; // For readonly fields

        this._updateFieldIfSafe('inputName', user.name);
        this._updateFieldIfSafe('inputEmail', user.email);

        // Read-only fields - safe to overwrite always
        const ensInput = this._getEnsInput();
        if (ensInput) {
            // Hide ENS row completely if no ENS exists
            const ensField = ensInput.closest('.profile-edit-field');
            if (user.ens) {
                ensInput.value = user.ens;
                if (ensField) ensField.style.display = '';
            } else {
                ensInput.value = '';
                if (ensField) ensField.style.display = 'none';
            }
        }

        const addrInput = this._getAddrInput();
        // Prefer wallet address if connected, else hide
        if (addrInput) {
            addrInput.value = AppState.hasWalletAuthority() ? wallet.address : '';
        }
    },

    _updateFieldIfSafe(id, newValue) {
        const el = document.getElementById(id);
        if (el && document.activeElement !== el) {
            el.value = newValue || '';
        }
    }
};
