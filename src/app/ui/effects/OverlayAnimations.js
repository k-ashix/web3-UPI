/**
 * src/ui/effects/OverlayAnimations.js
 * VISUAL EFFECTS ONLY
 * Responsibilities:
 * - Setting CSS variables for origin-based animations
 * - Toggling visual-only classes (scale-back, expand-from-origin)
 * - Coordinates deep visual properties (glass depth)
 */

export const OverlayAnimations = {
    _getContainer: () => document.querySelector('.glass-container'),

    /**
     * Applies the 'Depth' effect to the main container
     * Usually called when an overlay opens
     */
    applyGlassDepth() {
        const container = this._getContainer();
        if (container) {
            container.classList.add('scale-back');
        }
    },

    /**
     * Removes the 'Depth' effect
     * Usually called when overlays close
     */
    removeGlassDepth() {
        const container = this._getContainer();
        if (container) {
            container.classList.remove('scale-back');
        }
    },

    /**
     * Prepares and triggers the specific "Expand from Button" animation
     * @param {HTMLElement} targetElement - The button clicked
     * @param {string} overlayId - The overlay to animate
     */
    animateFromOrigin(targetElement, overlayId) {
        const overlay = document.getElementById(overlayId);
        if (!overlay || !targetElement) return;

        // 1. Calculate Center
        const rect = targetElement.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        // 2. Set CSS Variables (The overlay uses these for transform-origin)
        overlay.style.setProperty('--origin-x', `${centerX}px`);
        overlay.style.setProperty('--origin-y', `${centerY}px`);

        // 3. Trigger Animation Class
        // We assume the lifecycle manager has already set display:fbex
        requestAnimationFrame(() => {
            overlay.classList.add('expand-from-origin');
        });
    },

    /**
     * Resets animation classes for a specific overlay
     * @param {string} id 
     */
    reset(id) {
        const overlay = document.getElementById(id);
        if (overlay) {
            overlay.classList.remove('expand-from-origin', 'contract-to-origin');
        }
    }
};
