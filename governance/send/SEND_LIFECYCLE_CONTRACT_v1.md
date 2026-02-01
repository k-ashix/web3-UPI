# Send Lifecycle Contract

**Version:** v1.0  
**Created At:** 29 January 2026, 01:32:28 PM IST (+05:30)  
**Status:** FROZEN  
**Applies To:** Send Overlay Lifecycle

## A. Entry Paths
The Send Lifecycle MUST only be entered via these paths:
- **Manual Send button**: User clicks the "Send" button in the main UI.
- **QR Scan redirect**: User scans a QR code which initiates the send flow.
- **Re-open existing Send overlay**: User toggles the Send overlay back open (e.g., from minimized or background state).

## B. Initialization Rules
Rules governing the initial setup of the Send UI:
- **`initSendUI()` runs ONCE per page load**: This function establishes the listeners and DOM elements. It must not run again.
- **Never called on overlay re-open**: Re-opening the overlay must not trigger a full re-initialization.
- **Never called by `InteractionUtils`**: External utilities must not trigger the initialization logic.

## C. Re-entry Rules
Rules for entering the active Send state:
- **`enterSendLifecycle()` is the ONLY allowed re-entry hook**: All paths to show the Send UI must route through this function.
- **It may be called multiple times**: The lifecycle must be robust to repeated calls (idempotency where appropriate).
- **It must NEVER call `resetSendState()`**: State persistence is required across re-entries unless explicitly cleared by specific exit actions.
- **It must NEVER call `initSendUI()`**: See Initialization Rules.

## D. QR Hydration Rules
Specific logic when entering via QR Code:
- **`sessionStorage.scannedAddress` is consumed ONCE**: The data is read exactly one time to populate the form.
- **`enforceAddressState()` may only run when `scannedAddress` exists**: This function is strictly for QR code data handling.
- **After consumption, `scannedAddress` MUST be removed**: This prevents replay attacks or accidental re-population on page refresh or re-entry.

## E. Manual Entry Rules
Logic for manual interaction:
- **Manual address must never be cleared by overlays**: If a user typed an address, closing/re-opening the overlay specifically should not wipe it.
- **Manual re-entry re-derives state via `updateAssetLogo(address)`**: Visual feedback (logos, tickers) must be refreshed based on the current address input.

## F. Exit Rules
Clean-up and exit behavior:
- **Back button clears ephemeral UI state ONLY**: Temporary visual states (e.g., error messages, loading spinners) are reset, but core form data might persist depending on context.
- **Exit must NOT re-hydrate**: Closing the Send flow does not trigger data fetching or population.
- **Exit must NOT derive theme**: UI theming/styling calculations should stop or not run on exit.

## FORBIDDEN OPERATIONS
The following actions are strictly prohibited within the lifecycle:
- **Calling `enforceAddressState()` unconditionally**: It must be guarded by the presence of new scan data.
- **Using `MutationObserver` for Send visibility**: Visibility state must be managed explicitly via state/classes, not inferred by DOM observers.
- **Resetting Send state on overlay open**: Opening the overlay should show the previous state or a clean state depending on entry context, but not indiscriminately hard-reset everything.
- **Re-running `initSendUI()`**: Multiple initializations will cause listener duplication and memory leaks.
