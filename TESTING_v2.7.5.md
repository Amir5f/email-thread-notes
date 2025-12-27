# Testing Guide - v2.7.5

## 🚀 Installation Steps

1. **Open Chrome Extensions**
   ```
   chrome://extensions/
   ```

2. **Enable Developer Mode**
   - Toggle switch in top-right corner

3. **Remove Old Version** (if installed)
   - Find "Email Thread Notes"
   - Click "Remove"

4. **Load New Version**
   - Click "Load unpacked"
   - Navigate to: `~/Library/Mobile Documents/com~apple~CloudDocs/Email thread Notes/`
   - Click "Select"

5. **Verify Version**
   - Should show: **v2.7.5**
   - Permissions: storage, activeTab, scripting, downloads, sidePanel

---

## ✅ Test Plan

### Test 1: Side Panel Auto-Close ⭐ **NEW**

**Steps**:
1. Open Gmail in a tab
2. Click extension icon (should open side panel)
3. Leave panel open
4. Navigate to a different website (e.g., google.com, youtube.com)
5. **Expected**: Side panel should automatically close/disappear
6. Go back to Gmail tab
7. **Expected**: Side panel becomes available again (click icon to open)

**Pass Criteria**:
- ✅ Panel closes when leaving Gmail/Outlook
- ✅ Panel becomes available when returning
- ✅ Panel doesn't appear on non-email sites

---

### Test 2: Larger Click Area ⭐ **NEW**

**Steps**:
1. Open Gmail, open a thread
2. Open side panel
3. Click "Thread Notes" (should show editor)
4. Try clicking in different areas of the editor:
   - Top of editor
   - Middle of editor
   - Bottom of editor
   - Empty space around text
5. **Expected**: Editor should focus immediately when clicking anywhere

**Visual Check**:
- ✅ Editor shows text cursor when hovering
- ✅ Empty editor shows placeholder: "Click anywhere to start writing your note..."
- ✅ Editor is visibly larger than before (~450px height)

**Pass Criteria**:
- ✅ Clicking anywhere in editor container focuses it
- ✅ Don't need to click precisely on text
- ✅ Cursor appears immediately

---

### Test 3: Fast Auto-Save (3 seconds) ⭐ **NEW**

**Steps**:
1. Open Gmail, open a thread
2. Open side panel → Thread Notes
3. Start typing a note
4. Watch the status indicator (top-right):
   - Should show "Typing..." while typing
   - After you stop, should show "Ready"
   - After ~3 seconds, should show "Saving..."
   - Then "Saved"
5. **Count the time** from stopping typing to "Saved" appearing
6. **Expected**: Should be ~3-5 seconds total

**Additional Tests**:
- Type, then switch to "All Notes" view → should save automatically
- Type, then close browser → should save before closing
- Type, then switch to different thread → should save old note first

**Pass Criteria**:
- ✅ Auto-save triggers within 3-5 seconds of stopping typing
- ✅ "Saved" indicator appears
- ✅ Note persists after refresh
- ✅ No need to click "Save" button manually

---

### Test 4: Regression Tests (Make Sure Nothing Broke)

**Basic Functionality**:
- ✅ Can create a new note for a thread
- ✅ Note appears in "All Notes" list
- ✅ Can switch between threads, notes load correctly
- ✅ Can delete a note (right-click on note in list)
- ✅ RTL text still works (type some Hebrew/Arabic)
- ✅ Export/Import still work

**Multiple Accounts** (if you use multiple Gmail accounts):
- ✅ Notes are isolated per account
- ✅ Switching accounts shows different notes

---

## 🐛 Known Issues to Verify

1. **Milkdown RTL**: Still has issues with mixed LTR/RTL text
   - Not fixed in this release
   - We'll address in next version

2. **First Click**: Sometimes first click on editor might require 2 clicks
   - Milkdown initialization timing issue
   - Rare, but can happen

3. **Side Panel Icon**: On some Chrome versions, the icon might not be clickable immediately
   - Refresh the Gmail page if this happens

---

## 📊 What Changed - Quick Summary

| Issue | Before | After |
|-------|--------|-------|
| Panel stays open everywhere | ❌ Annoying | ✅ Auto-closes on non-email sites |
| Editor click area | ❌ Too small | ✅ Click anywhere works |
| Auto-save delay | ❌ 2 minutes! | ✅ 3 seconds |
| Manual save needed | ❌ Yes | ✅ No, fully automatic |

---

## 💬 Feedback Questions

After testing, please answer:

1. **Side Panel Auto-Close**:
   - Does it work reliably?
   - Any sites where it should close but doesn't?

2. **Editor Click Area**:
   - Is it easier to start typing now?
   - Is the editor big enough?
   - Placeholder text helpful?

3. **Auto-Save**:
   - Is 3 seconds the right timing?
   - Too fast? Too slow?
   - Any cases where it didn't save?

4. **General**:
   - Any new bugs introduced?
   - Performance issues?
   - Other UX problems?

---

## 🔧 Troubleshooting

**Side panel not closing?**
- Check Chrome DevTools console for errors
- Try refreshing the page
- Verify you're on v2.7.5

**Editor not focusing?**
- Wait a moment for Milkdown to initialize
- Try clicking again
- Check console for errors

**Auto-save not working?**
- Check status indicator shows "Saved"
- Verify in "All Notes" that note appears
- Check console for storage errors

**General issues?**
- Open Chrome DevTools (F12)
- Check Console tab for errors
- Send me the error messages

---

**Ready to test! 🎉**

Let me know how it goes and what needs adjustment.
