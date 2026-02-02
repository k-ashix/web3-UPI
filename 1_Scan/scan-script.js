// QR Scan Script
// RESPONSIBILITIES:
// - Owns: Camera initialization, fallback to file upload, QR parsing.
// - Must NOT do: Transaction flow logic (redirects only), Direct wallet interaction.
// - Safe to modify: UI messages, camera constraints, flashlight logic.

(function () {
    'use strict';

    // DOM Elements
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('scanCanvas');
    const ctx = canvas.getContext('2d');
    const messageDisplay = document.getElementById('messageDisplay');
    const backBtn = document.getElementById('scanBackBtn');
    const galleryBtn = document.getElementById('galleryBtn');
    const flashBtn = document.getElementById('flashBtn');
    const fileInput = document.getElementById('fileInput');

    // State
    let stream = null;
    let scanning = false;
    let flashOn = false;
    let cameraFailed = false;

    // Initialize
    function init() {
        initCamera();
        setupEventListeners();
        setupVisibilityHandlers();
    }

    // Camera Initialization
    async function initCamera() {
        try {
            // Updated: Try ideal environment facing mode first
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: "environment" } }
                });
            } catch (e) {
                // Fallback: Try any available video source
                console.warn('[Scan] Environment camera failed, trying fallback:', e);
                stream = await navigator.mediaDevices.getUserMedia({ video: true });
            }

            video.srcObject = stream;
            cameraFailed = false; // Reset failure flag

            // Updated: Explicitly play video to ensure stream starts
            await video.play();

            // Setup canvas and start scanning only after play succeeds
            scanning = true;
            scanQRCode();

        } catch (err) {
            console.error('[Scan] Camera error:', err);
            cameraFailed = true;

            if (err.name === 'NotFoundError') {
                showMessage('No camera found. Use Gallery upload.', 'error');
            } else if (err.name === 'NotAllowedError') {
                showMessage('Camera permission denied. Enable it in browser settings.', 'error');
            } else {
                showMessage('Camera access denied. Please enable camera permissions.', 'error');
            }
        }
    }

    // Event Listeners
    function setupEventListeners() {
        backBtn.addEventListener('click', closeScan);
        galleryBtn.addEventListener('click', () => fileInput.click());
        flashBtn.addEventListener('click', toggleFlash);
        fileInput.addEventListener('change', handleFileUpload);
    }

    // Visibility Handlers for Camera Retry
    function setupVisibilityHandlers() {
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('focus', handleWindowFocus);
    }

    function handleVisibilityChange() {
        if (!document.hidden && cameraFailed && !stream) {
            retryCamera();
        }
    }

    function handleWindowFocus() {
        if (cameraFailed && !stream) {
            retryCamera();
        }
    }

    async function retryCamera() {
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'camera' });
            if (permissionStatus.state === 'granted') {
                await initCamera();
            }
        } catch (err) {
            // Permissions API not supported, try direct init
            await initCamera();
        }
    }

    // Close Scan Overlay
    function closeScan() {
        scanning = false;
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        const overlay = document.getElementById('scan-overlay-injected');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    // QR Scanning Loop
    function scanQRCode() {
        if (!scanning) return;

        if (video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            if (typeof jsQR !== 'undefined') {
                const code = jsQR(imageData.data, imageData.width, imageData.height);
                if (code) {
                    validateAndRedirect(code.data);
                    return;
                }
            }
        }

        requestAnimationFrame(scanQRCode);
    }

    // Helper: Normalize QR Data
    function normalizeQRData(data) {
        if (!data) return '';
        let clean = data.trim();

        // Remove common URI schemes
        const schemes = ['ethereum:', 'bitcoin:', 'solana:'];
        for (const scheme of schemes) {
            if (clean.toLowerCase().startsWith(scheme)) {
                clean = clean.substring(scheme.length);
            }
        }

        // Remove parameters (e.g. ?amount=...)
        if (clean.includes('?')) {
            clean = clean.split('?')[0];
        }

        // Remove suffixes (e.g. @1 for chain ID in EIP-681)
        if (clean.includes('@')) {
            clean = clean.split('@')[0];
        }

        return clean;
    }

    // Helper: Detect Chain
    function detectChain(address) {
        // Ethereum: 0x + 40 hex chars
        const ethPattern = /^0x[a-fA-F0-9]{40}$/;
        if (ethPattern.test(address)) return 'ETH';

        // Solana: Base58, 32-44 chars
        const solPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
        if (solPattern.test(address)) return 'SOL';

        // Bitcoin: Legacy (1/3) or Segwit (bc1), length check 25-62
        const btcPattern = /^(bc1|[13])[a-zA-HJ-NP-Z0-9]{25,62}$/;
        if (btcPattern.test(address)) return 'BTC';

        return null;
    }

    // Helper: Redirect to Send
    function redirectToSend(address) {
        sessionStorage.setItem('scannedAddress', address);
        closeScan();
        // Invoke Send via Dashboard Wiring
        const sendBtn = document.querySelector('[data-action="send"]');
        if (sendBtn) sendBtn.click();
    }

    // Validate QR Data
    function validateAndRedirect(qrData) {
        if (!qrData || qrData.trim() === '') {
            showMessage("This QR code can't be read. Please try another one.", 'error');
            return;
        }

        const cleanAddress = normalizeQRData(qrData);
        const chain = detectChain(cleanAddress);

        // ETH (Supported)
        if (chain === 'ETH') {
            scanning = false;
            showMessage('Ethereum address detected! Redirecting...', 'success');
            setTimeout(() => {
                redirectToSend(cleanAddress);
            }, 1000);
            return;
        }

        // SOL (Detected, Not Supported)
        if (chain === 'SOL') {
            showMessage('Solana address detected. Sending is not supported yet.', 'info');
            setTimeout(() => {
                scanning = true;
                scanQRCode();
            }, 3000);
            return;
        }

        // BTC (Detected, Not Supported)
        if (chain === 'BTC') {
            showMessage('Bitcoin address detected. Sending is not supported yet.', 'info');
            setTimeout(() => {
                scanning = true;
                scanQRCode();
            }, 3000);
            return;
        }

        // Valid QR but not Web3 Wallet
        showMessage("This QR code does not contain a wallet address.", 'info');
        setTimeout(() => {
            scanning = true;
            scanQRCode();
        }, 3000);
    }

    // Show Message
    function showMessage(text, type = 'info') {
        messageDisplay.textContent = text;
        messageDisplay.className = 'message-display visible ' + type;

        setTimeout(() => {
            messageDisplay.classList.remove('visible');
        }, type === 'success' ? 1500 : 4000);
    }

    // Toggle Flashlight
    async function toggleFlash() {
        if (!stream) return;

        try {
            const track = stream.getVideoTracks()[0];
            let torchSupported = false;

            // 1. Check standard capabilities
            if (track.getCapabilities && track.getCapabilities().torch) {
                torchSupported = true;
            }

            // 2. Fallback: ImageCapture (Android Chrome)
            if (!torchSupported && typeof window.ImageCapture === 'function') {
                try {
                    const ic = new window.ImageCapture(track);
                    const pc = await ic.getPhotoCapabilities();
                    if (pc && pc.torch) {
                        torchSupported = true;
                    }
                } catch (e) {
                    console.warn('[Scan] ImageCapture check failed:', e);
                }
            }

            if (torchSupported) {
                flashOn = !flashOn;
                await track.applyConstraints({
                    advanced: [{ torch: flashOn }]
                });
                flashBtn.classList.toggle('active', flashOn);
            } else {
                showMessage('Flash not supported on this device/browser', 'info');
            }
        } catch (err) {
            console.error('[Scan] Flash error:', err);
            showMessage('Unable to toggle flashlight', 'error');
        }
    }

    // Handle Gallery Upload
    function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        scanning = false;

        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);

                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

                if (typeof jsQR !== 'undefined') {
                    const code = jsQR(imageData.data, imageData.width, imageData.height);
                    if (code) {
                        validateAndRedirect(code.data);
                    } else {
                        showMessage("No QR code found in image. Please try another one.", 'error');
                        setTimeout(() => {
                            scanning = true;
                            scanQRCode();
                        }, 2000);
                    }
                } else {
                    showMessage('QR scanner not loaded', 'error');
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // Load jsQR library
    function loadJsQR() {
        if (typeof jsQR !== 'undefined') {
            init();
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
        script.onload = () => {
            console.log('[Scan] jsQR loaded');
            init();
        };
        script.onerror = () => {
            showMessage('Failed to load QR scanner. Please refresh.', 'error');
        };
        document.head.appendChild(script);
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadJsQR);
    } else {
        loadJsQR();
    }
})();
