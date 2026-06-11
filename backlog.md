# Backlog - Small Fixes & Non-Critical Issues

## Bugs
- **Hyperlink persistence**: Links created in editor disappear after save/reload - not persistent in storage *(likely fixed by markdown serialization rewrite in commit 9dc345f — pending user verification)*
- **RTL list formatting**: Numbering/bulleting overlaps with text when content is written in RTL (right-to-left) languages
- **All Notes view refresh issue**: When viewing a specific thread's note and switching to "All Notes", not all notes appear in the list until returning to inbox view

## Minor Improvements
- [To be added as discovered]

## Code Cleanup
- **Strip debug logging**: heavy console.log noise across sidebar.js and content scripts; privacy concern — gmail-sidebar.js regex-scans the whole page body for email addresses and logs them
- **background.js export**: replace deprecated `unescape()` (base64 encoding) with a TextEncoder-based approach
- **Unused metadata store**: `email_notes_metadata` is written on every save but never read by the UI — remove (saves sync write quota) or actually use it
- **Lint nits**: unused params flagged by diagnostics (background.js `details`/`tab`/`tabId`, sidebar.js `markdown` callback param)

## Future Features
- **FileSystem Access API integration**: Allow users to choose a specific cloud folder (iCloud, Google Drive, Dropbox) for manual backups without download UI animations or symlinks (cross-platform solution for advanced users)