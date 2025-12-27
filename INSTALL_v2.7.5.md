# Quick Installation - v2.7.5

## 🚀 Load Extension in Chrome (2 minutes)

### Step 1: Open Extensions Page
1. Open Chrome browser
2. Navigate to: **chrome://extensions/**
3. OR: Menu → More Tools → Extensions

### Step 2: Enable Developer Mode
1. Look for toggle switch in **top-right corner**
2. Turn ON **"Developer mode"**

### Step 3: Remove Old Version (if installed)
1. Find "Email Thread Notes" in the list
2. Click **"Remove"** button
3. Confirm removal

### Step 4: Load New Version
1. Click **"Load unpacked"** button (top-left)
2. Navigate to this folder:
   ```
   ~/Library/Mobile Documents/com~apple~CloudDocs/Email thread Notes/
   ```
3. Click **"Select"** or **"Open"**

### Step 5: Verify Installation
Look for:
- ✅ Extension name: **Email Thread Notes**
- ✅ Version: **2.7.5**
- ✅ Status: **Enabled** (blue toggle)
- ✅ Permissions: storage, activeTab, scripting, downloads, sidePanel

---

## ✅ Quick Test

1. **Open Gmail** in a new tab
2. **Click extension icon** (puzzle piece in toolbar)
   - You might need to pin it: Click puzzle piece → Find "Email Thread Notes" → Click pin icon
3. **Side panel should open** on the right
4. **Open any email thread**
5. **Try the new features**:
   - Click anywhere in the large editor area
   - Type a note
   - Watch it auto-save in ~3 seconds
6. **Switch to a non-Gmail tab** (e.g., google.com)
   - Side panel should disappear
7. **Go back to Gmail**
   - Side panel icon should be available again

---

## 🐛 Troubleshooting

**Extension won't load?**
- Make sure you selected the root folder (containing `manifest.json`)
- Check for errors in red text on the extensions page
- Try refreshing the extensions page

**Side panel won't open?**
- Make sure you're on Gmail or Outlook
- Click the extension icon in the toolbar
- Try refreshing the Gmail page

**Console errors?**
1. Press **F12** (or Cmd+Option+I on Mac)
2. Click **Console** tab
3. Look for red error messages
4. Share the errors for troubleshooting

**Need help?**
- See full testing guide: [TESTING_v2.7.5.md](TESTING_v2.7.5.md)
- Check release notes: [RELEASE_NOTES_v2.7.5.md](RELEASE_NOTES_v2.7.5.md)

---

## 📂 Folder Structure (for reference)

Your extension folder should contain:
```
Email thread Notes/
├── manifest.json          ← Must be here!
├── src/
│   ├── background.js
│   ├── gmail-sidebar.js
│   ├── outlook-sidebar.js
│   ├── sidebar.html
│   ├── sidebar.js
│   └── milkdown-*.js
├── lib/                   ← Milkdown libraries
├── assets/icons/          ← Extension icons
└── TESTING_v2.7.5.md     ← Testing guide
```

---

## 🎯 What's New in v2.7.5?

1. ✅ **Side panel auto-closes** when leaving Gmail/Outlook
2. ✅ **Larger editor area** - click anywhere to focus
3. ✅ **Fast auto-save** - saves in 3 seconds (was 2 minutes!)

See [RELEASE_NOTES_v2.7.5.md](RELEASE_NOTES_v2.7.5.md) for details.

---

**Ready to test! 🎉**

Load the extension and try it out. Let me know what works and what needs improvement!
