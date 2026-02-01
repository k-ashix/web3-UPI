/**
 * src/core/AppState.js
 * SINGLE SOURCE OF TRUTH
 * Responsibilities:
 * - Holds ALL app state (User, Wallet, Chains, Flags)
 * - Exposes actions to mutate state
 * - Emits changes to subscribers
 * - NO DOM references
 */

const DEFAULT_CHAINS = [
    {
        id: 'eth',
        name: 'Ethereum',
        logo: 'assets/eth.png',
        theme: { bg: 'linear-gradient(90deg, #627eea, #a3b7ff)', color: '#627eea' }
    },
    {
        id: 'btc',
        name: 'Bitcoin',
        logo: 'assets/btc.png',
        theme: { bg: 'linear-gradient(90deg, #f7931a, #ffd54f)', color: '#f7931a' }
    },
    {
        id: 'sol',
        name: 'Solana',
        logo: 'assets/sol.png',
        theme: { bg: 'linear-gradient(90deg, #14f195, #9945ff)', color: '#14f195' }
    }
];

const DEFAULT_USER = {
    name: 'Max',
    email: 'max@web3.com',
    ens: null,
    address: null,
    avatar: 'assets/avatar.png'
};

class AppStateManager {
    constructor() {
        this._state = {
            // User Data
            user: { ...DEFAULT_USER },

            // App Config
            chains: [...DEFAULT_CHAINS],

            // UI State
            currentChainIndex: 0,

            // Wallet State (Merged from WalletStateManager)
            wallet: {
                isConnected: false,
                address: null,
                activeChainId: null, // e.g., 'eth', 'sol'
                networkName: null,
                balance: '0.00',
                type: null // 'ethereum', 'solana'
            },

            // Session Authority
            sessionDisconnected: false, // Guard against auto-restore loops

            // Notifications
            notifications: []
        };

        this._listeners = [];
    }

    // --- Lifecycle ---

    init() {
        // Here we could load from localStorage if we wanted persistence
        // For now, we start fresh to ensure secure state
        console.log('[AppState] Initialized');
        this._notify();
    }

    // --- Actions ---

    /**
     * Updates user profile data
     */
    updateUser(updates) {
        this._state.user = { ...this._state.user, ...updates };
        console.log('[AppState] User updated:', updates);
        this._notify();
    }

    setChainIndex(index) {
        if (index >= 0 && index < this._state.chains.length) {
            this._state.currentChainIndex = index;

            // If connected, we might want to sync wallet? 
            // In this strict architecture, changing the carousel index 
            // does NOT automatically switch the wallet network unless explicit.
            // But for the visual sync, we just update the index.

            this._notify();
        }
    }

    /**
     * Sets full wallet connection state
     */
    setConnection(payload) {
        const { address, chainId, isTestnet, networkName, type } = payload;
        this._state.wallet = {
            ...this._state.wallet,
            isConnected: true,
            address,
            activeChainId: chainId,
            networkName,
            type
        };
        console.log('[AppState] Wallet Connected:', chainId);
        this._notify();
    }

    setBalance(balanceAmount) {
        this._state.wallet.balance = balanceAmount;
        this._notify();
    }

    disconnectWallet() {
        // Clear wallet state
        this._state.wallet = {
            isConnected: false,
            address: null,
            activeChainId: null,
            networkName: null,
            balance: '0.00',
            type: null
        };

        // Clear wallet-specific user data (ENS)
        // Preserve user profile data (name, email)
        this._state.user.ens = null;

        // Mark session as explicitly disconnected
        // This prevents auto-restore logic from re-connecting in this session
        this._state.sessionDisconnected = true;

        console.log('[AppState] Wallet Disconnected (App-Level)');
        this._notify();
    }

    // --- Notification Actions ---

    clearNotifications() {
        this._state.notifications = [];
        this._notify();
    }

    markAllRead() {
        this._state.notifications = this._state.notifications.map(n => ({ ...n, read: true }));
        this._notify();
    }

    // DEV ONLY - Remove before production
    addTestNotification() {
        const type = Math.random() > 0.5 ? 'eth' : 'sol';
        const newNotif = {
            id: Date.now(),
            title: type === 'eth' ? 'ETH Received' : 'SOL Swapped',
            message: type === 'eth' ? 'You received 0.5 ETH' : 'Swapped 10 SOL for USDC',
            time: 'Just now',
            type: type,
            read: false
        };
        this._state.notifications = [newNotif, ...this._state.notifications];
        this._notify();
    }

    // --- Accessors (Read Only) ---

    get state() {
        return { ...this._state }; // Shallow copy protection
    }

    get currentChain() {
        return this._state.chains[this._state.currentChainIndex];
    }

    /**
     * SINGLE SOURCE OF TRUTH for Wallet Authority
     * Returns true ONLY if wallet is connected AND has a valid address.
     * UI components should use this instead of checking isConnected manually.
     */
    hasWalletAuthority() {
        return this._state.wallet.isConnected === true &&
            !!this._state.wallet.address;
    }

    // --- Subscription ---

    subscribe(callback) {
        this._listeners.push(callback);
        // Immediate call to sync new subscribers
        callback(this.state);
        return () => {
            this._listeners = this._listeners.filter(cb => cb !== callback);
        };
    }

    _notify() {
        const snapshot = this.state;
        this._listeners.forEach(cb => cb(snapshot));
    }
}

// Export Singleton
export const AppState = new AppStateManager();
