# Cloud Sync Setup Instructions

Your Email Thread Notes are automatically saved to `Downloads/EmailNotes/EmailNotes/email-notes-sync.json`. To sync this file across your devices using cloud storage, follow these simple steps:

## Option 1: iCloud Drive Sync

Run this command in Terminal to sync your notes via iCloud:

```bash
# Create EmailNotes folder in iCloud Drive
mkdir -p ~/Library/Mobile\ Documents/com~apple~CloudDocs/EmailNotes/EmailNotes

# Remove local folder if it exists
rm -rf ~/Downloads/EmailNotes

# Create symlink from Downloads to iCloud
ln -s ~/Library/Mobile\ Documents/com~apple~CloudDocs/EmailNotes ~/Downloads/EmailNotes

# Verify setup
ls -la ~/Downloads/EmailNotes
```

## Option 2: Google Drive Sync

Run this command in Terminal to sync your notes via Google Drive:

```bash
# Create EmailNotes folder in Google Drive
mkdir -p ~/Google\ Drive/EmailNotes/EmailNotes

# Remove local folder if it exists
rm -rf ~/Downloads/EmailNotes

# Create symlink from Downloads to Google Drive
ln -s ~/Google\ Drive/EmailNotes ~/Downloads/EmailNotes

# Verify setup
ls -la ~/Downloads/EmailNotes
```

## What This Does

- **Creates a symbolic link** between your Downloads folder and your cloud storage
- **Automatically syncs** your notes across all devices with the same cloud account
- **Works transparently** - the extension continues saving to Downloads/EmailNotes/ as usual
- **Cross-device access** - your notes appear on all computers with this setup

## Verification

After setup, when you save a note:
1. Check that `email-notes-sync.json` appears in your cloud folder
2. On another device, the file should sync automatically
3. Import the file on the other device if needed

## Troubleshooting

- **Permission denied**: Run commands with `sudo` if needed
- **Cloud folder not found**: Make sure your cloud service is properly set up
- **Symlink issues**: Remove and recreate the symlink if problems occur

## Security Note

Your notes remain private and are only stored in your personal cloud storage. No data is sent to external servers.