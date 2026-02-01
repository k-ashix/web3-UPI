/**
 * LLM Request Builder
 * Wraps user input with system prompt and format enforcement.
 */

import { SYSTEM_PROMPT, OUTPUT_SCHEMA, DEFAULT_LIMITS } from '../config/llm-safety.js';
import { sanitizeUserPrompt } from './PromptSanitizer.js';

export class LLMRequestBuilder {

    /**
     * Builds the final payload for the Gemini API.
     * @param {Object} params - { userText, context, history }
     * @returns {Object} Wrapper object containing the system-prompt-enhanced structure.
     */
    static buildRequest({ userText, context, history = [] }) {
        // 1. Sanitize User Input
        // First line of defense: remove injection attempts and enforce length limits
        // Returns sanitized text wrapped in delimiters, plus flags for monitoring
        const { sanitizedText, flagsDetected, wasTruncated } = sanitizeUserPrompt(userText);

        if (typeof window !== 'undefined' && window.__DEBUG_GEMINI__) {
            if (flagsDetected.length > 0) console.warn('[SafeLLM] Injection Flags:', flagsDetected);
            if (wasTruncated) console.warn('[SafeLLM] Input truncated');
        }

        // 2. Build Context Block
        // Provides transaction-relevant information to help the AI give accurate answers
        // SECURITY: Only whitelisted fields are included to prevent state leakage
        // Fields like internal IDs, debug flags, or API keys are never passed to the model
        let contextBlock = '';
        if (context && Object.keys(context).length > 0) {
            const parts = [];
            // Whitelist context fields to avoid leaking internal state
            if (context.chain) parts.push(`Chain: ${context.chain}`);
            if (context.asset) parts.push(`Asset: ${context.asset}`);
            if (context.amount) parts.push(`Amount: ${context.amount}`);
            if (context.amountUsd) parts.push(`AmountUSD: ${context.amountUsd}`);

            // Address Handling (Mask/Show) - Showing for now as it's critical for "Is this address safe?"
            // FUTURE: Could add address masking (show first/last 6 chars) for extra privacy
            if (context.recipientAddress || context.address) {
                parts.push(`Recipient: ${context.recipientAddress || context.address}`);
            }

            if (parts.length > 0) {
                contextBlock = `[CURRENT TRANSACTION CONTEXT]\n${parts.join('\n')}\n`;
            }
        }

        // 3. Assemble Final Prompt
        // Structure: [SYSTEM] + [CONTEXT] + [USER_INPUT]
        // This order ensures:
        // - System instructions are read first (rules/constraints)
        // - Context is provided as factual background
        // - User input is clearly delimited to prevent instruction override
        const systemBlock = `[SYSTEM INSTRUCTIONS]\n${SYSTEM_PROMPT}\n`;
        // inputBlock already contains [USER_INPUT_START] wrappers from sanitizer
        const inputBlock = `\n${sanitizedText}\n`;

        const finalPromptText = `${systemBlock}${contextBlock}${inputBlock}`;

        return {
            text: finalPromptText,
            // We could return systemInstruction separately if we upgraded the API call structure,
            // but sticking to text injection is safer for "minimal/additive" constraint.
        };
    }

    /**
     * DOM-safe JSON parser with fallback.
     * @param {string} responseText 
     * @returns {Object} Structured data { type, title, content, ... }
     */
    static parseResponse(responseText) {
        if (!responseText) return { type: 'answer', title: 'Error', content: 'No response received.' };

        try {
            // 1. Cleaner: data often comes wrapped in markdown ```json ... ```
            let clean = responseText.trim();
            if (clean.startsWith('```json')) {
                clean = clean.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (clean.startsWith('```')) {
                clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }

            // 2. Try strict parse
            const data = JSON.parse(clean);

            // 3. Validate structure (soft validation)
            if (data.type && data.content) {
                return data;
            }
            // If partial structure, try to salvage
            return {
                type: data.type || 'answer',
                title: data.title || 'Response',
                content: data.content || JSON.stringify(data),
                confidence: data.confidence || 'high',
                warnings: data.warnings || [],
                sources: data.sources || []
            };

        } catch (e) {
            // 4. Fallback for non-JSON text (Model ignored instructions)
            // We treat the whole text as content.
            return {
                type: 'answer', // Assume valid since we can't detect refusal easily without parsing
                title: 'Gemini',
                content: responseText, // Raw text
                confidence: 'medium',
                warnings: [], // No structured warnings
                sources: []
            };
        }
    }
}
