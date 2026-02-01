/**
 * src/ui/flow/LandingFlow.js
 * LANDING FLOW AUTHORITY
 * Responsibilities:
 * - Decides initial state (Wallet Overlay vs Home)
 * - Handles "Skip for now" transition
 * - Ensures total visual cleanup on skip
 * - Orchestrates wallet connection flow
 */

import { AppState } from '../../core/AppState.js';
import { WalletService } from '../../services/WalletService.js';
import { OverlayLifecycle } from '../effects/OverlayLifecycle.js';
import { OverlayAnimations } from '../effects/OverlayAnimations.js';

export const LandingFlow = {
    init() {
        console.log('[LandingFlow] Initializing...');
        this._checkInitialRoute();
        this._wireConnectButton();
    },

    /**
     * Decides what options to show on first load
     */
    _checkInitialRoute() {
        // Rule: If not connected, show Wallet Overlay
        // This is the "Gate" behavior
        if (!AppState.state.wallet.isConnected) {
            console.log('[LandingFlow] User not connected. Opening Wallet Gate.');
            // Defer slightly to ensure DOM is ready
            setTimeout(() => {
                OverlayLifecycle.open('walletOverlay');
            }, 100);
        }
    },

    /**
     * Wire up the "Connect Wallet" button to show wallet options
     */
    _wireConnectButton() {
        const connectBtn = document.getElementById('connectMainBtn');
        const walletIntro = document.querySelector('.wallet-intro-center');

        if (connectBtn && walletIntro) {
            connectBtn.addEventListener('click', () => {
                // Check if already connected - auto-close overlay
                if (AppState.state.wallet.isConnected) {
                    console.log('[LandingFlow] Already connected - closing overlay');
                    this.onSkip();
                    return;
                }

                walletIntro.classList.add('show-options');
            });
        }
    },

    /**
     * Handles wallet connection for a specific type
     * Orchestrates: WalletService -> AppState -> UI
     * ALWAYS attempts connection - no guards based on connection state
     */
    async handleWalletConnection(type) {
        console.log('[LandingFlow] Connection request for:', type);
        console.log('[LandingFlow] Current connection state:', AppState.state.wallet.isConnected);

        try {
            // 1. Attempt connection via WalletService
            const result = await WalletService.connect(type);

            // 2. Handle errors
            if (!result) {
                alert('Connection cancelled. Please try again.');
                return;
            }

            if (result.error === 'PROVIDER_NOT_FOUND') {
                const installLink = type === 'ethereum'
                    ? 'https://metamask.io/download/'
                    : 'https://phantom.app/';
                alert(`No ${type} wallet detected. Install from:\n${installLink}`);
                return;
            }

            // 3. Success - Update AppState
            AppState.setConnection(result);
            console.log('[LandingFlow] Connection successful:', result.address);

            // 4. IMMEDIATE ACTION: Close Overlay & Remove Effects
            // Ensure this happens before any secondary data fetching errors can block it
            OverlayLifecycle.closeAll();
            OverlayAnimations.removeGlassDepth();

            // 5. Fetch balance (Non-blocking visual, but we await it for data hygiene)
            try {
                const balance = await WalletService.getBalance(result.address, result.type);
                AppState.setBalance(balance);
            } catch (err) {
                console.warn('[LandingFlow] Failed to fetch balance:', err);
            }

            // 6. Resolve ENS (Ethereum Mainnet only) - Non-blocking
            if (result.type === 'ethereum' && result.chainId === '0x1') {
                try {
                    const ens = await WalletService.resolveENS(result.address);
                    if (ens) {
                        AppState.updateUser({ ens });
                        console.log('[LandingFlow] ENS resolved:', ens);
                    }
                } catch (err) {
                    console.warn('[LandingFlow] Failed to resolve ENS:', err);
                }
            }

        } catch (error) {
            console.error('[LandingFlow] Connection error:', error);

            // Handle user rejection (MetaMask code 4001)
            if (error.code === 4001) {
                alert('Connection cancelled by user.');
            } else {
                alert('Connection failed. Please try again.');
            }
        }
    },

    /**
     * Handles the explicit "Skip" intent from the user
     */
    onSkip() {
        console.log('[LandingFlow] User requested Skip.');

        // 1. Close All Overlays (Logic)
        OverlayLifecycle.closeAll();

        // 2. Reset All Visuals (Physics/Blur)
        OverlayAnimations.removeGlassDepth();

        // 3. Log/Track if needed
        console.log('[LandingFlow] Landing flow complete (Skipped).');
    }
};

