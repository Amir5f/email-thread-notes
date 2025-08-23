# Email Thread Notes - Chrome Extension

A privacy-focused Chrome extension that allows users to attach private, persistent notes to email threads in Gmail using Chrome's Side Panel API.

## ✨ Features

- **Gmail Integration**: Add private notes to Gmail conversations (conversation view only)
- **Side Panel Interface**: Clean, persistent sidebar that doesn't interfere with Gmail
- **Privacy-First**: All data stored locally in your browser
- **Auto-Save**: Notes automatically save as you type
- **Thread Detection**: Automatically identifies email conversations
- **Cross-Session Persistence**: Notes persist across browser restarts

## Installation (Development Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked" button
4. Select the Email Thread Notes folder containing `manifest.json`
5. The extension should now appear in your extensions list

## Usage

1. **Open Gmail** and navigate to any email conversation (conversation view)
2. **Open Side Panel**: Click the Chrome extension icon or use the side panel
3. **Add Notes**: Type your notes in the text area - they save automatically
4. **Switch Conversations**: Notes are automatically associated with each thread

### ⚠️ Current Limitations
- **Gmail Only**: Works in Gmail conversation view (reading pane not supported)
- **Outlook**: Experimental support - may be unreliable
- **Thread Detection**: Requires full conversation view to properly identify threads

## Project Structure

See [STRUCTURE.md](STRUCTURE.md) for detailed project organization and architecture documentation.

## Technical Details

- **Architecture**: Chrome Side Panel API with content scripts for thread detection
- **Manifest Version**: 3
- **Storage**: Chrome storage API (local storage)
- **Permissions**: `storage`, `activeTab`, `scripting`, `sidePanel`
- **Host Permissions**: Gmail and Outlook web domains
- **Browser Support**: Chrome 88+, Chromium-based Edge

## Privacy & Security

- All notes stored locally in your browser
- No data sent to external servers
- No tracking or analytics
- Privacy-first design philosophy

### Optional Cloud Sync

For syncing notes across devices, see [CLOUD_SYNC_SETUP.md](CLOUD_SYNC_SETUP.md) for instructions on setting up iCloud Drive or other cloud storage integration.

## Troubleshooting

- **Side panel doesn't open**: Ensure extension is enabled and Gmail is fully loaded
- **Notes don't save**: Check extension permissions and storage quota
- **Thread detection issues**: Make sure you're in Gmail conversation view (not reading pane)
- **Outlook issues**: Outlook support is experimental... 

## License

MIT License - see LICENSE file for details.