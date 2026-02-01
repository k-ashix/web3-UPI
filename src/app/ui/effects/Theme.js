/**
 * src/ui/effects/Theme.js
 * VISUAL THEME MANAGEMENT
 * Responsibilities:
 * - Detects System Preference (Dark/Light)
 * - Reads/Writes LocalStorage for preference
 * - Toggles 'dark-mode' class on Body
 * - Manages Toggle Switch UI state
 */

export const Theme = {
    init() {
        // 1. Apply Initial Theme
        this._applyInitialTheme();

        // 2. Bind Toggle Button
        this._setupToggle();
    },

    _applyInitialTheme() {
        // AUTHORITY MODEL:
        // 1. Check User Preference (LocalStorage) - Highest Priority
        // 2. Check System Preference (Media Query) - Fallback

        const saved = localStorage.getItem('theme_preference');
        let isDark = false;

        if (saved) {
            // User has manually chosen
            isDark = (saved === 'dark');
            console.log(`[Theme] Applying User Preference: ${saved}`);
        } else {
            // No user interaction yet, use System
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                isDark = true;
            }
            console.log(`[Theme] Applying System Preference: ${isDark ? 'Dark' : 'Light'}`);
        }

        this._apply(isDark);
    },

    _apply(isDark) {
        if (isDark) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
        this._syncToggleVisuals(isDark);
    },

    _setupToggle() {
        const toggleBtn = document.getElementById('darkModeToggle');
        if (!toggleBtn) return;

        toggleBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent accidental form submits if wrapped
            this._toggle();
        });
    },

    _toggle() {
        const body = document.body;
        // Determine NEW state
        const isCurrentlyDark = body.classList.contains('dark-mode');
        const isNextDark = !isCurrentlyDark;

        // Persist
        localStorage.setItem('theme_preference', isNextDark ? 'dark' : 'light');

        // Apply via Authority
        this._apply(isNextDark);
    },

    _syncToggleVisuals(isDark) {
        const toggleBtn = document.getElementById('darkModeToggle');
        if (!toggleBtn) return;

        const switchEl = toggleBtn.querySelector('.toggle-switch');
        if (switchEl) {
            if (isDark) {
                switchEl.classList.add('active');
            } else {
                switchEl.classList.remove('active');
            }
        }
    }
};
