/**
 * Gemini Model Router
 * Manages model selection and automated fallbacks without user intervention.
 */

import { MODEL_CONFIG } from '../config/llm-safety.js';

class GeminiModelRouter {
    constructor() {
        // Start with the fastest, most advanced preview model
        // Gemini 2.0 Flash Exp offers the best balance of speed and quality for chat interactions
        this.currentModel = MODEL_CONFIG.DEFAULT_MODEL;
        // Track models that have failed to avoid retrying them unnecessarily
        this.failedModels = new Set();
    }

    /**
     * Get the currently active model.
     * Selection strategy:
     * 1. Try the default model (gemini-2.0-flash-exp) first
     * 2. If it fails, fall back to stable models (gemini-1.5-flash-002)
     * 3. If all fail, try Pro model (gemini-1.5-pro-002) for highest quality
     * 4. If everything is exhausted, reset and retry default (handles transient errors)
     * @returns {string} Model name (e.g. "gemini-1.5-pro")
     */
    selectModel() {
        // If current model is marked as failed, try to pick next available fallback
        if (this.failedModels.has(this.currentModel)) {
            const nextModel = MODEL_CONFIG.FALLBACK_MODELS.find(m => !this.failedModels.has(m));
            if (nextModel) {
                this.currentModel = nextModel;
            } else {
                // All failed? Reset to default and hope for transient resolution, or stick to last fallback
                // For now, let's stick to default if everything is broken to allow retries
                if (this.failedModels.size >= 1 + MODEL_CONFIG.FALLBACK_MODELS.length) {
                    // Soft reset to allow retries after exhaustion
                    // This handles transient quota issues that may resolve after a short time
                    this.failedModels.clear();
                    this.currentModel = MODEL_CONFIG.DEFAULT_MODEL;
                }
            }
        }

        if (typeof window !== 'undefined' && window.__DEBUG_GEMINI__) {
            // De-duplicate logs or log only on change if needed, but per-request log is asked
            // We'll log in the overlay instead to avoid spam here
        }

        return this.currentModel;
    }

    /**
     * Report a failure for the current model.
     * Triggers fallback on next selection.
     * Common failure scenarios:
     * - 429: Rate limit exceeded (quota)
     * - 503: Model temporarily unavailable
     * - 400: Invalid request format (should not trigger fallback, but defensive)
     * @param {string} modelName 
     */
    reportFailure(modelName) {
        if (!modelName) return;
        this.failedModels.add(modelName);
        console.warn(`[GeminiRouter] Model failed: ${modelName}. Switching to fallback.`);
    }

    /**
     * Reset router state (e.g. on successful app reload or manual reset)
     * Useful for clearing failure history after a user refreshes or when debugging
     */
    reset() {
        this.currentModel = MODEL_CONFIG.DEFAULT_MODEL;
        this.failedModels.clear();
    }
}

// Singleton instance
export const modelRouter = new GeminiModelRouter();
