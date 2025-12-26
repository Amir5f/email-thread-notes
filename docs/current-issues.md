# Current Issues - Email Thread Notes Extension

**Last Updated:** 2025-11-30

## Critical Issues

### 1. ❌ Sticky Note Bug (IN PROGRESS)
**Status:** Actively debugging
**Priority:** CRITICAL

**Problem:**
When navigating from Thread A (with content) to Thread B (empty or different content), Thread A's notes remain visible in the editor instead of showing Thread B's content.

**Root Cause Analysis:**
- Gmail content script IS detecting thread changes correctly ✅
- Content script IS sending `threadChanged` messages ✅
- Issue: After extension reload, "Extension context invalidated" errors occur
- Solution attempted: Added context validation in `notifySidebar()`
- **Current State:** After refreshing Gmail tab, thread detection works but sticky bug persists

**Debug Logs Show:**
- `detectCurrentThread` correctly identifies different thread IDs
- `loadThreadNotes()` is called
- `setMarkdown()` succeeds with retry logic
- BUT: Editor still shows old content

**Next Steps:**
1. Verify sidebar is receiving `threadChanged` messages after Gmail refresh
2. Check if `handleThreadChange()` is being called in sidebar
3. Verify `this.currentThreadId` is being updated correctly
4. Add logging to trace complete message flow: Gmail → Background → Sidebar

---

## Expected Behavior (Finalized)

### Auto-Switching
- When user navigates to ANY Gmail thread → Sidebar automatically switches to "Thread Notes" view

### Manual Selection
- Manual selection from "All Notes" is temporary and overridden when user navigates to a different Gmail thread

### Open Thread Button
- **When on same thread:** Show "Current Thread" (clicking switches to Thread Notes view)
- **When on different thread:** Show "Open Thread" (clicking navigates browser to that thread)

### New Thread Behavior
- Auto-switch to "Thread Notes" with empty editor ready for input

---

## Remaining Issues

### 2. ⏸️ Auto-Switch to Thread Notes
**Status:** Pending verification
**Priority:** HIGH

Verify that sidebar automatically switches to "Thread Notes" view when navigating Gmail threads (implementation exists, needs testing after sticky bug is fixed).

### 3. ⏸️ Smart Open Thread Button Labeling
**Status:** Not implemented
**Priority:** MEDIUM

Need to implement:
- Detect if sidebar's current thread matches browser's actual thread
- Show "Current Thread" vs "Open Thread" label accordingly

**Location:** `sidebar.js` - `openCurrentThread()` and button rendering logic

### 4. ❌ RTL Text Alignment (BLOCKED - Milkdown Limitation)
**Status:** Cannot be fixed with Milkdown
**Priority:** HIGH
**Updated:** 2025-12-26

**Problem:**
RTL text (Hebrew, Arabic) aligns correctly, but **numbered list markers appear outside the editor box** on the left side instead of inside on the right side.

**Root Cause:**
Milkdown/ProseMirror has deep architectural assumptions about LTR text layout. List markers are rendered in the margin/gutter area controlled by ProseMirror's internal layout engine, not accessible via CSS.

**What We Tried:**
1. ❌ `list-style-position: inside` - ignored by ProseMirror
2. ❌ `direction: rtl` on all elements - text aligns but lists don't
3. ❌ CSS pseudo-elements (`::before`) with counters - still render outside box
4. ❌ Aggressive `!important` overrides - no effect on ProseMirror internals
5. ❌ Debounced RTL detection to avoid performance issues - detection works, rendering doesn't

**Evidence:**
- Screenshot shows numbered lists (1, 2, 3) appearing in left margin
- Text is correctly right-aligned
- RTL detection (`detectAndSetTextDirection()`) works correctly
- Issue is in ProseMirror's rendering layer, not detection

**Next Steps:**
- **Option A:** Switch to Monaco Editor (better RTL support, but 2-3MB bundle)
- **Option B:** Switch to plain `<textarea>` (perfect RTL, no markdown rendering)
- **Option C:** Switch to popup widget UI + try Milkdown there (different CSS context might help)

**Location:**
- `sidebar.js:1743-1829` - RTL detection logic
- `sidebar.html:757-814` - RTL CSS attempts
- `milkdown-init.js` - Editor initialization

**Technical Notes:**
- Milkdown uses ProseMirror which renders lists with `::marker` pseudo-element
- The `::marker` positioning is not controllable via CSS in RTL contexts
- This is a known limitation of ProseMirror's layout engine

### 5. ⏸️ Editor Clickability
**Status:** Not implemented
**Priority:** LOW

Entire text box area should be clickable to focus/start typing. Currently may require clicking specific area.

### 6. ⏸️ Extension Lock When Not on Gmail
**Status:** Not implemented
**Priority:** LOW

Extension should be locked/collapsed when not inside Gmail. Currently shows "Visit Gmail or Outlook" message but doesn't lock UI.

**Design Decision Needed:** Should it collapse, lock, or just show placeholder?

---

## Completed Fixes

### ✅ Sticky Note Bug
**Fixed:** 2025-12-26

**Problem:** When navigating between threads, old thread's content remained visible instead of loading new thread's content

**Root Cause:** Milkdown throws `RangeError: Empty text nodes are not allowed` when trying to clear editor with empty string `''`

**Solution:** Use single space `' '` instead of empty string when clearing editor
```javascript
// milkdown-init.js line 80
const content = markdown && markdown.trim() ? markdown : ' ';
```

**Files Changed:**
- `src/milkdown-init.js:73-108` - Added empty string handling

---

### ✅ Milkdown Editor Duplication Bug
**Fixed:** 2025-12-26

**Problem:** Multiple `.milkdown` divs spawning continuously, covering UI elements and causing performance degradation

**Root Cause:** Recursive `initMilkdownEditor()` call in error handler created infinite loop when `setMarkdown()` failed

**Solution:**
- Removed recursive editor recreation (was at line 69: `return await initMilkdownEditor(...)`)
- Added retry logic (10 attempts, 50ms delay) to wait for editor readiness
- Added `isInitializingEditor` flag to prevent concurrent initializations
- Added cleanup of existing `.milkdown` divs before creating new editor

**Files Changed:**
- `src/milkdown-init.js:73-108` - Removed recursive fallback, added retry logic
- `src/sidebar.js:1833-1924` - Added initialization guard and cleanup

---

### ✅ Smart "Open Thread" Button Labeling
**Fixed:** 2025-12-26

**Problem:** Button always said "Open thread" even when already viewing that thread

**Solution:**
- Added `checkIfOnCurrentThread()` to compare sidebar thread with browser URL
- Button now shows "Current thread" when on the same thread, "Open thread" when different
- Updates dynamically when user navigates Gmail

**Files Changed:**
- `src/sidebar.js:514-556` - Added `updateOpenThreadButtonLabel()` and `checkIfOnCurrentThread()`
- `src/sidebar.html:832` - Wrapped button text in `<span class="button-text">`

---

### ✅ All Notes Filtering Fix
**Fixed:** 2025-12-26

**Problem:** "All Notes" view showed incomplete list - only notes for current thread's account, or empty when not in a thread

**Root Cause:** `handleNoThread()` was clearing `this.currentPlatform` and `this.currentAccount` to null, breaking filtering logic

**Solution:** Keep platform/account info even when no thread is active, so filtering works correctly

**Files Changed:**
- `src/sidebar.js:423-429` - Commented out the code that cleared platform/account

---

### ✅ Open Thread Button Navigation
**Fixed:** 2025-12-26

**Problem:** Button incorrectly switched to Thread Notes view instead of navigating to thread URL

**Root Cause:** Code checked if `threadId === this.currentThreadId` and skipped navigation

**Solution:** Removed the check - always navigate when user clicks "Open Thread"

**Files Changed:**
- `src/sidebar.js:1054-1056` - Removed early return check

---

### ✅ RTL Performance Issue
**Fixed:** 2025-12-26

**Problem:** Editor became unresponsive/locked up browser when typing RTL text

**Root Cause:** RTL detection (`detectAndSetTextDirection()`) was running on every keystroke via:
1. Milkdown onChange handler (line 1892)
2. MutationObserver watching DOM changes

**Solution:**
- Removed RTL detection from onChange handler
- Disabled MutationObserver
- Added debounced RTL detection (500ms after user stops typing)

**Files Changed:**
- `src/sidebar.js:1409-1440` - Added `rtlDetectionTimeout` and debouncing logic
- `src/sidebar.js:1892` - Removed `detectAndSetTextDirection()` call
- `src/sidebar.js:1903` - Disabled `setupRTLObserver()`

---

## Technical Architecture Notes

### Thread ID Format
**Internal Storage:** `gmail_account_<accountIndex>_<originalThreadId>`
**Example:** `gmail_account_0_FMfcgzQcqtjBVSGfVQlLXpGfXrcbhChV`

**Components:**
- `platform`: "gmail" or "outlook"
- `accountIndex`: Gmail account number from URL (`/mail/u/0/`)
- `originalThreadId`: Gmail's native thread ID

### Gmail URL Construction
**Format:** `https://mail.google.com/mail/u/{accountIndex}/#inbox/{threadId}`
**Example:** `https://mail.google.com/mail/u/0/#inbox/FMfcgzQcqtjBVSGfVQlLXpGfXrcbhChV`

### Message Flow
```
Gmail Content Script (gmail-sidebar.js)
  ↓ chrome.runtime.sendMessage()
Background Script (background.js)
  ↓ chrome.runtime.onMessage
Sidebar Script (sidebar.js)
  ↓ handleThreadChange()
  ↓ loadThreadNotes()
  ↓ chrome.storage.sync.get()
Background (storage)
  ↓ returns note data
Sidebar
  ↓ milkdownEditor.setMarkdown()
Milkdown (milkdown-init.js)
```

---

## Future Considerations

### Monaco Editor Evaluation
Consider switching from Milkdown to Monaco Editor if current issues persist.

**Pros:**
- More stable, widely used
- Better performance
- Rich text editing features

**Cons:**
- Larger bundle size
- More complex setup

**Resource:** https://www.npmjs.com/package/@monaco-editor/react

---

## Development Workflow

### When Extension Context Invalidates
This happens when the extension reloads. To recover:

1. **Refresh Gmail tab** (or any tab with content script)
2. **Reopen sidebar** if needed
3. Content script will reconnect automatically

### Debugging Tips

**Gmail Console Logs:**
- Thread detection: `🔍 detectCurrentThread:`
- Thread changes: `✅ THREAD CHANGED:`

**Sidebar Console Logs:**
- Thread loading: `=== LOAD THREAD NOTES ===`
- Editor operations: `✅ Markdown content set successfully`
- Initialization: `🔄 initMilkdownEditor called`

**Background Console Logs:**
- Storage operations: `Background: Saving note...`
- Message routing: Check for errors
