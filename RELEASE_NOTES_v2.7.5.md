# Release Notes - v2.7.5

**Release Date**: 2025-12-27
**Focus**: Critical UX fixes based on user feedback

## 🎯 What's Fixed

### 1. ✅ Side Panel Auto-Close on Non-Email Sites
**Problem**: Side panel remained visible when switching to non-email tabs/websites (annoying!)
**Fix**: Side panel now automatically closes when you navigate away from Gmail/Outlook
**Impact**: Clean browsing experience - the extension only appears where it's needed

**Technical Details**:
- Added smart tab detection in `background.js`
- Monitors tab URL changes and activation events
- Automatically disables side panel on non-email domains
- Supports: `mail.google.com`, `outlook.office365.com`, `outlook.office.com`, `outlook.live.com`

---

### 2. ✅ Larger Editor Click Area
**Problem**: Editor click target was too small - had to click precisely in the text area
**Fix**: Entire editor area is now clickable, click anywhere to start typing
**Impact**: Much more intuitive and faster to start writing notes

**Visual Improvements**:
- Editor min-height increased from ~300px to **450px**
- Shows helpful placeholder: "Click anywhere to start writing your note..."
- Entire container shows text cursor to indicate clickability
- Click anywhere in the editor area to focus (not just on existing text)

---

### 3. ✅ Fast Auto-Save (3 seconds)
**Problem**: Auto-save took 120 seconds (2 minutes!) - changes could be lost easily
**Fix**: Auto-save now triggers after just **3 seconds** of inactivity
**Impact**: Your notes are saved almost instantly, no manual save needed

**How It Works**:
- Type normally, auto-save kicks in 3 seconds after you stop typing
- Also saves when:
  - Switching threads
  - Closing the browser
  - Switching tabs
  - Clicking outside the editor
- Visual "Saved" indicator shows when save completes
- Extremely reliable - won't lose your work!

---

## 📦 Installation Instructions

### For Testing (Developer Mode):

1. **Download the extension folder** (or use your current development folder)

2. **Open Chrome Extensions Page**:
   - Navigate to `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)

3. **Load the Extension**:
   - Click **"Load unpacked"**
   - Select the folder: `Email thread Notes/`
   - Extension should appear with version **2.7.5**

4. **Test the Fixes**:
   - ✅ Open Gmail, use the extension
   - ✅ Switch to a non-email tab → side panel should close
   - ✅ Go back to Gmail → side panel available again
   - ✅ Click anywhere in the editor area → should focus immediately
   - ✅ Type a note → should auto-save after 3 seconds
   - ✅ Check status indicator shows "Saved"

---

## 🔮 What's Next?

Based on our discussion, we still need to address:
- **Issue #2**: Milkdown RTL support (not included in this release - needs discussion)

Possible approaches for RTL:
- **Option A**: Revert to simple `<textarea>` with native `dir="auto"` (reliable, fast)
- **Option B**: Fix Milkdown RTL properly (more complex, 2-3 days)

---

## 🐛 Known Issues

- Milkdown RTL detection can be flaky for mixed LTR/RTL content
- Editor styling may need additional polish
- First-time focus might require 2 clicks (Milkdown initialization race)

---

## 📝 Technical Changes

### Modified Files:
1. **manifest.json**: Version bump to 2.7.5
2. **src/background.js**: Added tab URL monitoring and side panel auto-close logic
3. **src/sidebar.html**: Expanded editor CSS (min-height, cursor, placeholder)
4. **src/sidebar.js**:
   - Added `focusEditor()` helper method
   - Click-anywhere-to-focus event listener
   - Auto-save timeout changed from 120000ms → 3000ms

### Lines Changed: ~80 lines
### Files Modified: 4 files
### Backward Compatible: ✅ Yes (all existing notes work as before)

---

## 💡 Feedback Welcome

Try the new version and let me know:
1. Does the side panel auto-close work as expected?
2. Is the editor click area better now?
3. Is the 3-second auto-save fast enough? (or should it be faster/slower?)
4. Any other UX issues you've noticed?

---

**Built with user feedback in mind 🚀**
