# PRD: Organization Selection During Login

## Problem Statement

Users with multiple Claude.ai organizations are unable to choose which org the widget tracks. The current implementation blindly selects the first organization returned by the API (`data[0].uuid`), which is often a personal free-tier org rather than the team/paid org the user actually wants to monitor. This makes the widget unusable for multi-org users without manual workarounds, and blocks sharing the tool with coworkers who need to track their team's Claude Code usage.

## Solution

Add an organization selection step to the authentication flow. After the user logs in (either via auto-detect or manual session key), the widget checks how many organizations the session has access to. If there are multiple, it presents a picker screen where the user can choose which org to monitor. The choice is persisted and reused on future launches. Users can also switch organizations from the settings panel without logging out.

## User Stories

1. As a multi-org user, I want to choose which organization the widget monitors, so that I see usage data relevant to my team rather than a personal account.
2. As a single-org user, I want the login flow to remain unchanged, so that I don't have to deal with an unnecessary selection step.
3. As a returning user, I want my org choice to be remembered across app launches, so that I don't have to re-select every time.
4. As a user whose org has been removed or renamed, I want a clear prompt to re-select when my saved org is no longer available, so that I'm not silently switched to a different org.
5. As a user who belongs to orgs with the same name, I want to see capability badges (chat, api, raven) and team type alongside org names, so that I can distinguish between them.
6. As a multi-org user, I want to switch my monitored org from settings without logging out, so that I can quickly check usage across different organizations.
7. As a user switching orgs from settings, I want the dashboard to immediately refresh with the new org's data, so that I don't have to manually trigger a refresh.
8. As a user, I want the org picker to clearly indicate which org is selected before I confirm, so that I don't accidentally pick the wrong one.
9. As a coworker receiving this tool, I want the org selection to be intuitive without documentation, so that I can set it up independently.
10. As a user with many orgs, I want the widget window to resize to fit the full list, so that I can see all options without scrolling.

## Implementation Decisions

### IPC Contract Changes

- `validate-session-key` handler behavior changes based on org count:
  - **Single org:** Returns `{ success: true, organizationId: <uuid> }` (same as today).
  - **Multiple orgs:** Returns `{ success: true, organizations: [{ uuid, name, capabilities, raven_type }, ...] }` — no `organizationId` field, signaling the renderer to show the picker.
- New `fetch-organizations` IPC handler: Re-fetches the org list from the API using the stored session cookie. Used by the settings org-switcher to get a fresh list without re-validating the session key.

### Login Flow Changes

- Both `handleAutoDetect` and `handleConnect` check the validation result:
  - If `organizationId` is present → proceed as today (single-org fast path).
  - If `organizations` array is present → transition to new Step 3 (org picker) instead of completing login.
- Step 3 presents radio-style org cards. User selects one and clicks "Continue" to complete login.

### Org Picker UI

- New `loginStep3` HTML section, following the existing step pattern (`loginStep1`, `loginStep2`).
- Each org rendered as a clickable card with:
  - Org name (primary text).
  - Capability badges: small styled tags showing each capability (e.g., `chat`, `api`, `raven`).
  - If `raven_type` is present, show it as an additional label (e.g., "team").
- Radio indicator on the selected card.
- "Continue" button below the list, disabled until an org is selected.
- Widget window resizes to fit the org list using the existing `resizeWidget` pattern.

### Persistence and Auto-Selection

- Org UUID is persisted via `electron-store` (already the case for `organizationId`).
- On launch with stored credentials:
  - Validate session and fetch orgs.
  - If stored `organizationId` exists in the returned list → auto-select it, skip picker.
  - If stored `organizationId` is NOT in the list → show picker with message: "Your previous organization is no longer available. Please select one."
  - If only one org → auto-select it, skip picker.

### Settings Org Switcher

- New row in the settings overlay showing the current org name, styled as a clickable row with a chevron.
- On click: calls `fetch-organizations` IPC handler, displays an inline picker using the same card styles as Step 3.
- On selection: saves new `organizationId` to store, immediately re-fetches usage data for the new org and updates the dashboard.

### Preload Bridge

- Expose `fetchOrganizations` method in the `electronAPI` bridge, mapping to the new `fetch-organizations` IPC handler.

## Testing Decisions

### What Makes a Good Test

Tests should verify external behavior and IPC contracts, not implementation details. Test the inputs and outputs of IPC handlers — what the renderer sends and what it receives — not how the handler internally processes data.

### Modules Under Test

- **`validate-session-key` handler:** Test that single-org API responses return `{ success, organizationId }` and multi-org responses return `{ success, organizations }`. Test error and empty-array cases.
- **`fetch-organizations` handler:** Test that it returns the org list with the expected shape (`uuid`, `name`, `capabilities`, `raven_type`).
- **Stale org detection logic:** Test that a stored orgId not present in the API response triggers the picker flow rather than auto-selecting.

### Prior Art

No existing test infrastructure in this project. Tests will require setting up a minimal test runner (e.g., Vitest or Jest) and mocking `fetchViaWindow` responses.

## Out of Scope

- **Filtering or sorting orgs** (e.g., hiding API-only orgs, sorting by raven_type): All orgs are shown equally. Users can make their own judgment.
- **Org-specific settings** (e.g., different alert thresholds per org): Settings remain global.
- **Multi-org dashboard** (monitoring multiple orgs simultaneously): The widget tracks one org at a time.
- **Org icon/avatar display**: The API has `has_icon` but fetching org icons adds complexity for minimal value.
- **Workspace selection within an org**: Out of scope for this feature.

## Further Notes

- The three orgs in the sample API response share the name "Caffelli" for two of them — this validates the decision to show capability badges as a distinguishing element.
- The `raven_type: 'team'` field on the third org indicates a Claude Code team subscription, which is the most likely target for usage monitoring. Future iterations could consider pre-selecting orgs with `raven_type` set, but this is not in scope for the initial implementation.
- The `fetchViaWindow` pattern (hidden BrowserWindow to bypass Cloudflare) is reused for the new `fetch-organizations` handler, keeping the approach consistent.
