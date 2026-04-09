# Claude Usage Widget

Electron desktop widget for monitoring Claude.ai usage. Vanilla HTML/CSS/JS — no framework. Forked from SlavomirDurej/claude-usage-widget.

## Commands

- `pnpm start` — run the app
- `pnpm dev` — run in development mode (enables devtools, verbose logging)
- `pnpm build:win` — build Windows installer + portable
- `pnpm build:mac` — build macOS DMG (requires codesigning certs)
- `pnpm build:linux` — build Linux AppImage

## Project Structure

- `main.js` — Electron main process: IPC handlers, tray, window management, all API calls
- `preload.js` — IPC bridge exposing `window.electronAPI` to renderer
- `src/renderer/` — UI: `index.html`, `app.js` (logic), `styles.css`
- `src/fetch-via-window.js` — hidden BrowserWindow HTTP client (bypasses Cloudflare)
- `assets/` — icons and logos
- `build/` — macOS entitlements
- `docs/` — PRDs and planning documents

## Architecture

**IMPORTANT: All Claude.ai API calls MUST go through `fetchViaWindow()`** — a hidden BrowserWindow that navigates to the URL and reads the response body. Direct `fetch()` or `net.request()` will be blocked by Cloudflare. This is the core constraint of the app's architecture.

IPC flow: renderer → preload (`window.electronAPI`) → main process (`ipcMain.handle`) → `fetchViaWindow` → Claude.ai API

Credentials are stored in OS keychain via Electron `safeStorage` with plain-text `electron-store` fallback.

The widget window resizes dynamically — `resizeWidget()` measures content and calls `setContentSize()`. Any new UI sections must account for this.

## Conventions

- Login flow uses numbered steps (`loginStep1`, `loginStep2`, etc.) — new login screens follow this pattern
- Settings use a 2-column toggle row layout in `.settings-row-2col`
- No test infrastructure exists yet

## Code Search

Use Vera for semantic code search and symbol lookup before broad file exploration.

- `vera search "query"` / `vera grep "pattern"` / `vera references <symbol>` / `vera overview`
- `vera watch .` to auto-update index, or `vera update .` after edits (`vera index .` if missing)
- For full usage and query patterns, read the Vera skill file installed by `vera agent install`

## Reference Documents

### PRD: Org Selection — `docs/prd-org-selection.md`

**Read when:** implementing the org picker feature or modifying the login/auth flow.
Multi-org selection during login — adds Step 3 org picker, settings org switcher, persistent org choice.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:

   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```

5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**

- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
