/**
 * Response Guardrails
 * Validates and normalizes model output BEFORE rendering.
 * Enforces safety policies that the model might have missed.
 */

import { GUARDRAIL_CONFIG } from '../config/llm-safety.js';

/**
 * Main Guardrail Function
 * @param {Object} parsedResponse - The object returned from LLMRequestBuilder.parseResponse
 * @param {Object} metadata - { userText, context }
 * @returns {Object} SafeResponseObject strictly adhering to schema
 */
export function normalizeAndGuardrailModelResponse(parsedResponse, { userText, context } = {}) {
    // 1. Schema Normalization (Ensure all fields exist)
    // Guarantees the UI always receives a valid response object, even if model output is malformed
    // Defaults are chosen to be safe: type='answer', confidence='medium'
    const safeResponse = {
        type: ['answer', 'refusal', 'clarify'].includes(parsedResponse?.type) ? parsedResponse.type : 'answer',
        title: typeof parsedResponse?.title === 'string' ? parsedResponse.title : 'Response',
        content: typeof parsedResponse?.content === 'string' ? parsedResponse.content : JSON.stringify(parsedResponse),
        confidence: ['low', 'medium', 'high'].includes(parsedResponse?.confidence) ? parsedResponse.confidence : 'medium',
        warnings: Array.isArray(parsedResponse?.warnings) ? [...parsedResponse.warnings] : [],
        sources: Array.isArray(parsedResponse?.sources) ? [...parsedResponse.sources] : []
    };

    const { MAX_RESPONSE_CHARS, UNCERTAINTY_PHRASES, BLOCK_PATTERNS } = GUARDRAIL_CONFIG;

    // 2. Length Check
    // Prevents excessively long responses from consuming UI space or memory
    // Truncation is logged as a warning so users know they're seeing partial output
    if (safeResponse.content.length > MAX_RESPONSE_CHARS) {
        safeResponse.content = safeResponse.content.substring(0, MAX_RESPONSE_CHARS) + '... (truncated)';
        safeResponse.warnings.push('Response was too long and has been truncated.');
    }

    // 3. Scan for Uncertainty Language
    // Downgrade confidence if model sounds unsure but marked itself high/medium
    // Phrases like "I'm not sure", "probably", "might be" indicate the model is uncertain
    // This protects users from overconfident but incorrect answers
    const lowerContent = safeResponse.content.toLowerCase();
    const hasUncertainty = UNCERTAINTY_PHRASES.some(phrase => lowerContent.includes(phrase));

    if (hasUncertainty) {
        if (safeResponse.confidence === 'high') safeResponse.confidence = 'medium';
        else if (safeResponse.confidence === 'medium') safeResponse.confidence = 'low';

        if (!safeResponse.warnings.includes('Contains uncertain language.')) {
            safeResponse.warnings.push('Contains uncertain language.');
        }
    }

    // 4. Block Patterns (Dangerous Claims / Hallucinations)
    // Final safety check: scan for responses that violate safety policies
    // Examples of blocked patterns:
    // - Requesting private keys or seed phrases
    // - Offering to execute transactions (AI should only advise, not act)
    // - Phishing/scam language ("contact support at...", "send funds to...")
    // Action types:
    // - 'refusal': Completely replace response with safety message
    // - 'clarify': Keep response but downgrade confidence and add warning
    for (const rule of BLOCK_PATTERNS) {
        if (rule.pattern.test(safeResponse.content)) {
            // Log for dev (do not expose secrets)
            if (typeof window !== 'undefined' && window.__DEBUG_GEMINI__) {
                console.warn(`[Guardrails] Triggered rule: ${rule.label}`);
            }

            if (rule.action === 'refusal') {
                safeResponse.type = 'refusal';
                safeResponse.title = 'Safety Block';
                safeResponse.content = `This response was blocked because it contained unsafe content (${rule.label}).`;
                safeResponse.confidence = 'low';
                // Clear other fields to avoid leaking dangerous text
                safeResponse.warnings = ['Safety Policy Violation'];
                safeResponse.sources = [];
                // Stop processing other rules (Priority block)
                return safeResponse;
            } else if (rule.action === 'clarify') {
                safeResponse.type = 'clarify';
                safeResponse.confidence = 'low';
                safeResponse.warnings.push(`Limitation: ${rule.message || rule.label}`);

                if (rule.message && !safeResponse.content.includes(rule.message)) {
                    safeResponse.content += `\n\n**Note:** ${rule.message}`;
                }
            }
        }
    }

    return safeResponse;
}
