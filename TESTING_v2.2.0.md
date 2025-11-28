# Testing Guide for v2.2.0 - Chrome Storage Sync Migration

## Pre-Testing Setup

### Step 1: Reload Extension in Chrome
1. Open Chrome and go to `chrome://extensions/`
2. Find "Email Thread Notes" extension
3. Click the **Reload** button (circular arrow icon)
4. Verify version shows **2.2.0**

### Step 2: Check Chrome Sync Status
1. Go to `chrome://settings/syncSetup`
2. Ensure "Sync everything" or at least "Extensions" is enabled
3. If not enabled, turn on Chrome Sync and sign in

## Test Cases

### Test 1: Basic Note Creation & Sync Storage
**Objective**: Verify notes are saved to chrome.storage.sync

1. Open Gmail or Outlook
2. Open any email thread
3. Click extension icon to open side panel
4. Click "Thread Notes" button
5. Add some text in the editor: "Test note v2.2.0"
6. Click save button or wait for auto-save
7. Verify save status shows "Saved"

**Verification**:
- Open Chrome DevTools Console
- Run: `chrome.storage.sync.get(null, (data) => console.log(data))`
- Confirm you see your note data with `email_notes_` prefix

### Test 2: No Download Animations
**Objective**: Verify no download UI appears when saving notes

1. Create or edit a note in Thread Notes view
2. Save the note
3. **Check Downloads bar at bottom of Chrome** - should NOT appear
4. Edit the note again and save
5. **Verify again** - no downloads should trigger

**Expected**: No download animations or files created in Downloads folder

### Test 3: Auto-Sync UI Removal
**Objective**: Verify old auto-sync UI is completely removed

1. Open side panel
2. Click settings icon (⚙️)
3. Settings panel should show:
   - ✅ Export All Notes button
   - ✅ Import Notes button
   - ✅ Cloud sync info message (☁️)
   - ❌ NO auto-sync toggle
   - ❌ NO sync frequency dropdown
   - ❌ NO "Downloads/EmailNotes..." file path

**Expected**: Clean settings panel without auto-sync controls

### Test 4: Quota Checking
**Objective**: Verify quota checking works for large notes

1. Create a new note with very large content
2. Copy/paste a large text (aim for >8KB)
3. Try to save
4. If note exceeds 8KB, should see error message about quota

**How to generate 8KB+ text**:
- Paste this 1000+ times: "This is a test sentence for quota checking. "
- Or paste a very long email thread content

**Expected**: Error message if note exceeds Chrome sync limits

### Test 5: Cross-Device Sync (If you have multiple Chrome browsers)
**Objective**: Verify notes sync across devices automatically

**Setup Required**: Two Chrome browsers with same Google account signed in

1. On **Device A**: Create a note "Test from Device A"
2. Save and wait 30 seconds
3. On **Device B**: Open the extension
4. Navigate to "All Notes" view
5. Verify the note appears

**Expected**: Note syncs automatically within 1-2 minutes

### Test 6: Export/Import Still Works
**Objective**: Verify manual backup functionality is intact

1. Create 2-3 test notes
2. Click settings (⚙️)
3. Click "Export All Notes"
4. **Verify**: Download dialog appears (this is expected!)
5. Choose location and save file
6. Verify JSON file is created
7. Delete all notes
8. Click "Import Notes"
9. Select the exported file
10. Verify notes are restored

**Expected**: Export/import works normally with download dialog

### Test 7: Migration from Local Storage (If you have existing notes)
**Objective**: Verify existing notes still work after migration

**Note**: This only applies if you had notes before the update

1. After reloading extension (Step 1)
2. Open "All Notes" view
3. Verify all your previous notes still appear
4. Open a specific note
5. Edit and save it
6. Verify it saves without errors

**Expected**: Existing notes remain accessible and editable

## Console Debugging

If you encounter issues, check the console logs:

1. **Background Service Worker Console**:
   - Go to `chrome://extensions/`
   - Find Email Thread Notes
   - Click "service worker" link
   - Check for errors related to `chrome.storage.sync`

2. **Side Panel Console**:
   - Open side panel
   - Right-click in side panel → Inspect
   - Check Console tab for errors

3. **Content Script Console**:
   - Open Gmail/Outlook
   - Press F12 to open DevTools
   - Check Console for errors

## Common Issues & Solutions

### Issue: Notes not syncing across devices
- **Solution**: Ensure Chrome Sync is enabled on both devices
- Check: `chrome://settings/syncSetup`

### Issue: "Quota exceeded" errors
- **Solution**: Notes are too large. Each note has 8KB limit.
- Try reducing note size or use export for large notes

### Issue: Extension not loading
- **Solution**:
  - Check for errors in service worker console
  - Try unloading and reloading extension
  - Check manifest.json is valid

### Issue: Old notes not appearing
- **Solution**: They might still be in local storage
- Run in console: `chrome.storage.local.get(null, (d) => console.log(d))`
- If data exists, manually export from old storage before migration

## Success Criteria

✅ All tests pass without errors
✅ No download animations when saving notes
✅ Settings UI shows cloud sync message
✅ Notes persist across browser restarts
✅ Export/Import works for manual backups
✅ No console errors in any context

## Report Issues

If you find any bugs or issues during testing:

1. Note the exact steps to reproduce
2. Check console for error messages
3. Note which test case failed
4. Share console errors and steps with development team
