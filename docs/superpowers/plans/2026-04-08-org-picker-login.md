# Org Picker During Login — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an org selection step to the login flow so multi-org users can choose which organization the widget monitors.

**Architecture:** Modify `validate-session-key` IPC handler to return the full org list when >1 org exists. Add a new `loginStep3` UI screen with radio-style org cards. Both `handleAutoDetect` and `handleConnect` detect the multi-org response and route to the picker instead of completing login. The picker selection completes login with the chosen org UUID.

**Tech Stack:** Vanilla HTML/CSS/JS, Electron IPC (`ipcMain.handle`), `fetchViaWindow` for API calls.

**Beads Issue:** `claude-usage-widget-93g`

**Parent PRD:** `docs/prd-org-selection.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `main.js` | Modify | `validate-session-key` handler: return `organizations` array for multi-org |
| `src/renderer/index.html` | Modify | Add `loginStep3` section with org picker markup |
| `src/renderer/styles.css` | Modify | Add org card, badge, and picker styles |
| `src/renderer/app.js` | Modify | Org picker logic, modified login handlers, new DOM refs |

---

### Task 1: Modify `validate-session-key` IPC Handler

**Files:**
- Modify: `main.js:284-311`

- [ ] **Step 1: Modify the handler to branch on org count**

Replace the `validate-session-key` handler (lines 284-311) with:

```javascript
ipcMain.handle('validate-session-key', async (event, sessionKey) => {
  debugLog('Validating session key:', sessionKey.substring(0, 20) + '...');
  try {
    // Set the cookie in Electron's session first
    await setSessionCookie(sessionKey);

    // Fetch organizations using hidden BrowserWindow (bypasses Cloudflare)
    const data = await fetchViaWindow('https://claude.ai/api/organizations');

    if (data && Array.isArray(data) && data.length > 0) {
      if (data.length === 1) {
        // Single org — return organizationId directly (backward compat)
        const orgId = data[0].uuid || data[0].id;
        debugLog('Session key validated, single org ID:', orgId);
        return { success: true, organizationId: orgId };
      }

      // Multiple orgs — return the full list for the picker
      const organizations = data.map(org => ({
        uuid: org.uuid || org.id,
        name: org.name,
        capabilities: org.capabilities || [],
        raven_type: org.raven_type || null
      }));
      debugLog('Session key validated, multiple orgs:', organizations.length);
      return { success: true, organizations };
    }

    // Check if it's an error response
    if (data && data.error) {
      return { success: false, error: data.error.message || data.error };
    }

    return { success: false, error: 'No organization found' };
  } catch (error) {
    console.error('Session key validation failed:', error.message);
    // Clean up the invalid cookie
    await session.defaultSession.cookies.remove('https://claude.ai', 'sessionKey');
    return { success: false, error: error.message };
  }
});
```

- [ ] **Step 2: Verify the app still starts**

Run: `pnpm start`
Expected: App launches, existing single-org login still works (returns `organizationId` as before).

- [ ] **Step 3: Commit**

```bash
git add main.js
git commit -m "feat: validate-session-key returns org list for multi-org sessions"
```

---

### Task 2: Add loginStep3 HTML Markup

**Files:**
- Modify: `src/renderer/index.html:80-100` (after `loginStep2` closing div)

- [ ] **Step 1: Add the loginStep3 section**

Insert after the closing `</div>` of `loginStep2` (line 99) and before the closing `</div>` of `login-content` (line 100):

```html
                    <div class="login-step3" id="loginStep3" style="display: none;">
                        <div class="org-picker">
                            <div class="org-picker-header">
                                <h3>Select Organization</h3>
                                <p>Choose which organization to monitor</p>
                                <p class="org-picker-warning" id="orgPickerWarning" style="display: none;"></p>
                            </div>
                            <div class="org-list" id="orgList"></div>
                            <div class="org-picker-footer">
                                <button class="org-continue-btn" id="orgContinueBtn" disabled>Continue</button>
                            </div>
                        </div>
                    </div>
```

- [ ] **Step 2: Verify HTML renders without errors**

Run: `pnpm start`
Expected: App launches with no console errors. Step 3 is hidden (display: none).

- [ ] **Step 3: Commit**

```bash
git add src/renderer/index.html
git commit -m "feat: add loginStep3 org picker HTML skeleton"
```

---

### Task 3: Add Org Picker CSS Styles

**Files:**
- Modify: `src/renderer/styles.css` (add after the Step 2 styles, around line 340)

- [ ] **Step 1: Add org picker styles**

Insert after the `.back-step-btn:hover` rule (find by searching for `.back-step-btn:hover`) in `styles.css`:

```css
/* Step 3: Org Picker */
.login-step3 {
    width: 100%;
}

.org-picker {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
}

.org-picker-header h3 {
    color: #e0e0e0;
    font-size: 13px;
    margin-bottom: 2px;
}

.org-picker-header p {
    color: #a0a0a0;
    font-size: 11px;
    margin: 0;
}

.org-picker-warning {
    color: #f59e0b;
    font-size: 10px;
    margin-top: 4px;
}

.org-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 240px;
    overflow-y: auto;
}

.org-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.03);
    cursor: pointer;
    transition: all 0.15s ease;
}

.org-card:hover {
    border-color: rgba(139, 92, 246, 0.3);
    background: rgba(139, 92, 246, 0.05);
}

.org-card.selected {
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.1);
}

.org-radio {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s ease;
}

.org-card.selected .org-radio {
    border-color: #8b5cf6;
}

.org-radio-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #8b5cf6;
    transform: scale(0);
    transition: transform 0.15s ease;
}

.org-card.selected .org-radio-dot {
    transform: scale(1);
}

.org-info {
    flex: 1;
    min-width: 0;
}

.org-name {
    color: #e0e0e0;
    font-size: 12px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.org-meta {
    display: flex;
    gap: 4px;
    margin-top: 2px;
    flex-wrap: wrap;
}

.org-badge {
    font-size: 9px;
    padding: 1px 5px;
    border-radius: 3px;
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    white-space: nowrap;
}

.org-badge.raven-type {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
}

.org-continue-btn {
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    color: white;
    border: none;
    padding: 8px 20px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-end;
}

.org-continue-btn:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.org-continue-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
}

.org-picker-footer {
    display: flex;
    justify-content: flex-end;
}
```

- [ ] **Step 2: Add light theme overrides**

Search for the light theme section (`.light-theme` selectors) and add these inside it:

```css
.light-theme .org-card {
    border-color: rgba(0, 0, 0, 0.1);
    background: rgba(0, 0, 0, 0.02);
}

.light-theme .org-card:hover {
    border-color: rgba(139, 92, 246, 0.3);
    background: rgba(139, 92, 246, 0.05);
}

.light-theme .org-card.selected {
    border-color: #8b5cf6;
    background: rgba(139, 92, 246, 0.08);
}

.light-theme .org-radio {
    border-color: rgba(0, 0, 0, 0.2);
}

.light-theme .org-name {
    color: #1a1a2e;
}

.light-theme .org-picker-header h3 {
    color: #1a1a2e;
}

.light-theme .org-picker-warning {
    color: #d97706;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/styles.css
git commit -m "feat: add org picker card and badge styles with light theme support"
```

---

### Task 4: Wire Up Org Picker Logic in app.js

**Files:**
- Modify: `src/renderer/app.js`

This is the largest task — it adds DOM references, the org picker rendering/selection logic, and modifies both login handlers.

- [ ] **Step 1: Add DOM references for Step 3 elements**

In the `elements` object (around line 26-98), add these entries after `loginStep2` (line 32):

```javascript
    loginStep3: document.getElementById('loginStep3'),
    orgList: document.getElementById('orgList'),
    orgContinueBtn: document.getElementById('orgContinueBtn'),
    orgPickerWarning: document.getElementById('orgPickerWarning'),
```

- [ ] **Step 2: Add app-level state for pending login**

After the existing state variables at the top of the file (around line 13, after `const GRAPH_HEIGHT = 232;`), add:

```javascript
let pendingSessionKey = null; // Holds sessionKey while org picker is shown
```

- [ ] **Step 3: Add the org picker rendering and selection functions**

Insert these functions after the `handleAutoDetect` function (after line 399):

```javascript
// Render org cards in the Step 3 picker
function renderOrgPicker(organizations) {
    elements.orgList.innerHTML = '';
    let selectedUuid = null;

    organizations.forEach(org => {
        const card = document.createElement('div');
        card.className = 'org-card';
        card.dataset.uuid = org.uuid;

        // Radio indicator
        const radio = document.createElement('div');
        radio.className = 'org-radio';
        const dot = document.createElement('div');
        dot.className = 'org-radio-dot';
        radio.appendChild(dot);

        // Org info
        const info = document.createElement('div');
        info.className = 'org-info';

        const name = document.createElement('div');
        name.className = 'org-name';
        name.textContent = org.name;
        info.appendChild(name);

        // Badges (capabilities + raven_type)
        const meta = document.createElement('div');
        meta.className = 'org-meta';

        if (Array.isArray(org.capabilities)) {
            org.capabilities.forEach(cap => {
                const badge = document.createElement('span');
                badge.className = 'org-badge';
                badge.textContent = cap;
                meta.appendChild(badge);
            });
        }

        if (org.raven_type) {
            const badge = document.createElement('span');
            badge.className = 'org-badge raven-type';
            badge.textContent = org.raven_type;
            meta.appendChild(badge);
        }

        info.appendChild(meta);
        card.appendChild(radio);
        card.appendChild(info);

        card.addEventListener('click', () => {
            // Deselect previous
            const prev = elements.orgList.querySelector('.org-card.selected');
            if (prev) prev.classList.remove('selected');
            // Select this one
            card.classList.add('selected');
            selectedUuid = org.uuid;
            elements.orgContinueBtn.disabled = false;
        });

        elements.orgList.appendChild(card);
    });

    // Continue button handler — replace to avoid stacking listeners
    const newBtn = elements.orgContinueBtn.cloneNode(true);
    elements.orgContinueBtn.replaceWith(newBtn);
    elements.orgContinueBtn = newBtn;

    newBtn.addEventListener('click', async () => {
        if (!selectedUuid || !pendingSessionKey) return;
        newBtn.disabled = true;
        newBtn.textContent = 'Connecting...';

        credentials = { sessionKey: pendingSessionKey, organizationId: selectedUuid };
        await window.electronAPI.saveCredentials(credentials);
        pendingSessionKey = null;

        showMainContent();
        await fetchUsageData();
        startAutoUpdate();
    });
}

// Show the org picker (Step 3)
function showOrgPicker(organizations, warningMessage) {
    elements.loginStep1.style.display = 'none';
    elements.loginStep2.style.display = 'none';
    elements.loginStep3.style.display = 'block';

    if (warningMessage) {
        elements.orgPickerWarning.textContent = warningMessage;
        elements.orgPickerWarning.style.display = 'block';
    } else {
        elements.orgPickerWarning.style.display = 'none';
    }

    // Reset continue button state
    elements.orgContinueBtn.disabled = true;
    elements.orgContinueBtn.textContent = 'Continue';

    renderOrgPicker(organizations);

    // Resize widget to fit the picker content
    // Title bar (36) + header (~50) + cards (org count * 48) + footer (~40) + padding (30)
    const pickerHeight = 36 + 50 + (organizations.length * 48) + 40 + 30;
    const minHeight = 200;
    window.electronAPI.resizeWindow(Math.max(pickerHeight, minHeight));
}
```

- [ ] **Step 4: Modify `handleConnect` to detect multi-org response**

Replace the `handleConnect` function (lines 332-361) with:

```javascript
async function handleConnect() {
    const sessionKey = elements.sessionKeyInput.value.trim();
    if (!sessionKey) {
        elements.sessionKeyError.textContent = 'Please paste your session key';
        return;
    }

    elements.connectBtn.disabled = true;
    elements.connectBtn.textContent = '...';
    elements.sessionKeyError.textContent = '';

    try {
        const result = await window.electronAPI.validateSessionKey(sessionKey);
        if (result.success) {
            if (result.organizations) {
                // Multi-org — show picker
                pendingSessionKey = sessionKey;
                elements.sessionKeyInput.value = '';
                showOrgPicker(result.organizations);
            } else {
                // Single org — complete login directly
                credentials = { sessionKey, organizationId: result.organizationId };
                await window.electronAPI.saveCredentials(credentials);
                elements.sessionKeyInput.value = '';
                showMainContent();
                await fetchUsageData();
                startAutoUpdate();
            }
        } else {
            elements.sessionKeyError.textContent = result.error || 'Invalid session key';
        }
    } catch (error) {
        elements.sessionKeyError.textContent = 'Connection failed. Check your key.';
    } finally {
        elements.connectBtn.disabled = false;
        elements.connectBtn.textContent = 'Connect';
    }
}
```

- [ ] **Step 5: Modify `handleAutoDetect` to detect multi-org response**

Replace the `handleAutoDetect` function (lines 364-399) with:

```javascript
async function handleAutoDetect() {
    elements.autoDetectBtn.disabled = true;
    elements.autoDetectBtn.textContent = 'Waiting...';
    elements.autoDetectError.textContent = '';

    try {
        const result = await window.electronAPI.detectSessionKey();
        if (!result.success) {
            elements.autoDetectError.textContent = result.error || 'Login failed';
            return;
        }

        // Got sessionKey from login, now validate it
        elements.autoDetectBtn.textContent = 'Validating...';
        const validation = await window.electronAPI.validateSessionKey(result.sessionKey);

        if (validation.success) {
            if (validation.organizations) {
                // Multi-org — show picker
                pendingSessionKey = result.sessionKey;
                showOrgPicker(validation.organizations);
            } else {
                // Single org — complete login directly
                credentials = {
                    sessionKey: result.sessionKey,
                    organizationId: validation.organizationId
                };
                await window.electronAPI.saveCredentials(credentials);
                showMainContent();
                await fetchUsageData();
                startAutoUpdate();
            }
        } else {
            elements.autoDetectError.textContent =
                'Session invalid. Try again or use Manual →';
        }
    } catch (error) {
        elements.autoDetectError.textContent = error.message || 'Login failed';
    } finally {
        elements.autoDetectBtn.disabled = false;
        elements.autoDetectBtn.textContent = 'Log in';
    }
}
```

- [ ] **Step 6: Update `showLoginRequired` to reset Step 3**

In the `showLoginRequired` function (around line 1056), add these lines after `elements.loginStep2.style.display = 'none';` (line 1063):

```javascript
    elements.loginStep3.style.display = 'none';
    elements.orgPickerWarning.style.display = 'none';
    pendingSessionKey = null;
```

- [ ] **Step 7: Verify the full login flow**

Run: `pnpm start`

Test scenarios:
1. Single-org user: Login should complete directly (no picker shown)
2. Multi-org user: After login/validation, Step 3 should appear with org cards
3. Selecting an org card should highlight it and enable "Continue"
4. Clicking "Continue" should complete login and show the dashboard
5. Widget should resize to fit the org list

- [ ] **Step 8: Commit**

```bash
git add src/renderer/app.js
git commit -m "feat: wire org picker logic into login flow for multi-org users"
```

---

### Task 5: Final Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Test single-org backward compatibility**

Run: `pnpm start`
If you have a single-org account, verify login completes without showing the picker.

- [ ] **Step 2: Test light theme**

Open settings, switch to light theme, then log out and log back in. Verify org cards (if shown) render correctly in light theme.

- [ ] **Step 3: Test window resize**

If the picker is shown, verify the widget window grows to fit the org list. After selecting an org and completing login, verify the widget returns to its normal dashboard size.

- [ ] **Step 4: Final commit if any adjustments needed**

```bash
git add -A
git commit -m "fix: integration adjustments for org picker"
```
