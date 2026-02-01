# Send Theme Contract

**Version:** v1.0  
**Created At:** 29 January 2026, 01:33:58 PM IST (+05:30)  
**Status:** FROZEN  

## THEME AXIOM
- **Theme is a PURE FUNCTION of asset**: The visual theme is completely determined by the detected asset type derived from the input address. It has no external dependencies or internal state history.
- **Theme is NEVER stored**: The theme configuration is not persisted in `localStorage`, `sessionStorage`, or any long-lived state management store. It is ephemeral and calculated on-the-fly.
- **Theme is NEVER reset manually**: There is no "reset to default" function that should be called arbitrarily. The default theme emerges naturally when no specific asset is detected.

## Valid Theme Flow
The **ONLY** valid flow for applying a theme is:

1.  **Address Input**: User types or scans an address.
2.  `updateAssetLogo(address)`: This function is called with the address.
3.  **Asset Detection**: Logic within `updateAssetLogo` determines the asset type (e.g., BTC, ETH, LTC, DOGE) based on the address format.
4.  `updateTheme(asset)`: This function is invoked with the detected asset (or null/undefined).
5.  **Single Theme Class Applied**: `updateTheme` applies the specific CSS class for that asset to the Send Card.

## Explicit Rules
- **`updateTheme()` is idempotent**: Calling it multiple times with the same asset produces the exact same result (the correct class is present, others are absent).
- **`updateTheme()` removes all known themes, then adds one**: It acts as a "switch" by first cleaning the slate of any potential asset theme classes before applying the new one.
- **No other function may touch theme classes**: `updateTheme` has exclusive ownership of the theme-related CSS classes on the Send Card. No other part of the codebase is permitted to add or remove these classes.

## Forbidden Behaviors
The following actions are explicitly forbidden:
- **Theme reset on Back**: Navigating back within the flow or out of the flow must not forcibly strip the theme. Default state handles itself if the address is cleared; otherwise, the theme represents the current address state.
- **Theme reset on overlay close**: Hiding the active overlay does not require wiping the theme classes.
- **Theme reset on init**: Initialization logic (`initSendUI`) must not touch the theme.
- **Theme reset via CSS or MutationObserver**: No "reactive" cleanup based on DOM observation or pure CSS hacks.
- **Theme depending on `sessionStorage`**: The theme derivation must be direct from the address input, not from a stored value in the session.

## Future Safety
- **Adding new chains must only extend `updateTheme()`**: To support a new cryptocurrency, only the mapping in `updateTheme` (and the corresponding asset detection logic) should be updated.
- **No lifecycle logic may be added to theme functions**: `updateTheme` and `updateAssetLogo` must remain pure styling/feedback functions. They must never trigger network requests, navigation, or state resets.
