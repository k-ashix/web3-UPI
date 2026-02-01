
// Verification Script for Response Guardrails
// Run with: node src/utils/verify-guardrails.mjs

import { normalizeAndGuardrailModelResponse } from './ResponseGuardrails.js';
import { GUARDRAIL_CONFIG } from '../config/llm-safety.js';

console.log("--- TEST BEGIN: Response Guardrails ---");

// Test 1: Valid Normalization (No issues)
const valid = {
    type: "answer",
    title: "Safe",
    content: "This is a safe response.",
    confidence: "high"
};
const res1 = normalizeAndGuardrailModelResponse(valid);
console.log("\n[Test 1] Valid Pass-through:",
    res1.content === valid.content && res1.confidence === 'high' ? "PASS" : "FAIL"
);

// Test 2: Length Truncation
const longContent = "A".repeat(GUARDRAIL_CONFIG.MAX_RESPONSE_CHARS + 100);
const res2 = normalizeAndGuardrailModelResponse({ ...valid, content: longContent });
console.log("\n[Test 2] Length Truncation:",
    res2.content.length <= GUARDRAIL_CONFIG.MAX_RESPONSE_CHARS + 20 && res2.warnings.some(w => w.includes('truncated')) ? "PASS" : "FAIL"
);

// Test 3: Uncertainty Detection
const uncertain = { ...valid, content: "I think this might be the address provided." };
const res3 = normalizeAndGuardrailModelResponse(uncertain);
console.log("\n[Test 3] Uncertainty Downgrade:",
    res3.confidence === 'medium' && res3.warnings.some(w => w.includes('uncertain language')) ? "PASS" : "FAIL"
);

// Test 4: Financial Risk Block
const risky = { ...valid, content: "This is a guaranteed return investment strategy." };
const res4 = normalizeAndGuardrailModelResponse(risky);
console.log("\n[Test 4] Financial Risk Block (Refusal):",
    res4.type === 'refusal' && res4.content.includes('unsafe content') ? "PASS" : "FAIL"
);

// Test 5: Capability Hallucination (Broad Check)
const hallucinations = [
    "I verified this onchain and confirmed it.",
    "I checked Etherscan and confirmed it's audited.",
    "I looked up the transaction hash.",
    "This contract is audited and safe."
];

console.log("\n[Test 5] Capability Hallucination Batch Test:");
let passCount = 0;

hallucinations.forEach((text, i) => {
    const res = normalizeAndGuardrailModelResponse({ ...valid, content: text, confidence: 'high' });
    const isClarify = res.type === 'clarify';
    const hasDisclaimer = res.content.includes("can't verify on-chain");
    const isLowConf = res.confidence === 'low';

    if (isClarify && hasDisclaimer && isLowConf) {
        console.log(`  Case ${i + 1}: PASS ("${text.substring(0, 30)}...")`);
        passCount++;
    } else {
        console.log(`  Case ${i + 1}: FAIL ("${text}") -> Type: ${res.type}, Conf: ${res.confidence}`);
    }
});

console.log(`Result: ${passCount}/${hallucinations.length} PASS`);

console.log("\n--- TEST END ---");
