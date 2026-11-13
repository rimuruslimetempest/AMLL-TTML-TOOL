# Privacy module

- `constants.ts` contains the policy/terms versions and storage keys. Change a version when a material data flow changes; existing consent then becomes stale and the user is asked again.
- `consent.ts` reads and writes the versioned per-feature consent record and the separate diagnostics opt-in. Non-React startup code uses the same storage helpers.
- `states.ts` exposes the Jotai atoms for consent, consent prompts, policy/terms dialogs, and diagnostics.
- `usePrivacyGate.ts` runs an action only when the feature's consent is current.
- `PrivacyDialogs.tsx` contains the consent gate, policy/terms viewers, and reusable privacy cards/links.
- `PrivacySettingsTab.tsx` provides consent status, withdrawal, diagnostic opt-in, local clearing, and deletion instructions.
- `localData.ts` deletes local storage, the app's IndexedDB databases, and Cache Storage. It does not delete cloud data.
- `diagnostics.ts` initializes Sentry only after opt-in, with PII/request/breadcrumb scrubbing.

Network gates are deliberate:

- Firebase is not initialized until cloud consent is current.
- Collab host and guest actions call the privacy gate before connecting.
- Sentry is not initialized unless diagnostics are opted in and a DSN exists.
