# Implementation Plan — Pins, Archive & UX Round (v2.8.0)

> Replaces the completed Milkdown-migration plan (see git history).
> This file is the single source of truth for the subagent loop. The orchestrator
> (Fable) updates task statuses here after validating each task.

## Orchestration model

| Role | Who | Responsibility |
|------|-----|----------------|
| Orchestrator / validator | **Fable** (main session) | Assigns tasks, reviews every diff against acceptance criteria, updates this file, prepares commits |
| Simple / mechanical tasks | **Haiku** subagent | Well-specified, single-file, low-ambiguity changes |
| Normal feature tasks | **Sonnet** subagent | Multi-concern UI/logic work within established patterns |
| Big-ticket tasks | **Opus** subagent | Fragile/cross-cutting work (DOM scraping across email clients) |

### Coordination rules (binding for every loop iteration)
1. **Strictly sequential execution.** `src/sidebar.js` is the contention hotspot — never run two tasks that touch it concurrently.
2. Each subagent prompt must include: the full task spec from this file, the list of files to read first, and the instruction to report back a summary of every change made.
3. Subagents do **not** commit, do not update this file, and do not touch files outside the task's "Files" list.
4. After each task: Fable reads the diff, checks acceptance criteria, fixes or bounces trivial issues, then marks the task `✅ done (pending user test)`.
5. **Testing tasks are only closed by the user** (per CLAUDE.local.md). Each phase ends with a manual test checklist for Amir.
6. No build step exists — plain JS/ES modules loaded by Chrome. Validation = code review + manual extension reload.

### Architecture facts subagents need
- Notes live in `chrome.storage.sync`, one item per thread, key `email_notes_<threadId>` (`src/background.js`). Quotas: 8KB/item, ~100KB total, 512 items.
- Note shape: `{ content, timestamp, platform, threadId, account, accountEmail, accountIndex, originalThreadId, subject, lastModified }` — plus new fields `pinned`, `archived`, `lastEmailSeen` (this plan).
- `saveNote` now **merges** into the existing stored note (Phase 0) — flag fields survive content auto-saves.
- Sidebar UI: `src/sidebar.html` + `src/sidebar.js` (`EmailNotesSidebar` class). All Notes list is rendered by `displayAllNotes()` via `innerHTML`; **all dynamic text must go through `this.escapeHtml()`**.
- Content scripts (`src/gmail-sidebar.js`, `src/outlook-sidebar.js`) detect threads only and message the sidebar (`threadChanged`, `platformChanged`) and background.
- CSS uses custom properties (`--bg-panel`, `--text-muted`, `--accent-color`, …) defined in `sidebar.html` — new UI must use them, no hardcoded colors.

---

## Phase 0 — Foundation

### T0.0 — Commit baseline ✅ done
Pre-existing WIP committed on `main` (9dc345f). All v2.8 work happens on branch
**`feature/v2.8-pins-archive`**, merged to `main` after the phase checklists pass.

### T0.1 — Stable extension ID (`key` for manifest) ✅ generated — applied in Phase 4
Keypair generated; private key at `~/Documents/email-thread-notes-extension-key.pem`
(**never commit it**). The `key` field is **deliberately NOT in manifest.json yet**:
the moment it is, the next extension reload switches the ID to
`imbgphgjadlgefkehpdaflmkbhalkpal` and orphans existing notes — and Phases 1–3
require constant reloads for testing. The key is added in the Phase 4 runbook,
right after the notes export. Regenerate the manifest value with:
`openssl rsa -in ~/Documents/email-thread-notes-extension-key.pem -pubout -outform DER | openssl base64 -A`

### T0.0b — Export bug hotfix ✅ done — Fable
Export failed with `this.getDeviceId is not a function` — the method was never
implemented. Added `getDeviceId()` (persistent UUID in `chrome.storage.local`).

### T0.2 — `saveNote` merge fix ✅ done — Fable
`background.js saveNote()` merges into the existing stored note instead of rebuilding it,
so `pinned`/`archived`/`importedAt`/original `timestamp` survive the 1-second auto-save.

### T0.3 — Remove broken pagination ✅ done — Fable
`displayAllNotes()` rendered only the first 20 notes with no way to load more. Now renders the full list.

### T0.4 — `updateNoteFields` background action ✅ done — Haiku (validated by Fable)
- **Files:** `src/background.js`
- **Spec:** Add `async updateNoteFields(threadId, fields)` to `EmailNotesStorage`:
  - Read `email_notes_<threadId>`; if missing → `{ success: false, error: 'Note not found' }`.
  - Whitelist-merge **only** `pinned`, `archived`, `lastEmailSeen` from `fields` (ignore everything else, especially `content`).
  - Do **not** touch `lastModified` — pinning/archiving must not reorder the "Recent First" sort.
  - Write back; return `{ success: true, noteData }`.
  - Add `case 'updateNoteFields'` to the message handler, mirroring the existing cases. Wrap in the existing try/catch pattern with `console.error` on failure.
- **Acceptance:** flags persist across a subsequent content auto-save (thanks to T0.2); unknown fields are ignored; missing note returns a clean error, no throw.

---

## Phase 1 — Pin & Archive

### T1.1 — Sort/group pipeline in All Notes ⬜ `Sonnet`
- **Files:** `src/sidebar.js` (`filterAndDisplayNotes`, `displayAllNotes` signature)
- **Spec:**
  - In `filterAndDisplayNotes()`, after filtering, split into `activeNotes` (`!noteData.archived`) and `archivedNotes`.
  - Sort each group with the existing sort switch. In `activeNotes`, pinned notes float above unpinned regardless of sort option; among pinned, the selected sort applies.
  - **Search behavior:** when the search box is non-empty, archived notes are searched too and shown in the archived section (auto-expanded for the duration of the search).
  - Call `displayAllNotes({ active, archived, searchTerm })` (adjust signature and call sites).
- **Acceptance:** no behavior change for users with no pinned/archived notes; pinned-first holds under all three sort options; empty-state logic still works when both groups are empty.

### T1.2 — Render pinned state + collapsible Archived section ⬜ `Sonnet`
- **Depends on:** T1.1
- **Files:** `src/sidebar.js` (`displayAllNotes`, `addNotesListStyles`)
- **Spec:**
  - Pinned cards: small pin SVG before the subject (use existing inline-SVG icon style, `stroke: currentColor`).
  - Below the active list, an "Archived (N)" header row with a chevron; clicking toggles the section. Collapsed by default; persist open/closed in `chrome.storage.local` key `archivedSectionOpen`; auto-expand while searching (per T1.1).
  - Archived cards: slightly dimmed (`opacity`), small "Archived" badge using the existing `.note-platform` chip style.
  - Header count becomes e.g. `12 notes · 3 archived`. Hide the archived row entirely when N = 0.
  - All styles in `addNotesListStyles()` using CSS variables.
- **Acceptance:** toggle state survives panel reopen; no layout shift at side-panel width (~320–400px); zero-archived users see no new chrome.

### T1.3 — Kebab menu + unified right-click menu ⬜ `Sonnet`
- **Depends on:** T1.2
- **Files:** `src/sidebar.js` (`displayAllNotes`, replace `showNoteContextMenu`)
- **Spec:**
  - Add a ⋮ button to each card's `.note-meta` (visible on card hover/focus, like `.note-open-btn`). Click opens an action menu anchored to the button; right-click on the card opens the **same** menu at cursor position (replaces the current delete-only `showNoteContextMenu`).
  - Items: `Pin` / `Unpin` (per `noteData.pinned`), `Archive` / `Unarchive` (per `noteData.archived`), `Delete` (destructive styling, reuse current red hover treatment).
  - Pin/Archive call `updateNoteFields` (T0.4) then re-run `loadAllNotesView()`. Delete keeps current behavior until T2.1 replaces the `confirm()`.
  - One menu instance at a time; closes on outside click, Escape, and scroll. Keep menu construction in one helper to avoid duplicating HTML strings.
- **Acceptance:** menu fully usable by mouse and right-click; no stray menus left in DOM; archived/pinned state reflected immediately in the list.

### T1.4 — Archive toggle in Thread view footer ⬜ `Haiku`
- **Depends on:** T0.4
- **Files:** `src/sidebar.html` (notes-footer), `src/sidebar.js`
- **Spec:**
  - Add a third `.icon-btn` (archive-box SVG, consistent stroke style) between Save and Delete in `.notes-actions`.
  - On click: toggle `archived` via `updateNoteFields`; button tooltip switches `Archive note` ↔ `Unarchive note`; add an `active`-style visual state when the note is archived.
  - In `loadThreadNotes()` / `selectNoteFromList()`, set the button state from the loaded note; disable the button when there is no saved note for the thread.
  - Show a small "Archived" chip next to `threadDetails` when archived.
- **Acceptance:** archiving from Thread view is reflected in All Notes (and vice versa); button disabled state correct for empty/unsaved notes; editing an archived note does not unarchive it.

### Phase 1 manual test checklist (user)
- [ ] Pin/unpin from kebab and right-click; pinned floats to top under each sort option
- [ ] Archive from list and from Thread view; note moves to collapsed section
- [ ] Archived section toggle persists across panel close/reopen
- [ ] Search finds archived notes; section auto-expands
- [ ] Auto-save (type, wait 1s) does NOT clear pin/archive flags
- [ ] Gmail and Outlook both unaffected in thread detection

---

## Phase 2 — UX round

### T2.1 — Undo toast (replace `confirm()`/`alert()`) ⬜ `Sonnet`
- **Files:** `src/sidebar.js`, `src/sidebar.html` (toast container + styles), `src/background.js` (one new action)
- **Spec:**
  - Single reusable toast at the bottom of the panel: message + `Undo` button, auto-dismisses after 5s with a subtle countdown affordance; new toast replaces the previous one (flush its pending action first).
  - **Delete** (both Thread view and list): remove the `confirm()` dialogs; delete immediately, keep the full deleted note object in memory, toast `Note deleted — Undo`.
  - **Archive** from list/thread: toast `Note archived — Undo` (undo = unarchive via `updateNoteFields`).
  - Undo for delete: new background action `restoreNote(threadId, noteData)` that writes the exact note object back (bypasses the sidebar `saveNote` path so flags/timestamps restore verbatim) and re-adds metadata.
  - Remove the `alert()` calls in `openThread`/`deleteNoteFromList` error paths — surface errors via the toast (no Undo button).
- **Acceptance:** no native dialogs remain in sidebar.js; undo restores the note byte-identical (content, flags, timestamps); toast works from both views; rapid delete-delete-undo only restores the latest.

### T2.2 — Storage usage meter in Settings ⬜ `Haiku`
- **Files:** `src/sidebar.html` (settings panel section), `src/sidebar.js` (`toggleSettings`)
- **Spec:**
  - New settings section "Storage" with a horizontal bar + label `X KB of 100 KB used (Y%)`.
  - On settings open, send `{ action: 'getStorageUsage' }` (backend already exists in background.js) and render. Bar color: accent normally, warning color above 80%.
  - Handle the `usage: null` error case with a quiet "Usage unavailable" label.
- **Acceptance:** numbers match `chrome.storage.sync.getBytesInUse()`; refreshes every time settings opens; no layout break in the settings panel.

### T2.3 — Search term highlighting ⬜ `Sonnet`
- **Files:** `src/sidebar.js` (`displayAllNotes` card HTML, `addNotesListStyles`)
- **Spec:**
  - When a search term is active, wrap case-insensitive matches in subject and preview with `<mark>`.
  - **XSS-critical order:** escape the text via `escapeHtml()` first, then run highlighting over the escaped string against the escaped search term. Never inject raw user text.
  - Preview windowing: if the first match in the preview falls beyond the 100-char cut, shift the preview window so the match is visible (prefix with `…`).
  - `<mark>` styled with the accent CSS variables (RTL-safe — no directional padding tricks).
- **Acceptance:** searching `<img` or quotes cannot break out of the markup; highlights render in RTL previews; clearing search removes all marks.

### Phase 2 manual test checklist (user)
- [ ] Delete → Undo restores note with pin/archive flags intact
- [ ] Archive → Undo works from both views
- [ ] Storage meter shows plausible numbers and updates after adding a note
- [ ] Search highlight visible in LTR + Hebrew notes; no broken layout

---

## Phase 3 — "Recent activity" sort (approximation)

### T3.1 — Scrape last-email timestamp on thread visit ⬜ `Opus`
- **Files:** `src/gmail-sidebar.js`, `src/outlook-sidebar.js`, `src/sidebar.js`, (uses T0.4 backend)
- **Why Opus:** fragile DOM scraping against two email clients that change markup frequently, plus messaging plumbing — needs judgment about selector resilience and graceful failure.
- **Spec:**
  - Gmail: on thread detection, find the newest message's date (e.g. `span.g3` title attribute holds a full datetime; investigate current DOM, prefer attribute-based over text parsing; take the **last** message node). Outlook: equivalent for conversation view.
  - Parse to epoch ms → include as `lastEmailSeen` in `threadChanged` / `getCurrentThread` payloads. On any scrape/parse failure: send `null`, log once at `console.debug`, never throw.
  - Sidebar `handleThreadChange`: if a note exists for the thread and `lastEmailSeen` is newer than the stored value, fire `updateNoteFields(threadId, { lastEmailSeen })` (do this without forcing a list re-render in Thread view). Also pass it through `saveCurrentNote` for new notes.
  - Scrape may need a short delay/retry after thread load (Gmail renders lazily) — bounded, max ~2 attempts.
- **Acceptance:** visiting an old thread updates `lastEmailSeen`; failure mode is silent and non-fatal; no polling loops beyond the existing 1s URL check; no new permissions.

### T3.2 — Sort option "Recent activity" ⬜ `Haiku`
- **Depends on:** T3.1
- **Files:** `src/sidebar.html` (sortFilter `<option value="activity">`), `src/sidebar.js` (sort switch)
- **Spec:** label `Recent activity`; sorts by `lastEmailSeen ?? lastModified` descending. Add `title` on the option/select noting it reflects activity as of your last visit to each thread.
- **Acceptance:** notes without `lastEmailSeen` interleave by `lastModified` rather than sinking to the bottom.

### Phase 3 manual test checklist (user)
- [ ] Open an old Gmail thread that has a note → its activity timestamp updates
- [ ] Same on Outlook
- [ ] Sort by Recent activity orders as expected; notes never visited since upgrade still appear (fallback)

---

## Phase 4 — Repo migration out of iCloud (manual runbook — Fable + user)

> The `key` is **not** in manifest.json during Phases 0–3, so extension reloads while
> developing/testing are safe (ID stays path-derived). This runbook is the only place
> the ID changes, and the export in step 1 is the safety net.

1. **User:** Settings → **Export Notes**. Verify the JSON file contains all notes.
2. **Fable:** Add the `key` field to manifest.json (value per T0.1) and commit.
3. **User:** Quit the Claude Code session in this folder.
4. Move the repo: `mv "~/Library/Mobile Documents/com~apple~CloudDocs/Email thread Notes" ~/Documents/"Email Thread Notes"` (user runs it, or Fable from a session opened elsewhere).
5. **User:** `chrome://extensions` → Remove the old extension entry → **Load unpacked** from the new path. Confirm the ID is `imbgphgjadlgefkehpdaflmkbhalkpal`.
6. **User:** Settings → **Import Notes** from the step-1 export. Verify count.
7. Reopen Claude Code in `~/Documents/Email Thread Notes`.
8. Future folder moves no longer affect the ID (key is pinned).

Note: the iCloud `* 2` conflict duplicates under `lib/` were already deleted (T0.0);
if iCloud regenerates any before the move, delete them again the same way.

---

## Phase 5 — Docs, backlog & release

### T5.1 — Update todos.md / backlog.md ⬜ `Haiku`
- Mark "Favorite note to top" done; add Archive/Undo/Storage meter/highlighting/activity-sort entries with status.
- Add to `backlog.md`:
  - Strip debug `console.log` noise across sidebar.js / content scripts (privacy: `gmail-sidebar.js` regex-scans page body for email addresses and logs them).
  - `background.js`: deprecated `unescape()` in export (line ~243) → replace with `TextEncoder`-based base64; unused params flagged by diagnostics.
  - `sidebar.js`: unused `markdown` callback param (~line 1966).
  - Metadata store (`email_notes_metadata`) is written on every save but never read by the UI — consider removing (saves sync write quota) or actually using it.
- **Acceptance:** files reflect reality; nothing marked complete that the user hasn't confirmed tested.

### T5.2 — Version bump + commits 🔒 `Fable + user`
- Bump manifest to `2.8.0` after user sign-off on all phase checklists.
- Commit per phase (foundation / pin+archive / UX / activity sort / docs), concise messages, no Claude mentions.

---

## Status board

| ID | Task | Model | Status |
|----|------|-------|--------|
| T0.0 | Commit baseline + branch | Fable+user | ✅ done |
| T0.0b | Export getDeviceId hotfix | Fable | ✅ done |
| T0.1 | Extension key (manifest edit in Phase 4) | Fable | ✅ generated |
| T0.2 | saveNote merge | Fable | ✅ done |
| T0.3 | Remove pagination | Fable | ✅ done |
| T0.4 | updateNoteFields action | Haiku | ✅ done |
| T1.1 | Sort/group pipeline | Sonnet | ⬜ |
| T1.2 | Pinned + Archived rendering | Sonnet | ⬜ |
| T1.3 | Kebab + context menu | Sonnet | ⬜ |
| T1.4 | Thread-view archive button | Haiku | ⬜ |
| T2.1 | Undo toast | Sonnet | ⬜ |
| T2.2 | Storage meter | Haiku | ⬜ |
| T2.3 | Search highlighting | Sonnet | ⬜ |
| T3.1 | Last-email scraping | Opus | ⬜ |
| T3.2 | Activity sort option | Haiku | ⬜ |
| T4 | Repo migration runbook | manual | ⬜ |
| T5.1 | Docs/backlog update | Haiku | ⬜ |
| T5.2 | Version bump + commits | Fable+user | ⬜ |
