
// Verification Script for LLMRequestBuilder
// Run with: node src/utils/verify-llm.mjs

import { LLMRequestBuilder } from './LLMRequestBuilder.js';

console.log("--- TEST 1: Request Building ---");
const context = {
    chain: 'Ethereum',
    asset: 'ETH',
    amount: '0.5',
    recipientAddress: '0x123...abc'
};
const userText = "Is this safe?";

const request = LLMRequestBuilder.buildRequest({
    userText,
    context
});

console.log("Final Prompt Text:");
console.log(request.text);

console.log("\n--- TEST 2: Response Parsing (Valid JSON) ---");
const validJson = `
\`\`\`json
{
    "type": "answer",
    "title": "Safety Check",
    "content": "This looks acceptable.",
    "confidence": "high",
    "warnings": []
}
\`\`\`
`;
const parsedValid = LLMRequestBuilder.parseResponse(validJson);
console.log("Parsed Valid:", parsedValid);

console.log("\n--- TEST 3: Response Parsing (Fallback) ---");
const rawText = "I cannot answer this in JSON, but be careful.";
const parsedFallback = LLMRequestBuilder.parseResponse(rawText);
console.log("Parsed Fallback:", parsedFallback);
