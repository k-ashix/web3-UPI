/**
 * Prompt Sanitizer
 * Neutralizes prompt injection attempts and enforces length limits.
 */

import { PROMPT_SANITIZER_CONFIG } from '../config/llm-safety.js';

/**
 * Sanitizes user input string.
 * @param {string} userText 
 * @returns {Object} result
 * @returns {string} result.sanitizedText
 * @returns {string[]} result.flagsDetected
 * @returns {boolean} result.wasTruncated
 */
export function sanitizeUserPrompt(userText) {
    if (typeof userText !== 'string') return { sanitizedText: '', flagsDetected: [], wasTruncated: false };

    let text = userText;
    let wasTruncated = false;
    const flagsDetected = [];

    // 1. Enforce Max Length
    // Prevents resource exhaustion attacks and context overflow
    // Default limit: 2000 characters (configurable in llm-safety config)
    const { MAX_USER_INPUT_CHARS, INJECTION_PATTERNS } = PROMPT_SANITIZER_CONFIG;
    if (text.length > MAX_USER_INPUT_CHARS) {
        text = text.substring(0, MAX_USER_INPUT_CHARS);
        wasTruncated = true;
    }

    // 2. Scan and Neutralize Injection Phrases
    // Detects and removes common prompt injection patterns like:
    // - "ignore previous instructions"
    // - "system:", "assistant:", "user:" (role confusion)
    // - "reveal", "show me the prompt", "your instructions"
    // Each detected pattern is logged for monitoring
    INJECTION_PATTERNS.forEach(pattern => {
        if (pattern.test(text)) {
            // Log flag (string representation of regex)
            const label = pattern.source.replace(/\\b/g, '').replace(/\\/g, '');
            flagsDetected.push(`Injection: ${label}`);

            // Neutralize (Remove matches)
            // Replace with placeholder instead of empty string to preserve context
            text = text.replace(pattern, '[REMOVED]');
        }
    });

    // 3. Wrap in Delimiters to isolate from System Prompt
    // Prevents user input from "bleeding into" system instructions
    // The model is instructed to only treat content between these tags as user input
    // This creates a clear boundary between trusted (system) and untrusted (user) text
    const sanitizedText = `[USER_INPUT_START]
${text}
[USER_INPUT_END]`;

    return {
        sanitizedText,
        flagsDetected,
        wasTruncated
    };
}
