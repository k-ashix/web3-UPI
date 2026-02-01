# Gemini Overlay Module

A standalone, portable "locked glass" overlay system for prompt-driven interactions.

## Structure
- `gemini-overlay.js`: Core logic, lifecycle, and rendering.
- `gemini-overlay.css`: Scoped visual system (Glassmorphism).
- `checklist.md`: QA and deployment steps.
- `implementation_plan.md`: Architectural reference.

## Usage

### 1. Import
```html
<script src="3_shared_gemini/gemini-overlay.js" type="module"></script>
```

### 2. Trigger
```javascript
// Open standard overlay
GeminiOverlay.show({
    prompt: "Confirm transaction details below.",
    mode: "medium",
    actions: [
        { label: "Cancel", onClick: () => console.log('Cancelled'), closeOnTrigger: true },
        { label: "Confirm", type: "primary", onClick: () => console.log('Confirmed') }
    ]
});
```

### 3. Close
```javascript
GeminiOverlay.hide();
```

## Isolation
The overlay lives in `#gemini-overlay-root` attached to `body`. It injects its own CSS. It is designed to be removable by simply deleting this folder and the import reference.
