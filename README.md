# Email Thread Notes - Chrome Extension

A privacy-focused Chrome extension that allows users to attach private, persistent notes to email threads in Gmail (with Outlook support coming in Phase 2).

## Phase 1 Status: ✅ COMPLETED

**Current Features (Gmail only):**
- ✅ Gmail thread detection
- ✅ Private notes storage (local only)
- ✅ Auto-save functionality
- ✅ Visual indicators for threads with notes
- ✅ Keyboard shortcuts (Ctrl/Cmd+Shift+N)
- ✅ Notes button in Gmail toolbar

## Installation (Development Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" button
4. Select the Email Thread Notes folder containing `manifest.json`
5. The extension should now appear in your extensions list

## Usage

### Gmail
1. Navigate to Gmail and open any email conversation
2. Click the "📝 Notes" button in Gmail's toolbar, or
3. Use keyboard shortcut: `Ctrl+Shift+N` (Windows) or `Cmd+Shift+N` (Mac)
4. Type your notes in the panel that appears
5. Notes auto-save after 1 second of inactivity
6. Close panel with the X button or by clicking outside

### Features
- **Auto-save**: Notes save automatically 1 second after you stop typing
- **Persistence**: Notes persist across browser sessions and Gmail navigation
- **Visual indicators**: Threads with notes show a small indicator
- **Privacy-first**: All data stored locally in your browser
- **Non-intrusive**: Panel appears only when needed

## File Structure

```
Email Thread Notes/
├── manifest.json              # Extension configuration
├── background.js              # Storage management and message handling
├── popup.html                 # Extension popup UI
├── popup.js                   # Popup functionality
├── content-scripts/
│   ├── gmail.js              # Gmail thread detection and UI
│   └── outlook.js            # Placeholder for Phase 2
├── styles/
│   ├── gmail.css             # Gmail-specific styling
│   └── outlook.css           # Placeholder for Phase 2
├── icons/                    # Extension icons (placeholder)
├── test.html                 # Development testing guide
└── README.md                 # This file
```

## Development Roadmap

### ✅ Phase 1: Gmail Foundation (COMPLETED)
- Basic Chrome extension structure
- Gmail thread detection
- Local storage implementation  
- Notes UI for Gmail
- Auto-save and visual indicators

### 🔄 Phase 2: Outlook Integration (Next)
- Outlook web thread detection
- Cross-platform storage consistency
- UI adaptations for Outlook

### 📋 Phase 3: Enhanced Features
- Advanced UI features (search, indicators)
- Data export/import functionality
- Settings and preferences

### ☁️ Phase 4: Cloud Storage Integration
- Optional cloud storage providers
- Platform-specific storage preferences
- Sync conflict resolution

### 🔧 Phase 5: Polish & Testing
- Comprehensive testing
- Performance optimization
- Documentation

## Technical Details

- **Manifest Version**: 3 (latest Chrome extension format)
- **Storage**: Chrome storage API (local storage)
- **Permissions**: `storage`, `activeTab`
- **Host Permissions**: Gmail and Outlook web domains
- **Browser Support**: Chrome 88+, Chromium-based Edge

## Privacy & Security

- All notes stored locally in your browser
- No data sent to external servers
- No tracking or analytics
- Privacy-first design philosophy

## Troubleshooting

- **Panel doesn't appear**: Check browser console for errors, ensure Gmail is fully loaded
- **Notes don't save**: Check extension permissions and storage quota
- **Button missing**: Try refreshing Gmail, button placement may vary with Gmail updates
- **Thread detection issues**: Try switching between conversations to trigger detection

## License

This project is developed as part of a Product Requirements Document implementation.