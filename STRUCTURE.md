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
│   ├── snarkdown.min.js          # Markdown parser (~1KB)
│   └── dompurify.min.js          # XSS sanitizer (~21KB)
│
├── 📂 assets/                    # 🎨 STATIC RESOURCES
│   ├── icons/                    # Extension icons (64x64, 48x48, 128x128)
│   └── styles/                   # CSS files (gmail.css, outlook.css)
│
└── 📂 archive/                   # 🗄️ ARCHIVED CODE
    ├── overlay-approach/         # Old overlay implementation (v1.x)
    │   ├── background.js         # Old background script
    │   ├── gmail.js              # Old Gmail overlay implementation
    │   ├── outlook.js            # Old Outlook overlay implementation
    │   ├── gmail-simple.js       # Simple Gmail implementation
    │   ├── popup.html/js         # Old popup interface
    │   └── manifest-overlay.json # Old Manifest V3 configuration
    └── test.html                 # Testing file
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
│   ├── ../lib/snarkdown.min.js     (markdown parsing)
│   ├── ../lib/dompurify.min.js     (XSS protection)
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
   - DOMPurify for safe HTML rendering

3. **Performance Optimized**
   - Minimal content script footprint
   - Lightweight libraries (Snarkdown ~1KB)
   - Efficient DOM manipulation

4. **Maintainable Structure**
   - Clear file organization
   - Archived legacy code
   - Documented architecture

## 📝 Development Notes

- **Active development**: `src/` directory
- **Dependencies**: `lib/` directory (local copies)
- **Resources**: `assets/` directory
- **Legacy code**: `archive/` directory (preserved for reference)

## 🔄 Migration from Overlay Architecture

The overlay approach (archived) used:
- Direct DOM injection into Gmail/Outlook
- Complex positioning and styling
- Multiple content scripts with UI logic

The current Side Panel approach:
- Uses Chrome's native Side Panel API
- Cleaner content scripts (detection only)
- Better user experience and maintainability