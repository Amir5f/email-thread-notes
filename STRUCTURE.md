# Email Thread Notes - Project Structure

## 📁 Organized File Structure

```
Email Thread Notes/
├── 📄 manifest.json              # Chrome extension manifest (Manifest V3)
├── 📄 STRUCTURE.md               # This file - project structure documentation
├── 📄 README.md                  # Main project documentation
├── 📄 email_thread_notes_prd.md  # Product Requirements Document
├── 📄 todos.md                   # Development todos and milestones
├── 📄 CLAUDE.local.md             # Local Claude instructions
├── 📄 CLOUD_SYNC_SETUP.md        # Cloud sync setup guide
├── 📄 SIDEBAR_TESTING.md         # Testing documentation
│
├── 📂 src/                       # 🎯 MAIN SOURCE CODE
│   ├── background.js             # Service worker (background script)
│   ├── sidebar.html              # Side Panel UI (main interface)
│   ├── sidebar.js                # Side Panel functionality
│   ├── gmail-sidebar.js          # Gmail content script (thread detection)
│   └── outlook-sidebar.js        # Outlook content script (thread detection)
│
├── 📂 lib/                       # 📚 EXTERNAL LIBRARIES
│   ├── quill.min.js              # Rich text editor (~400KB)
│   ├── quill.core.css            # Quill core styles
│   └── quill.snow.css            # Quill Snow theme styles
│
├── 📂 assets/                    # 🎨 STATIC RESOURCES
│   └── icons/                    # Extension icons (64x64, 48x48, 128x128)
│
```

## 🏗️ Architecture Overview

### **Current Architecture (v2.1+)**: Chrome Side Panel API
- **Clean separation**: Content scripts only detect threads, UI lives in Side Panel
- **Modern approach**: Uses Chrome Side Panel API for better UX
- **Simplified**: No DOM injection, no overlay complexity

### **File Relationships**:
```
manifest.json
├── src/background.js           (service worker)
├── src/sidebar.html            (main UI)
│   ├── ../lib/quill.min.js         (rich text editor)
│   ├── ../lib/quill.core.css       (editor styles)
│   ├── ../lib/quill.snow.css       (theme styles)
│   └── sidebar.js              (UI logic)
├── src/gmail-sidebar.js        (Gmail thread detection)
└── src/outlook-sidebar.js      (Outlook thread detection)
```

## 🎯 Key Design Principles

1. **Separation of Concerns**
   - Content scripts: Thread detection only
   - Side Panel: All UI and user interaction
   - Background: Data storage and sync

2. **Security First**
   - Local libraries (no CDN dependencies)
   - Strict Content Security Policy
   - Trusted rich text editor (Quill.js)

3. **Performance Optimized**
   - Minimal content script footprint
   - Rich text editing with Quill.js
   - Efficient DOM manipulation

4. **Maintainable Structure**
   - Clear file organization
   - Documented architecture
   - Modern Chrome extension patterns

## 📝 Development Notes

- **Active development**: `src/` directory
- **Dependencies**: `lib/` directory (local copies)
- **Resources**: `assets/` directory

## 🔄 Chrome Side Panel Architecture

The current implementation uses:
- Chrome's native Side Panel API
- Content scripts for thread detection only
- Rich text editing with Quill.js
- Clean separation between UI and detection logic