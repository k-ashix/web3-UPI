/**
 * src/services/WalletService.js
 * EXTERNAL IO ONLY
 * Responsibilities:
 * - Detects Wallet Providers (EVM, Solana)
 * - Handling Connection Requests
 * - Fetching Balances (RPC)
 * - Listening to Provider Events
 * - RETURNS PLAIN DATA ONLY (No State Mutation, No UI)
 */

class WalletServiceManager {
    constructor() {
        this.providers = {
            ethereum: null,
            solana: null
        };
        this._listeners = [];
        this._setupListeners();
    }

    // --- Detection ---

    isEthereumAvailable() {
        return typeof window.ethereum !== 'undefined';
    }

    isSolanaAvailable() {
        return typeof window.solana !== 'undefined' && window.solana.isPhantom === true;
    }

    /**
     * Detects all available wallet providers
     * Returns detailed information about MetaMask, Rabby, and Phantom
     * NO SIDE EFFECTS - Detection only, no connection attempts
     */
    detectAvailableWallets() {
        const result = {
            ethereum: {
                available: false,
                providers: []
            },
            solana: {
                available: false,
                provider: null
            }
        };

        // --- Ethereum Provider Detection ---
        if (typeof window.ethereum !== 'undefined') {
            result.ethereum.available = true;

            // Check for multiple providers (MetaMask + Rabby coexistence)
            if (Array.isArray(window.ethereum.providers) && window.ethereum.providers.length > 0) {
                // Multiple injected providers detected
                window.ethereum.providers.forEach(provider => {
                    if (provider.isMetaMask === true) {
                        result.ethereum.providers.push('metamask');
                    }
                    if (provider.isRabby === true) {
                        result.ethereum.providers.push('rabby');
                    }
                });
            } else {
                // Single provider
                if (window.ethereum.isMetaMask === true) {
                    result.ethereum.providers.push('metamask');
                }
                if (window.ethereum.isRabby === true) {
                    result.ethereum.providers.push('rabby');
                }
            }

            // Fallback: If no specific provider identified but ethereum exists
            if (result.ethereum.providers.length === 0) {
                result.ethereum.providers.push('unknown');
            }
        }

        // --- Solana Provider Detection ---
        if (this.isSolanaAvailable()) {
            result.solana.available = true;
            result.solana.provider = 'phantom';
        }

        // Log detection results once for debugging
        console.log('[WalletService] Detected wallets:', result);

        return result;
    }


    // --- Connection ---

    async connect(type) {
        if (type === 'ethereum') {
            return this._connectEthereum();
        } else if (type === 'solana') {
            return this._connectSolana();
        }
        console.warn('[WalletService] Unsupported type:', type);
        return null;
    }

    async _connectEthereum() {
        if (!this.isEthereumAvailable()) {
            console.warn('[WalletService] Ethereum provider not found');
            return { error: 'PROVIDER_NOT_FOUND' };
        }

        const provider = window.ethereum;
        try {
            const accounts = await provider.request({ method: 'eth_requestAccounts' });
            const chainId = await provider.request({ method: 'eth_chainId' });

            // Normalize Chain Data
            const netData = this._getNetworkData(chainId);

            return {
                address: accounts[0],
                chainId: chainId,
                isTestnet: netData.isTestnet,
                networkName: netData.name,
                type: 'ethereum'
            };
        } catch (error) {
            console.error('[WalletService] Eth Connection Error:', error);
            return null;
        }
    }

    async _connectSolana() {
        if (!this.isSolanaAvailable()) {
            console.warn('[WalletService] Solana provider not found');
            return { error: 'PROVIDER_NOT_FOUND' };
        }

        const provider = window.solana;
        try {
            const resp = await provider.connect();
            const pubKey = resp.publicKey.toString();

            return {
                address: pubKey,
                chainId: 'solana-mainnet',
                isTestnet: false,
                networkName: 'Solana Mainnet',
                type: 'solana'
            };
        } catch (error) {
            console.error('[WalletService] Sol Connection Error:', error);
            return null;
        }
    }

    /**
     * Checks if the user is ALREADY connected without prompting.
     * Uses 'eth_accounts' (read-only) instead of 'eth_requestAccounts'.
     */
    async getAuthorizedAccount() {
        if (!this.isEthereumAvailable()) return null;

        try {
            const provider = window.ethereum;
            // Silent check - does NOT trigger popup
            const accounts = await provider.request({ method: 'eth_accounts' });

            if (accounts && accounts.length > 0) {
                // SECURITY: Verify we can actually speak to the chain
                // If MetaMask is locked or request fails, treat as disconnected
                try {
                    const chainId = await provider.request({ method: 'eth_chainId' });
                    const netData = this._getNetworkData(chainId);

                    return {
                        address: accounts[0],
                        chainId: chainId,
                        isTestnet: netData.isTestnet,
                        networkName: netData.name,
                        type: 'ethereum'
                    };
                } catch (chainError) {
                    console.warn('[WalletService] Chain check failed (Locked?):', chainError);
                    return null;
                }
            }
        } catch (error) {
            console.warn('[WalletService] Authorized check failed:', error);
        }
        return null;
    }

    // --- Data Fetching ---

    async getBalance(address, type) {
        if (type === 'ethereum') {
            return this._getEthBalance(address);
        } else if (type === 'solana') {
            return this._getSolBalance(address);
        }
        return '---';
    }

    async _getEthBalance(address) {
        if (!this.isEthereumAvailable()) return '---';
        try {
            const balHex = await window.ethereum.request({
                method: 'eth_getBalance',
                params: [address, "latest"]
            });
            const balWei = parseInt(balHex, 16);
            const balEth = balWei / 1e18;
            return balEth.toFixed(4);
        } catch (e) {
            console.error('[WalletService] Eth Balance Error:', e);
            return '---';
        }
    }

    async _getSolBalance(address) {
        // Public RPC endpoint
        const endpoint = "https://api.mainnet-beta.solana.com";
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getBalance',
                    params: [address]
                })
            });
            const data = await response.json();
            if (data.result && data.result.value !== undefined) {
                const lamports = data.result.value;
                const sol = lamports / 1e9;
                return sol.toFixed(4);
            }
        } catch (e) {
            console.error('[WalletService] Sol Balance Error:', e);
        }
        return '---';
    }

    /**
     * Resolves ENS name for an Ethereum address
     * Only works on Mainnet (chainId 0x1)
     * Returns null if no ENS found or on error (silent fallback)
     */
    async resolveENS(address) {
        if (!this.isEthereumAvailable()) {
            return null;
        }

        try {
            // ENS reverse lookup using eth_call
            // This is a simplified version - uses public resolver
            const provider = window.ethereum;

            // First, check if address has a reverse record
            // For simplicity, we'll use a direct lookup method if available
            // Note: Full ENS resolution requires contract calls or ethers.js
            // For now, we return null and rely on future library integration

            console.log('[WalletService] ENS resolution not yet implemented (requires ethers.js)');
            return null;

        } catch (e) {
            console.error('[WalletService] ENS Resolution Error:', e);
            return null;
        }
    }

    // --- Event Listeners ---

    subscribe(callback) {
        this._listeners.push(callback);
    }

    _emit(event) {
        this._listeners.forEach(cb => cb(event));
    }

    _setupListeners() {
        if (this.isEthereumAvailable()) {
            window.ethereum.on('chainChanged', (chainId) => {
                const netData = this._getNetworkData(chainId);
                this._emit({
                    type: 'chainChanged',
                    payload: {
                        chainId,
                        isTestnet: netData.isTestnet,
                        networkName: netData.name
                    }
                });
            });

            window.ethereum.on('accountsChanged', (accounts) => {
                if (accounts.length === 0) {
                    this._emit({ type: 'disconnect' });
                } else {
                    this._emit({
                        type: 'accountsChanged',
                        payload: { address: accounts[0] }
                    });
                }
            });
        }
    }

    // --- Helpers ---

    _getNetworkData(chainId) {
        const id = parseInt(chainId, 16);
        switch (id) {
            case 1: return { name: 'Mainnet', isTestnet: false };
            case 5: return { name: 'Goerli', isTestnet: true };
            case 11155111: return { name: 'Sepolia', isTestnet: true };
            case 137: return { name: 'Polygon', isTestnet: false };
            default: return { name: `Chain ID: ${id}`, isTestnet: true };
        }
    }
}

export const WalletService = new WalletServiceManager();
