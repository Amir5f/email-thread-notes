# Cleanup Scripts

One-time utility scripts for maintenance and debugging.

## Clean Up Empty Notes

This script removes all notes with empty or whitespace-only content. This was needed as a one-time cleanup after fixing a bug where empty notes were being saved.

**When to use:** If you notice empty notes appearing in storage (e.g., notes with no content that shouldn't exist).

**How to run:**

1. Open Chrome and go to `chrome://extensions`
2. Enable "Developer mode" (top right toggle)
3. Find "Email Thread Notes" extension
4. Click "service worker" (or "Inspect views: service worker")
5. In the DevTools console that opens, paste the script below and press Enter

```javascript
// Cleanup script: Remove all empty notes
(async () => {
  const allData = await chrome.storage.sync.get(null);
  const prefix = 'email_thread_note_';
  const metadataKey = 'email_notes_metadata';
  let deleted = 0;
  let kept = 0;

  console.log('Starting cleanup of empty notes...');

  for (const [key, value] of Object.entries(allData)) {
    if (key.startsWith(prefix) && key !== metadataKey) {
      if (!value || !value.content || value.content.trim().length === 0) {
        await chrome.storage.sync.remove(key);
        console.log('❌ Deleted empty note:', key);
        deleted++;
      } else {
        kept++;
      }
    }
  }

  console.log(`✅ Cleanup complete!`);
  console.log(`   ${deleted} empty notes deleted`);
  console.log(`   ${kept} notes with content kept`);
})();
```

**Expected output:**
```
Starting cleanup of empty notes...
❌ Deleted empty note: email_thread_note_gmail_account_0_abc123
❌ Deleted empty note: email_thread_note_gmail_account_0_xyz789
✅ Cleanup complete!
   2 empty notes deleted
   15 notes with content kept
```

---

## View All Notes

Diagnostic script to view all stored notes and their content lengths.

```javascript
// Diagnostic script: List all notes
(async () => {
  const allData = await chrome.storage.sync.get(null);
  const prefix = 'email_thread_note_';
  const metadataKey = 'email_notes_metadata';

  console.log('=== ALL STORED NOTES ===\n');

  for (const [key, value] of Object.entries(allData)) {
    if (key.startsWith(prefix) && key !== metadataKey) {
      const threadId = key.replace(prefix, '');
      const contentLength = value?.content?.length || 0;
      const isEmpty = !value || !value.content || value.content.trim().length === 0;
      const status = isEmpty ? '⚠️ EMPTY' : '✓';

      console.log(`${status} ${threadId}`);
      console.log(`   Platform: ${value?.platform || 'unknown'}`);
      console.log(`   Subject: ${value?.subject || 'No subject'}`);
      console.log(`   Content length: ${contentLength} chars`);
      console.log(`   Last modified: ${value?.lastModified ? new Date(value.lastModified).toLocaleString() : 'unknown'}`);
      console.log('');
    }
  }
})();
```
