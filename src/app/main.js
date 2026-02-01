/**
 * src/main.js
 * ENTRY POINT
 * Responsibilities:
 * - Bootstraps AppState
 * - Initializes HomeScreen
 * - Wires Services to Core
 * - NO UI logic here
 */

// Core
import { AppState } from './core/AppState.js';

// Services
import { WalletService } from './services/WalletService.js';

// UI
import { HomeScreen } from './ui/screen/HomeScreen.js';
import { Theme } from './ui/effects/Theme.js';
import { OverlayControls } from './ui/controls/OverlayControls.js';
import { LandingFlow } from './ui/flow/LandingFlow.js';

// Global Authority
import GeminiOverlay from '../../../vendor/gemini/gemini-overlay.js';
// [DEV] AI Safety Debug Hook (Origin + Flag gated)
import '../../src/utils/ai-debug-window.js';


async function bootstrap() {
    console.log('[Main] Bootstrapping App...');

    // 0. Gemini Boot Authority (Phase 1C-B.0)
    // Guarantee initialization on app load (Singleton)
    if (GeminiOverlay) {
        GeminiOverlay.init();
        console.log('[Main] Gemini Authority Established');
    }

    // 1. Initialize Visual Theme first (prevents flash)
    Theme.init();

    // 2. Initialize Core State (Data)
    // Loads chain config, default user data, etc.
    AppState.init();

    // 3. Initialize Global Controls (The Safety Net)
    // MUST run before other UI logic prevents clicks
    OverlayControls.init();

    // 3b. Safe Wallet Restore (No UI Prompt)
    // Rule: Attempt silent restore before deciding Landing Flow
    try {
        // Guard: If user explicitly disconnected this session, do not auto-restore
        // (Note: This flag resets on full page reload, as requested)
        if (!AppState.state.sessionDisconnected) {
            const authorized = await WalletService.getAuthorizedAccount();
            if (authorized) {
                console.log('[Main] Restoring connection:', authorized.address);

                // Requirement A: Immediate Identity Rendering
                // Set state NOW so UI updates immediately (Address only)
                AppState.setConnection(authorized);

                // Then fetch secondary data asynchronously (Non-blocking)
                WalletService.getBalance(authorized.address, authorized.type)
                    .then(bal => AppState.setBalance(bal))
                    .catch(e => console.warn('Balance fetch failed', e));

                if (authorized.type === 'ethereum' && authorized.chainId === '0x1') {
                    WalletService.resolveENS(authorized.address)
                        .then(ens => { if (ens) AppState.updateUser({ ens }); })
                        .catch(e => console.warn('ENS fetch failed', e));
                }
            }
        }
    } catch (err) {
        console.warn('[Main] Restore failed:', err);
    }

    // 4. Initialize Flow Authority
    // This will now check AppState.wallet.isConnected and SKIP overlay if restored
    LandingFlow.init();

    // DEV: Expose Test Helper
    window.addTestNotification = () => {
        import('./core/AppState.js').then(m => m.AppState.addTestNotification());
    };

    // DEV: Interaction Safety Assert
    // Scans for invisible blocking elements on boot
    setTimeout(() => {
        const blockingCandidates = document.querySelectorAll('*');
        blockingCandidates.forEach(el => {
            const style = window.getComputedStyle(el);
            if (style.position === 'fixed' && style.pointerEvents !== 'none' && style.display !== 'none') {
                // Ignore known overlays
                if (!el.classList.contains('wallet-overlay') && !el.classList.contains('liquid-overlay')) {
                    console.warn('⚠️ POTENTIAL CLICK BLOCKER DETECTED:', el);
                }
            }
        });
    }, 2000);

    // 5. Initialize Shell/Screen (Layout & Delegation)
    // Sets up all global event listeners and initial DOM state
    HomeScreen.init();

    // 6. Wire Wallet Card Clicks
    // Attach click listeners to wallet option cards
    const walletCards = document.querySelectorAll('.wallet-option-card');
    walletCards.forEach(card => {
        card.addEventListener('click', () => {
            const type = card.getAttribute('data-type');

            // NOTE: Wallet connection actions are NOT gated. 
            // We must allow the user to connect to GAIN authority.

            if (type && type !== 'walletconnect') {
                // WalletConnect not implemented in this phase
                LandingFlow.handleWalletConnection(type);
            } else if (type === 'walletconnect') {
                alert('WalletConnect integration coming soon!');
            }
        });
    });

    // 7. Wire External Services -> Core
    // Listen for wallet events (account change, chain change)
    WalletService.subscribe((event) => {
        // Strict Unidirectional Flow: Service -> AppState
        // The AppState will then notify the UI if needed
        if (event.type === 'accountsChanged') {
            AppState.handleAccountChange(event.payload);
        } else if (event.type === 'chainChanged') {
            AppState.handleChainChange(event.payload);
        } else if (event.type === 'disconnect') {
            AppState.disconnectWallet();
        }
    });

    console.log('[Main] App Ready.');
}

// Start Lifecycle
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
