/**
 * src/utils/InteractionUtils.js
 * UTILITY ONLY
 * Responsibilities:
 * - Centralized handler for WIP/Stubbed features
 * - Provides non-blocking feedback (Toast)
 * - Zero dependency on other modules (except explicit injections)
 * 
 * DEBUG: window.__DEBUG_INTERACTION__
 */

// Debug Flag
if (typeof window.__DEBUG_INTERACTION__ === 'undefined') {
    window.__DEBUG_INTERACTION__ = false;
}

function log(msg) {
    if (window.__DEBUG_INTERACTION__) console.log(`[Interaction] ${msg}`);
}

export const InteractionUtils = {
    /**
     * Handles clicks for features not yet implemented
     * @param {string} featureName 
     */
    handleWIP(featureName) {
        if (featureName === 'send') {
            this._mountSendFeature();
            return;
        }
        log(`WIP Triggered: ${featureName}`);
        this.showToast(`Work in progress — ${featureName} coming soon`);
    },

    /**
     * Public API to trigger Send Overlay
     */
    openSend() {
        this._mountSendFeature();
    },

    async _mountSendFeature() {
        const shell = document.querySelector('.glass-container');
        if (!shell) return;

        // 1. Toggle if already exists
        /*
         * SEND LIFECYCLE GUARD
         * Contract: SEND_LIFECYCLE_CONTRACT_v1.md
         * Re-entry Logic:
         * We use enterSendLifecycle() because it preserves state.
         * We MUST NOT re-run init logic or resets here.
         */
        const existing = document.getElementById('send-overlay-injected');
        if (existing) {
            const isHidden = existing.style.display === 'none';
            existing.style.display = isHidden ? 'flex' : 'none';

            // [PHASE 8B] Context Exit Rule
            // If closing Send (going to none), signal exit
            if (!isHidden) {
                document.dispatchEvent(new CustomEvent('send:exit'));
            }

            // On re-open, re-enter Send lifecycle without re-running initSendUI or resets.
            if (isHidden && typeof window.enterSendLifecycle === 'function') {
                window.enterSendLifecycle();
                // [LIFECYCLE] Fire send:enter event for coordination
                document.dispatchEvent(new CustomEvent('send:enter'));
            }
            return;
        }

        // 2. Load Styles Once (Main + Theme)
        if (!document.getElementById('send-css')) {
            const link = document.createElement('link');
            link.id = 'send-css';
            link.rel = 'stylesheet';
            link.href = '/css/modules/send.css';
            document.head.appendChild(link);

            const themeLink = document.createElement('link');
            themeLink.id = 'send-theme-css';
            themeLink.rel = 'stylesheet';
            themeLink.href = '/css/modules/send-theme.css';
            document.head.appendChild(themeLink);
        }

        // 3. Fetch, Parse, and Inject
        try {
            const resp = await fetch('/sections/send.html');
            if (!resp.ok) return;

            const text = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const app = doc.querySelector('.app-container');

            if (app) {
                app.id = 'send-overlay-injected';

                // Basic Asset Re-basing (For assets not handled by direct path update)
                app.querySelectorAll('img').forEach(img => {
                    const original = img.getAttribute('src');
                    // If it starts with assets/send (already updated), leave it. 
                    // If it's relative like "assets/foo.png", rebase it to "assets/send/foo.png" if needed.
                    // Since we updated HTML to be explicit "assets/send/", we just need to ensure no other relative paths break.
                    // The previous logic rebasing to '../2_Send/' is obsolete. 
                    // We trust the HTML update we just did, or adjust only if needed.
                });

                // Mount inside Shell (Authority Context)
                shell.appendChild(app);

                // 4. Inject Logic (Once)
                if (!window.__sendLoaded) {
                    const script = document.createElement('script');
                    script.type = 'module';
                    script.src = '/src/modules/send.js';
                    script.addEventListener('load', () => {
                        window.__sendLoaded = true;
                        log('Send script loaded');
                        if (typeof window.enterSendLifecycle === 'function') {
                            window.enterSendLifecycle();
                        }
                        // [LIFECYCLE] Fire send:enter event for coordination
                        document.dispatchEvent(new CustomEvent('send:enter'));
                    });
                    document.body.appendChild(script);
                } else if (typeof window.enterSendLifecycle === 'function') {
                    // If script already loaded before first mount, still ensure lifecycle entry.
                    window.enterSendLifecycle();
                    // [LIFECYCLE] Fire send:enter event for coordination
                    document.dispatchEvent(new CustomEvent('send:enter'));
                }
            }
        } catch (e) {
            console.warn('[Interaction] Send injection failed', e);
        }
    },

    /**
     * Public API to trigger Scan Overlay
     */
    openScan() {
        this._mountScanFeature();
    },

    async _mountScanFeature() {
        const shell = document.querySelector('.glass-container');
        if (!shell) return;

        // 1. Toggle if already exists
        const existing = document.getElementById('scan-overlay-injected');
        if (existing) {
            existing.style.display = existing.style.display === 'none' ? 'block' : 'none';
            return;
        }

        // 2. Load Styles Once
        if (!document.getElementById('scan-css')) {
            const link = document.createElement('link');
            link.id = 'scan-css';
            link.rel = 'stylesheet';
            link.href = 'scan-styles.css';
            document.head.appendChild(link);
        }

        // 3. Fetch, Parse, and Inject
        try {
            const resp = await fetch('scan.html');
            if (!resp.ok) return;

            const text = await resp.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const scanContainer = doc.querySelector('.scan-container');

            if (scanContainer) {
                const wrapper = document.createElement('div');
                wrapper.id = 'scan-overlay-injected';
                wrapper.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 3000;';
                wrapper.appendChild(scanContainer);

                // Mount inside Shell
                shell.appendChild(wrapper);

                // 4. Inject Logic (Once)
                if (!window.__scanLoaded) {
                    const script = document.createElement('script');
                    script.src = 'scan-script.js';
                    document.body.appendChild(script);
                    window.__scanLoaded = true;
                    log('Scan script loaded');
                }
            }
        } catch (e) {
            console.warn('[Interaction] Scan injection failed', e);
        }
    },

    /**
     * Displays a temporary, non-blocking toast message
     * Uses inline styles to avoid CSS pollution during Stub phase
     * @param {string} message 
     */
    showToast(message) {
        // 1. Check/Remove existing
        const existing = document.getElementById('wip-toast');
        if (existing) existing.remove();

        // 2. Create Element
        const toast = document.createElement('div');
        toast.id = 'wip-toast';
        toast.textContent = message;

        // 3. Styling (Safe/Isolated)
        Object.assign(toast.style, {
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            transform: 'translateX(-50%) translateY(20px)',
            background: 'rgba(20, 20, 25, 0.9)',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            zIndex: '9999',
            opacity: '0',
            transition: 'all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
            pointerEvents: 'none', // Non-blocking
            whiteSpace: 'nowrap'
        });

        document.body.appendChild(toast);

        // 4. Animate In
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });

        // 5. Auto Remove
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(10px)';
            setTimeout(() => {
                if (toast.isConnected) toast.remove();
            }, 300);
        }, 2500);
    }
};
