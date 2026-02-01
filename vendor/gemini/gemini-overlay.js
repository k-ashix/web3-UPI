/**
 * Gemini Overlay Module
 * A standalone, portable UI layer for prompt-driven interactions.
 * Updated: LLM Request Builder Integration (Safety Layer)
 */
import { LLMRequestBuilder } from '../../src/utils/LLMRequestBuilder.js';
import { normalizeAndGuardrailModelResponse } from '../../src/utils/ResponseGuardrails.js';
import { modelRouter } from '../../src/utils/GeminiModelRouter.js';


/**
 * Gemini Overlay Module
 * A standalone, portable UI layer for prompt-driven interactions.
 * 
 * RESPONSIBILITIES:
 * - Owns: Singleton management, DOM injection/cleanup, UI state (expanded/collapsed).
 * - Must NOT do: Business logic execution (delegates via callbacks), Router manipulation.
 * - Safe to modify: Internal styling, animation timings, icon assets.
 * 
 * DEBUGGING:
 * - Set window.__DEBUG_GEMINI__ = true to enable logs
 */

// Default Debug Flag
if (typeof window.__DEBUG_GEMINI__ === 'undefined') {
    window.__DEBUG_GEMINI__ = false;
}

function log(msg, ...args) {
    if (window.__DEBUG_GEMINI__) console.log(`[GeminiOverlay] ${msg}`, ...args);
}

class GeminiOverlay {
    constructor() {
        this.rootId = 'gemini-overlay-root';
        this.isInitialized = false;
        this.state = {
            isOpen: false,
            mode: 'medium', // small, medium, full
            mode: 'medium', // small, medium, full
            config: null
        };

        // Conversation State (In-Memory Only)
        this.conversation = [];
        this.abortController = null;
        this.showApiKeyHelper = false;
        this.pendingRetryPrompt = null;

        // Transaction Context (Foundation for future context injection)
        this.transactionContext = {
            address: null,
            chain: null,
            asset: null,
            amount: null,
            isValid: false // Marks if context needs refresh
        };

        // Bind methods
        this.close = this.hide.bind(this);
        this._handleKeydown = this._handleKeydown.bind(this);
    }

    /**
     * Initialize the overlay: inject DOM and Styles.
     * Idempotent: Can be called multiple times safely.
     */
    init() {
        if (this.isInitialized) return;
        log('Initializing...');

        // 1. Inject Stylesheet if not present
        if (!document.querySelector('link[href*="gemini-overlay.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = '../vendor/gemini/gemini-overlay.css'; // Relative path assumption or absolute
            document.head.appendChild(link);
        }

        // 2. Create Root Elements
        if (!document.getElementById(this.rootId)) {
            const root = document.createElement('div');
            root.id = this.rootId;
            root.className = 'gemini-overlay-hidden';
            root.innerHTML = `
                <div class="gemini-backdrop" id="gemini-backdrop"></div>
                <div class="gemini-panel" id="gemini-panel">
                    <div class="gemini-header">
                        <div class="gemini-header-content">
                            <div class="gemini-title">
                                <img src="./assets/gemini-icon.png" alt="Gemini" style="width:20px;height:20px;display:block;" />
                                <span>Gemini</span>
                            </div>
                            <div class="gemini-subtitle">Review and confirm this transaction</div>
                        </div>
                        <div class="gemini-controls">
                            <button class="gemini-expand-btn" id="gemini-expand-btn">
                                <svg class="icon-expand" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M15 3H21V9" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M9 21H3V15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M21 3L14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M3 21L10 14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                                <svg class="icon-collapse" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M4 4L9 9M9 5V9H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M20 4L15 9M15 5V9H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M20 20L15 15M15 19V15H19" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                    <path d="M4 20L9 15M9 19V15H5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                                </svg>
                            </button>
                            <button class="gemini-close-btn" id="gemini-close-btn">
                                <i class="fa-solid fa-xmark"></i>
                            </button>
                        </div>
                    </div>
                    <div class="gemini-body" id="gemini-body">
                        <!-- Dynamic Content -->
                    </div>
                    <div class="gemini-footer" id="gemini-footer">
                        <!-- Dynamic Actions -->
                    </div>
                </div>
            `;
            document.body.appendChild(root);
        }

        this._bindEvents();
        this._injectBubbleStyles();
        this.isInitialized = true;
    }

    /**
     * Inject dynamic styles for chat bubbles (Single-file constraint)
     */
    _injectBubbleStyles() {
        if (document.getElementById('gemini-bubble-styles')) return;
        const style = document.createElement('style');
        style.id = 'gemini-bubble-styles';
        style.textContent = `
            .gemini-chat-list {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding-bottom: 20px;
            }
            .gemini-msg-row {
                display: flex;
                width: 100%;
            }
            .gemini-msg-row.user {
                justify-content: flex-end;
            }
            .gemini-msg-row.gemini {
                justify-content: flex-start;
            }
            .gemini-bubble {
                max-width: 80%;
                padding: 10px 14px;
                border-radius: 16px;
                font-size: 0.95rem;
                line-height: 1.5;
                word-wrap: break-word;
            }
            .gemini-msg-row.user .gemini-bubble {
                background: rgba(255, 255, 255, 0.1);
                border-top-right-radius: 4px;
                color: var(--gemini-text-primary);
                backdrop-filter: blur(4px);
            }
            .gemini-msg-row.gemini .gemini-bubble {
                background: transparent; /* Clean look */
                border-top-left-radius: 4px;
                color: var(--gemini-text-primary);
                padding-left: 0; /* Align with left edge */
            }
            .gemini-bubble p { margin: 0 0 8px 0; }
            .gemini-bubble p:last-child { margin: 0; }
            
            /* Structured Output Styles */
            .gemini-bubble .gemini-refusal { color: #ff4d4d; font-weight: bold; }
            .gemini-bubble .gemini-warning { 
                background: rgba(255, 165, 0, 0.15); 
                border-left: 3px solid orange; 
                padding: 8px; margin-bottom: 8px; 
                font-size: 0.9em; 
            }
            .gemini-bubble .gemini-confidence {
                font-size: 0.8em; opacity: 0.6; display: block; margin-top: 6px;
                text-align: right;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Show the overlay with configuration.
     * @param {Object} config - { prompt: string, mode: 'small'|'medium'|'full', actions: [] }
     */
    show(config = {}) {
        if (!this.isInitialized) this.init();

        this.state.isOpen = true;
        this.state.config = config;
        this.state.mode = config.mode || 'medium';

        if (window.__DEBUG_GEMINI__ === true) {
            if (this.transactionContext) {
                console.log("[GeminiOverlay] Current transaction context:", this.transactionContext);
            } else {
                console.log("[GeminiOverlay] No transaction context available");
            }
        }

        this._render();

        const root = document.getElementById(this.rootId);
        root.classList.remove('gemini-overlay-hidden');

        // Trigger reflow for animation
        void root.offsetWidth;

        root.classList.add('gemini-overlay-active');
        document.body.style.overflow = 'hidden'; // Lock scroll
    }

    /**
     * Hide/Close the overlay.
     * Triggers CSS exit animations before removing from DOM flow.
     */
    hide() {
        if (!this.state.isOpen) return;
        log('Closing overlay');

        // Security: Abort ongoing requests
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }

        const root = document.getElementById(this.rootId);
        const panel = document.getElementById('gemini-panel');

        // Guard against missing DOM
        if (!root || !panel) {
            this.state.isOpen = false;
            document.body.style.overflow = '';
            // Safe cleanup if root remains
            if (root) {
                root.classList.remove('gemini-overlay-active');
                root.classList.add('gemini-overlay-hidden');
            }
            return;
        }

        // Trigger synced exit
        panel.classList.add('gemini-closing');
        root.classList.remove('gemini-overlay-active');
        root.classList.add('gemini-overlay-hiding');

        // Cleanup after animation
        // SYNC WARNING: Must match CSS transition duration (approx 280ms)
        setTimeout(() => {
            root.classList.remove('gemini-overlay-hiding');
            root.classList.add('gemini-overlay-hidden');
            panel.classList.remove('gemini-closing');
            this.state.isOpen = false;
            document.body.style.overflow = '';
        }, 280);
    }

    /**
     * Reset the overlay state (Context Exit Rule).
     * Clears conversation and aborts requests.
     */
    reset() {
        this.hide();
        // Abort is handled in hide(), but explicit clear here:
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.conversation = [];
        this.state.config = null;
        this.showApiKeyHelper = false;
        this.pendingRetryPrompt = null;
        this._invalidateContext();

        // DOM Cleanup (Optional, but keeps DOM light if needed)
        const body = document.getElementById('gemini-body');
        if (body) body.innerHTML = '';

        log('Overlay reset (State cleared)');
    }

    /**
     * Internal render logic based on config.
     */
    _render() {
        const panel = document.getElementById('gemini-panel');
        const body = document.getElementById('gemini-body');
        const footer = document.getElementById('gemini-footer');

        // Reset classes
        panel.className = 'gemini-panel';
        panel.classList.add(`mode-${this.state.mode}`);

        // Set Content
        // Set Content
        this._renderMessages(body);

        // Set Footer Actions
        footer.innerHTML = '';
        // [Polish] visual breathing room
        footer.style.paddingTop = '16px';

        // [Step 3] Input Field Injection (Minimal)
        const inputWrapper = document.createElement('div');
        // [Polish] Add margin-right for button separation
        inputWrapper.style.cssText = 'flex: 1; display: flex; align-items: center; margin-right: 10px;';
        inputWrapper.innerHTML = `
            <textarea id="gemini-input" 
                placeholder="Ask Gemini" 
                style="width: 100%; height: 48px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.05); color: var(--gemini-text-primary); padding: 10px 14px; resize: none; font-family: inherit; font-size: 0.95rem; outline: none; transition: background 0.2s; display: block;"></textarea>
        `;
        footer.appendChild(inputWrapper);

        // [Polish] Mic Button (Placeholder)
        const micBtn = document.createElement('button');
        micBtn.className = 'gemini-btn secondary mic-btn';
        micBtn.ariaLabel = 'Voice input';
        micBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" y1="19" x2="12" y2="23"/>
                <line x1="8" y1="23" x2="16" y2="23"/>
            </svg>
        `;
        footer.appendChild(micBtn);

        if (this.state.config.actions) {
            this.state.config.actions.forEach(action => {
                const btn = document.createElement('button');
                btn.className = `gemini-btn ${action.type || 'secondary'}`;

                // [Polish] Icon Logic
                if (action.type === 'primary') {
                    // Send Icon
                    btn.ariaLabel = 'Send message';
                    btn.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="22" y1="2" x2="11" y2="13"/>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                        </svg>
                    `;
                } else {
                    // Stop/General Icon
                    btn.ariaLabel = 'Stop generation';
                    btn.innerHTML = `
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                            <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                    `;
                }

                // [Step 4] Intercept Send Button
                if (action.type === 'primary') {
                    btn.onclick = () => {
                        const input = document.getElementById('gemini-input');
                        if (!input) return;

                        const text = input.value.trim();
                        if (!text) return;

                        // 1. Update State
                        this.conversation.push({ role: 'user', content: text });

                        // 2. Clear Input
                        input.value = '';

                        // 3. Re-render
                        const body = document.getElementById('gemini-body');
                        this._renderMessages(body);

                        // 4. Call Gemini API
                        this._callGeminiAPI(text);

                        // 5. Call original handler if exists (rare)
                        if (action.onClick) action.onClick();
                    };
                } else {
                    // Standard Button
                    btn.onclick = () => {
                        if (action.onClick) action.onClick();
                        if (action.closeOnTrigger) this.hide();
                    };
                }

                footer.appendChild(btn);
            });
        }
    }

    /**
     * Safe Gemini API wrapper.
     * Uses non-streaming 'generateContent' to avoid parsing ambiguity safely.
     * Enforces one active request at a time via AbortController.
     */
    async _callGeminiAPI(prompt) {
        const apiKey = this.state.config?.apiKey || window.GEMINI_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem("GEMINI_API_KEY") : null);

        // 0. Manage UI State (Lock)
        const input = document.getElementById('gemini-input');
        const sendBtn = document.querySelector('#gemini-footer .gemini-btn.primary');

        if (input) input.disabled = true;
        if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.style.opacity = '0.5';
            sendBtn.style.cursor = 'not-allowed';
        }

        if (typeof window.__getSendTransactionContext__ === 'function') {
            this.transactionContext = window.__getSendTransactionContext__();
        }

        // [SAFETY LAYER] Use LLMRequestBuilder
        // Pass context and user prompt to builder
        const requestPayload = LLMRequestBuilder.buildRequest({
            userText: prompt,
            context: this.transactionContext || {},
            history: this.conversation // Optional: pass history if strictly needed for multi-turn safety
        });

        const finalPromptText = requestPayload.text;

        if (window.__DEBUG_GEMINI__ === true) {
            console.log("[GeminiOverlay] transactionContext snapshot:", this.transactionContext);
            console.log("[GeminiOverlay] userPrompt:", prompt);
            console.log("[GeminiOverlay] Encapsulated Prompt:", finalPromptText);
        }

        if (window.__MOCK_GEMINI__ === true) {
            // Mock Response Object
            const msgIndex = this.conversation.push({
                role: 'model',
                content: { type: 'answer', title: 'Mock', content: "✅ MOCK MODE: Received.", confidence: 'high' }
            }) - 1;

            this._renderMessages(document.getElementById('gemini-body'));
            await new Promise(r => setTimeout(r, 800));
            this._unlockUI(input, sendBtn);
            return;
        }

        // 1. Validate Key
        if (!apiKey) {
            this.conversation.push({
                role: 'model',
                content: "Error: Please provide an API key (config.apiKey or window.GEMINI_API_KEY)."
            });
            this.showApiKeyHelper = true;
            this.pendingRetryPrompt = prompt;
            this._renderMessages(document.getElementById('gemini-body'));
            this._unlockUI(input, sendBtn);
            return;
        }

        // 2. Abort Previous
        if (this.abortController) {
            this.abortController.abort();
        }
        this.abortController = new AbortController();

        // 3. Placeholder ("Thinking...")
        const msgIndex = this.conversation.push({ role: 'model', content: "..." }) - 1;
        this._renderMessages(document.getElementById('gemini-body'));

        try {
            // [Multi-Model Router] Select and retry with fallback
            let response = null;
            let attempt = 0;
            const maxAttempts = 5; // Gemini 3 Flash → 3 Pro → 2.5 Flash → 1.5 Pro → 1.5 Flash

            while (attempt < maxAttempts && !response?.ok) {
                const activeModel = modelRouter.selectModel();

                if (window.__DEBUG_GEMINI__) {
                    console.log(`[AI] using model: ${activeModel}`);
                }

                try {
                    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${apiKey}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: finalPromptText }] }]
                        }),
                        signal: this.abortController.signal
                    });

                    if (response.ok) break; // Success

                    const status = response.status;

                    // Safe retry logic: Only retry on server/model errors
                    // 404: Model not found (try next model)
                    // 500/503: Server error (might work with different model endpoint)
                    // 400/401/403: User/auth errors (do NOT retry, fail immediately)
                    if (status === 404 || status === 500 || status === 503) {
                        if (window.__DEBUG_GEMINI__) {
                            console.warn(`[GeminiRouter] Model failed: ${activeModel} status=${status}`);
                        }
                        modelRouter.reportFailure(activeModel);
                        attempt++;
                        continue; // Try next model
                    }

                    // User/auth error - fail immediately without retry
                    break;

                } catch (netErr) {
                    if (netErr.name === 'AbortError') throw netErr;

                    // Network error - might be model-specific endpoint issue
                    if (window.__DEBUG_GEMINI__) {
                        console.warn(`[GeminiRouter] Network error on ${activeModel}:`, netErr.message);
                    }
                    modelRouter.reportFailure(activeModel);
                    attempt++;
                }
            }

            // Final error handling
            if (!response || !response.ok) {
                const status = response?.status;
                const isKeyError = this._isKeyRecoverableError(new Error(`API Error: ${status}`), status);

                if (isKeyError) {
                    this.showApiKeyHelper = true;
                    this.pendingRetryPrompt = prompt;
                }

                // Debug: Log full error details
                if (window.__DEBUG_GEMINI__) {
                    console.error(`[GeminiOverlay] API Error: ${status || 'Network failure'}`);
                }

                // User-friendly message for key errors
                const userMessage = isKeyError
                    ? 'Invalid or missing Gemini API key. Please check your key.'
                    : `API Error: ${status || 'Network failure'}`;
                throw new Error(userMessage);
            }

            const data = await response.json();
            const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;

            // 5. Update Content (Parsed & Guardrailed)
            const parsedData = LLMRequestBuilder.parseResponse(textResponse);
            const guardrailedData = normalizeAndGuardrailModelResponse(parsedData, {
                userText: prompt,
                context: this.transactionContext || {}
            });

            if (guardrailedData) {
                this.conversation[msgIndex].content = guardrailedData; // Store safe object
                this.showApiKeyHelper = false;
                this.pendingRetryPrompt = null;
            } else {
                this.conversation[msgIndex].content = "(No text returned)";
            }

        } catch (err) {
            if (err.name === 'AbortError') return; // Silent abort

            const statusMatch = err.message.match(/API Error: (\d+)/);
            const status = statusMatch ? parseInt(statusMatch[1]) : null;
            const isKeyError = this._isKeyRecoverableError(err, status);

            if (isKeyError) {
                this.showApiKeyHelper = true;
                this.pendingRetryPrompt = prompt;
            }

            // Debug: Log full error
            if (window.__DEBUG_GEMINI__) {
                console.error('[GeminiOverlay] Request failed:', err);
            }

            // User-friendly error message
            let userMessage = err.message;
            if (isKeyError && !err.message.includes('Invalid or missing')) {
                userMessage = 'Invalid or missing Gemini API key. Please check your key.';
            }

            this.conversation[msgIndex].content = `Error: ${userMessage}`;

        } finally {
            this.abortController = null;
            // Final Re-render
            this._renderMessages(document.getElementById('gemini-body'));
            this._unlockUI(input, sendBtn);
        }
    }

    /**
     * Helper to unlock UI after request
     */
    _unlockUI(input, btn) {
        if (input) {
            input.disabled = false;
            if (this.state.isOpen) input.focus();
        }
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
    }

    /**
     * Check if an error is key-recoverable
     * @param {Error} err - The error object
     * @param {number} status - HTTP status code (if available)
     * @returns {boolean}
     */
    _isKeyRecoverableError(err, status) {
        if (!err) return false;

        // Check HTTP status codes
        if (status === 400 || status === 401 || status === 403) {
            return true;
        }

        // Check error message patterns
        const message = err.message || '';
        if (message.includes('API Error: 400') ||
            message.includes('API Error: 401') ||
            message.includes('API Error: 403') ||
            message.includes('API key') ||
            message.includes('authentication') ||
            message.includes('invalid key')) {
            return true;
        }

        return false;
    }

    /**
     * Render API key helper below error messages
     * @param {HTMLElement} container - The container to append helper to
     */
    _renderApiKeyHelper(container) {
        // Remove existing helper if present
        const existingHelper = document.getElementById('gemini-api-key-helper');
        if (existingHelper) {
            existingHelper.remove();
        }

        const helper = document.createElement('div');
        helper.id = 'gemini-api-key-helper';
        helper.className = 'gemini-api-key-helper';
        helper.style.cssText = `
            margin-top: 16px;
            padding: 16px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.2);
        `;

        const title = document.createElement('div');
        title.style.cssText = 'font-weight: 600; margin-bottom: 8px; color: var(--gemini-text-primary);';
        title.textContent = 'Use your Gemini API key';

        const description = document.createElement('div');
        description.style.cssText = 'font-size: 0.9rem; margin-bottom: 12px; color: var(--gemini-text-secondary); line-height: 1.4;';
        description.textContent = 'Paste your Gemini API key below to continue. You can change or remove it anytime.';

        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = 'margin-bottom: 12px;';

        const input = document.createElement('input');
        input.type = 'text';
        input.id = 'gemini-api-key-input';
        input.placeholder = 'Paste API key here';
        input.style.cssText = `
            width: 100%;
            padding: 10px 14px;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(0, 0, 0, 0.05);
            color: var(--gemini-text-primary);
            font-family: inherit;
            font-size: 0.95rem;
            outline: none;
            box-sizing: border-box;
        `;

        // Pre-fill if key exists
        const existingKey = this.state.config?.apiKey || window.GEMINI_API_KEY || (typeof localStorage !== 'undefined' ? localStorage.getItem("GEMINI_API_KEY") : null);
        if (existingKey) {
            input.value = existingKey;
        }

        inputWrapper.appendChild(input);

        const buttonWrapper = document.createElement('div');
        buttonWrapper.style.cssText = 'display: flex; gap: 8px;';

        const useBtn = document.createElement('button');
        useBtn.textContent = existingKey ? 'Change API Key' : 'Use API Key';
        useBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 8px;
            border: none;
            background: linear-gradient(to bottom, rgba(0, 200, 83, 0.85), rgba(0, 200, 83, 0.75));
            color: white;
            font-weight: 600;
            cursor: pointer;
            font-family: inherit;
            font-size: 0.95rem;
            transition: opacity 0.2s;
        `;

        useBtn.onmouseover = () => useBtn.style.opacity = '0.9';
        useBtn.onmouseout = () => useBtn.style.opacity = '1';

        useBtn.onclick = async () => {
            const keyValue = input.value.trim();
            if (!keyValue) return;

            // Store key
            if (this.state.config) {
                this.state.config.apiKey = keyValue;
            }
            window.GEMINI_API_KEY = keyValue;
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem("GEMINI_API_KEY", keyValue);
            }

            // Disable button during retry
            useBtn.disabled = true;
            useBtn.style.opacity = '0.6';
            useBtn.textContent = 'Retrying...';

            // Retry the request if we have a pending prompt
            if (this.pendingRetryPrompt) {
                const promptToRetry = this.pendingRetryPrompt;
                const previousErrorIndex = this.conversation.length - 1;

                // Remove the previous error message
                if (previousErrorIndex >= 0 && this.conversation[previousErrorIndex].content.startsWith('Error:')) {
                    this.conversation.splice(previousErrorIndex, 1);
                }

                // Call API (this will handle success/failure)
                await this._callGeminiAPI(promptToRetry);

                // Check if retry succeeded
                const lastMessage = this.conversation[this.conversation.length - 1];
                if (lastMessage && lastMessage.content.startsWith('Error:')) {
                    // Retry failed - show friendly message and keep helper visible
                    lastMessage.content = "That key doesn't seem to work. You can try again.";
                    this.showApiKeyHelper = true;
                    this.pendingRetryPrompt = promptToRetry; // Keep prompt for another retry
                    this._renderMessages(document.getElementById('gemini-body'));
                } else {
                    // Success - hide helper
                    this.showApiKeyHelper = false;
                    this.pendingRetryPrompt = null;
                    // Helper will be removed by _renderMessages since showApiKeyHelper is false
                }
            }

            // Re-enable button
            useBtn.disabled = false;
            useBtn.style.opacity = '1';
            useBtn.textContent = existingKey ? 'Change API Key' : 'Use API Key';
        };

        buttonWrapper.appendChild(useBtn);

        helper.appendChild(title);
        helper.appendChild(description);
        helper.appendChild(inputWrapper);
        helper.appendChild(buttonWrapper);

        container.appendChild(helper);

        // Focus input
        requestAnimationFrame(() => {
            input.focus();
        });
    }

    /**
     * Render conversation messages.
     * @param {HTMLElement} container 
     */
    _renderMessages(container) {
        container.innerHTML = '';
        const list = document.createElement('div');
        list.className = 'gemini-chat-list';

        // If empty, show initial prompt
        if (this.conversation.length === 0) {
            const promptText = this.state.config.prompt || 'How can I help you today?';
            const welcomeMsg = document.createElement('div');
            welcomeMsg.className = 'gemini-bubble';
            welcomeMsg.style.textAlign = 'center';
            welcomeMsg.style.width = '100%';
            welcomeMsg.style.opacity = '0.7';
            welcomeMsg.innerHTML = `<p>${promptText}</p>`;
            list.appendChild(welcomeMsg);
        } else {
            this.conversation.forEach(msg => {
                const row = document.createElement('div');
                row.className = `gemini-msg-row ${msg.role === 'user' ? 'user' : 'gemini'}`;

                const bubble = document.createElement('div');
                bubble.className = 'gemini-bubble';

                // Structured Content Rendering
                if (msg.role === 'model' && typeof msg.content === 'object') {
                    // It's a parsed parsedResponse object
                    const data = msg.content;

                    if (data.type === 'refusal') {
                        bubble.innerHTML = `<div class="gemini-refusal"><i class="fa-solid fa-shield-halved"></i> Policy Limit</div><p>${data.content}</p>`;
                    } else {
                        let html = '';
                        // Warnings
                        if (data.warnings && data.warnings.length > 0) {
                            data.warnings.forEach(w => {
                                html += `<div class="gemini-warning">⚠️ ${w}</div>`;
                            });
                        }
                        // Main Content
                        // Basic markdown-to-html shim for bold/code (simple safety fallback)
                        let text = data.content || '';
                        text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>'); // Bold
                        text = text.replace(/`(.*?)`/g, '<code>$1</code>');  // Inline code
                        html += `<p>${text}</p>`;

                        // Confidence/Sources
                        if (data.confidence && data.confidence !== 'high') {
                            html += `<span class="gemini-confidence">Confidence: ${data.confidence}</span>`;
                        }

                        bubble.innerHTML = html;
                    }
                } else {
                    // Legacy / User Text
                    bubble.innerText = msg.content;
                }

                row.appendChild(bubble);
                list.appendChild(row);
            });
        }

        container.appendChild(list);

        // Show API key helper if needed (after error messages)
        if (this.showApiKeyHelper) {
            const lastMessage = this.conversation[this.conversation.length - 1];
            // Check structured or string error
            const isError = typeof lastMessage?.content === 'string' && lastMessage.content.startsWith('Error:');

            if (isError) {
                this._renderApiKeyHelper(list);
            }
        }

        // Auto-scroll to bottom
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    }

    /**
     * Bind DOM events.
     */
    _bindEvents() {
        const backdrop = document.getElementById('gemini-backdrop');
        const closeBtn = document.getElementById('gemini-close-btn');
        const expandBtn = document.getElementById('gemini-expand-btn');

        // Backdrop click does NOT close (locked glass rule)
        // backdrop.addEventListener('click', () => this.hide());

        closeBtn.addEventListener('click', () => this.hide());

        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                const panel = document.getElementById('gemini-panel');
                panel.classList.toggle('mode-full');
            });
        }

        document.addEventListener('keydown', this._handleKeydown);

        // [Step 9] Safe Coordination (Event-Based)
        // RULE 2: Soft hide on overlay open (Asset/Chain overlays)
        document.addEventListener('overlay:opened', () => this.hide());

        // RULE 1: Hard reset on Send exit
        document.addEventListener('send:exit', () => this.reset());

        // RULE 3: Context invalidation on Send data changes
        document.addEventListener('send:context-changed', (e) => {
            if (e.detail) {
                this._updateContext(e.detail);
            } else {
                this._invalidateContext();
            }
        });
    }

    _handleKeydown(e) {
        if (this.state.isOpen && e.key === 'Escape') {
            this.hide();
        }
    }

    /**
     * Update transaction context from Send module.
     * READ-ONLY: Stores snapshot as opaque data, no interpretation.
     * Phase 1: Storage only, no behavior changes.
     */
    _updateContext(contextSnapshot) {
        if (!contextSnapshot) {
            this._invalidateContext();
            return;
        }

        // Store as-is (opaque data)
        this.transactionContext = contextSnapshot;

        log('Transaction context received (opaque)', this.transactionContext);
    }

    /**
     * Invalidate transaction context (clear snapshot).
     */
    _invalidateContext() {
        this.transactionContext = {
            // Clear all fields to null (opaque structure)
            ...Object.keys(this.transactionContext).reduce((acc, key) => {
                acc[key] = null;
                return acc;
            }, {})
        };
        log('Transaction context invalidated');
    }
}

// Export singleton
const geminiOverlay = new GeminiOverlay();
export default geminiOverlay;

// Expose to window for UMD/No-Build usage
window.GeminiOverlay = geminiOverlay;
