# Web3 UPI – Making Crypto Transfers Feel as Simple as UPI
### Web3 Payments, Without the Web3 Complexity

A progressive web app that brings the familiar ease of UPI into Web3.

🌍 **Live Demo:** https://web3-upi-imp.netlify.app/

Web3 UPI lets users send crypto across multiple blockchains using a single, simple flow — no manual chain selection, no asset confusion, and no complex wallet knowledge required.

## 🎯 Project Overview

Web3 UPI is designed to make crypto transfers feel as natural and familiar as UPI payments. The app supports:
- Multi-chain transaction sending (EVM chains, Bitcoin, Solana)
- Real-time asset and chain detection via address parsing
- QR code scanning for wallet addresses
- UPI-style amount input with fiat conversion
- Built-in transaction assistance with a safety-first design

## ✨ Features

### Core Transaction Features
- **Multi-Chain Support**: Ethereum Mainnet, Bitcoin, Solana, Polygon, Base, Arbitrum, Optimism, and more
- **Asset Detection**: Automatically detects chain and asset type from recipient addresses
- **Fiat/Asset Mode**: Toggle between entering amounts in USD or native asset
- **QR Scanning**: Scan wallet addresses directly from QR codes
- **Transfer Modes**: Bitcoin supports Taproot, SegWit, and Legacy address types
- **Gas/Fee Preview**: Real-time fee estimation before sending

### Smart Transaction Assistance
- **Contextual Help**: AI understands your current transaction context (chain, asset, amounts)
- **Safety Guidance**: Provides warnings about high fees, unverified addresses, and risky chains
- **Adaptive Model Routing**: Automatically selects the most suitable model based on context and availability
- **Streaming Responses**: Real-time AI responses with stop capability
- **Conversation Scoping**: Chat history persists within a single Send session

## 🛡️ AI Safety Architecture

The app implements a defense-in-depth approach to AI safety:

```
User Input → PromptSanitizer → System Prompt → Model Router → Response Guardrails → UI
```

### Safety Components

Safety in Web3 UPI is designed to be **invisible, predictable, and non-intrusive** — protecting users without adding complexity.

- **Input Protection**  
  All user inputs are validated and constrained to prevent prompt injection, misuse, or unexpected behavior.

- **Context-Aware Requests**  
  Assistance is generated using only the minimum transaction context required (chain, asset, fees), ensuring relevance without overreach.

- **Strict Model Routing**  
  Automatically selects the best supported model for the current context, with controlled fallback behavior and room to expand as new models are added in future updates.

- **Response Guardrails**  
  The system blocks requests for sensitive data (private keys, seed phrases), detects scam or phishing patterns, and ensures all responses remain assist-only — never executing transactions.

## 🚀 How to Run Locally

### Prerequisites
- Node.js installed (for `npx`)
- A **Gemini API key** (get one at [Google AI Studio](https://aistudio.google.com/app/apikey))
- Modern browser (Chrome, Edge, Firefox, Safari)

### Steps
1. **Clone the repository**:
   ```bash
   git clone <repo-url>
   cd web3-UPI
   ```

2. **Set your API key**:
   - Open the app in your browser (see step 3)
   - Click "Settings" → "AI Settings"
   - Paste your Gemini API key
   - Key is stored locally in `localStorage` (never sent to any server except Gemini API)

3. **Start a local server**:
   ```bash
   npx serve
   ```
   - App will open at `http://localhost:3000` (or similar)

4. **Test the app**:
   - Click "Send" from the home screen
   - Enter a recipient address or scan QR code
   - Try the Gemini assistant by clicking the AI button

## 🐛 Debug Mode

Enable verbose logging for development and troubleshooting:

### Method 1: URL Parameter
```
http://localhost:3000?debug=1
```

### Method 2: LocalStorage
Open browser console and run:
```javascript
localStorage.AI_DEBUG = "1";
```
Then refresh the page.

**Debug Logs Include:**
- Selected model for each AI request
- Transaction context captured from UI
- Prompt sanitization flags
- Response guardrail violations
- Model fallback triggers

## 🌐 Deployment Options

### Recommended: Netlify (Zero Config)
1. Push code to GitHub
2. Connect repo to [Netlify](https://netlify.com)
3. Deploy with default settings (no build step needed)
4. Users must add their own API keys via Settings

### Alternative: Vercel, GitHub Pages, Cloudflare Pages
- All static hosting platforms work (this is a client-side-only app)
- No server-side code or build process required

## 🔐 Security Notes

⚠️ **NEVER commit API keys to the repository!**

- API keys are stored in browser `localStorage` only
- Each user must bring their own Gemini API key
- Keys are never logged, transmitted to third parties, or stored on any server
- Use environment variables if deploying with pre-configured keys (not recommended for public demos)

### `.gitignore` Protects:
- `node_modules/`
- `.env` and `.env.*`
- Build outputs (`dist/`, `build/`)
- Log files

## 📜 Project Structure

```
web3-UPI/
├── index.html              # Main entry point
├── css/                    # Styling (cards, overlays, themes)
├── src/
│   ├── modules/            # UI components (send.js, settings.js, etc.)
│   ├── utils/              # AI safety utilities, icon resolvers
│   └── config/             # LLM safety config, model defaults
├── assets/                 # Chain/asset logos (PNG)
├── governance/             # System contracts and lifecycle docs
├── sections/               # Screen templates (home, send, receive)
└── vendor/                 # Third-party libraries (QR scanner, etc.)
```

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 🛡️ Security

See [SECURITY.md](SECURITY.md) for reporting vulnerabilities.

## 📄 License

---

**Built with ❤️ for the future of decentralized finance**

*Bringing the UPI experience people trust into Web3 —  
so sending crypto feels simple, familiar, and effortless.*
