/**
 * AI Debug Window Hooks
 * Exposes safety guardrails and request builders for console testing.
 * ENABLE: 
 *  1. Run on localhost/local network
 *  2. Add ?debug=1 to URL OR set localStorage.setItem('AI_DEBUG', '1')
 */
import { LLMRequestBuilder } from './LLMRequestBuilder.js';
import { normalizeAndGuardrailModelResponse } from './ResponseGuardrails.js';

(function () {
    if (typeof window === 'undefined') return;

    // 1. Check Local Origin
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local');

    // 2. Check Debug Flag
    let isDebug = false;
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const debugParam = urlParams.get('debug');
        const debugStore = localStorage.getItem('AI_DEBUG');

        isDebug = (debugParam === '1') || (debugStore === '1');
    } catch (e) {
        isDebug = false;
    }

    // 3. Expose if Enabled
    if (isLocal && isDebug) {
        console.log("%c[AI DEBUG] Safety Hooks Enabled", "background: #222; color: #bada55; font-weight: bold; padding: 4px;");
        console.log("Access via window.__AI_DEBUG__");

        window.__AI_DEBUG__ = {
            /**
             * Test the Guardrail logic
             * Example: window.__AI_DEBUG__.guardrail({ type: 'answer', content: 'Profit guaranteed' })
             */
            guardrail: (parsedResponse) => {
                const result = normalizeAndGuardrailModelResponse(parsedResponse, {
                    userText: '[DEBUG_USER]',
                    context: { chain: 'DEBUG_CHAIN' }
                });
                console.log("[AI DEBUG] Guardrail Result:", result);
                return result;
            },

            /**
             * Test Request Builder
             * Example: window.__AI_DEBUG__.buildRequest("Is this safe?", { asset: 'ETH' })
             */
            buildRequest: (userText, context = {}) => {
                const result = LLMRequestBuilder.buildRequest({ userText, context });
                console.log("[AI DEBUG] Built Request Payload:", result);
                return result;
            }
        };
    }
})();
