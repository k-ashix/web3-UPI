# Security Policy

## 🔐 Protecting API Keys

**NEVER commit API keys to this repository!**

### Best Practices
1. **User-Provided Keys**: This app is designed for users to bring their own Gemini API keys
2. **Local Storage Only**: API keys are stored in browser `localStorage` and never transmitted to third-party servers
3. **Environment Variables**: If deploying with pre-configured keys, use environment variables and add them to `.gitignore`
4. **Rotation**: If a key is accidentally committed, revoke it immediately via [Google AI Studio](https://aistudio.google.com/app/apikey)

### What to Avoid
- ❌ Hardcoding API keys in JavaScript files
- ❌ Committing `.env` files
- ❌ Sharing keys in screenshots, demos, or documentation
- ❌ Using production keys for development/testing

## 🛡️ AI Safety Guardrails

This app implements multiple layers of protection against malicious AI interactions:
- **Prompt Sanitization**: Blocks injection attempts before reaching the model
- **Response Guardrails**: Prevents AI from requesting sensitive data (private keys, seed phrases)
- **Scam Detection**: Blocks responses containing phishing patterns or fake support requests

## 🐛 Reporting Vulnerabilities

If you discover a security vulnerability, please report it via:
- **GitHub Issues**: [Create a new issue](../../issues) with the label `security`
- **Private Disclosure**: For critical vulnerabilities, contact the repository owner directly

### What to Include
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if applicable)

## 📜 Responsible Disclosure

We follow responsible disclosure practices:
1. Report received and acknowledged within 48 hours
2. Fix developed and tested
3. Patch released
4. Public disclosure after users have had time to update

Thank you for helping keep Web3 UPI secure! 🙏
