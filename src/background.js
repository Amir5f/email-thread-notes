// Background script for Email Thread Notes extension

class EmailNotesStorage {
  constructor() {
    this.storagePrefix = 'email_notes_';
    this.metadataKey = 'email_notes_metadata';
    // Chrome sync quotas
    this.QUOTA_BYTES_PER_ITEM = chrome.storage.sync.QUOTA_BYTES_PER_ITEM || 8192; // 8KB default
    this.MAX_ITEMS = chrome.storage.sync.MAX_ITEMS || 512;
    this.MAX_WRITE_OPERATIONS_PER_MINUTE = chrome.storage.sync.MAX_WRITE_OPERATIONS_PER_MINUTE || 120;
  }

  // Save a note for a specific thread
  async saveNote(threadId, content, platform = 'gmail', account = null, originalThreadId = null, subject = null, accountEmail = null, accountIndex = null) {
    try {
      console.log('Background: Saving note for threadId:', threadId, 'platform:', platform, 'account:', accountEmail || account, 'content length:', content.length);

      const storageKey = `${this.storagePrefix}${threadId}`;

      // Merge with the existing note so flags set elsewhere (pinned, archived,
      // importedAt, ...) and the original creation timestamp survive auto-saves.
      // Identity fields only overwrite when the caller actually provided them.
      const existingResult = await chrome.storage.sync.get([storageKey]);
      const existingNote = existingResult[storageKey] || {};

      const noteData = {
        ...existingNote,
        content: content,
        timestamp: existingNote.timestamp || Date.now(),
        platform: platform || existingNote.platform,
        threadId: threadId,
        account: account ?? existingNote.account ?? null,
        accountEmail: accountEmail ?? existingNote.accountEmail ?? null,
        accountIndex: accountIndex ?? existingNote.accountIndex ?? null,
        originalThreadId: originalThreadId ?? existingNote.originalThreadId ?? null,
        subject: subject ?? existingNote.subject ?? null,
        lastModified: Date.now()
      };
      console.log('Background: Using storage key:', storageKey);

      // Check quota before saving
      const noteSize = new Blob([JSON.stringify(noteData)]).size;
      if (noteSize > this.QUOTA_BYTES_PER_ITEM) {
        console.warn('Background: Note size exceeds Chrome sync quota:', noteSize, 'bytes');
        return {
          success: false,
          error: `Note too large (${Math.round(noteSize/1024)}KB). Chrome sync limit is ${Math.round(this.QUOTA_BYTES_PER_ITEM/1024)}KB per note.`,
          quotaExceeded: true
        };
      }

      // Save the note using chrome.storage.sync for automatic cross-device sync
      await chrome.storage.sync.set({
        [storageKey]: noteData
      });

      console.log('Background: Note saved successfully to sync storage for threadId:', threadId);

      // Update metadata
      await this.updateMetadata(threadId, noteData);

      return { success: true, noteData };
    } catch (error) {
      console.error('Background: Error saving note for threadId:', threadId, error);
      return { success: false, error: error.message };
    }
  }

  // Get a note for a specific thread
  async getNote(threadId) {
    try {
      const storageKey = `${this.storagePrefix}${threadId}`;
      console.log('Background: Getting note for threadId:', threadId, 'using key:', storageKey);

      const result = await chrome.storage.sync.get([storageKey]);
      const note = result[storageKey] || null;

      console.log('Background: Retrieved note for threadId:', threadId, ':', note);
      console.log('Background: Raw result object:', result);

      return note;
    } catch (error) {
      console.error('Background: Error getting note for threadId:', threadId, error);
      return null;
    }
  }

  // Delete a note
  async deleteNote(threadId) {
    try {
      console.log('Background: Deleting note for threadId:', threadId);

      const storageKey = `${this.storagePrefix}${threadId}`;

      // Check if note exists before deleting
      const result = await chrome.storage.sync.get([storageKey]);
      const noteExists = result[storageKey] !== undefined;

      if (noteExists) {
        await chrome.storage.sync.remove([storageKey]);
        console.log('Background: Note deleted successfully for threadId:', threadId);

        // Update metadata
        await this.removeFromMetadata(threadId);

        return { success: true, existed: true };
      } else {
        console.log('Background: Note not found for threadId:', threadId);
        return { success: true, existed: false, message: 'Note not found' };
      }
    } catch (error) {
      console.error('Background: Error deleting note for threadId:', threadId, error);
      return { success: false, error: error.message };
    }
  }

  // Update flag fields only (pinned, archived, lastEmailSeen). Deliberately leaves
  // lastModified and timestamp untouched to preserve date-based sorts.
  async updateNoteFields(threadId, fields) {
    try {
      console.log('Background: Updating note fields for threadId:', threadId);

      const storageKey = `${this.storagePrefix}${threadId}`;

      // Read the existing note
      const result = await chrome.storage.sync.get([storageKey]);
      const existingNote = result[storageKey];

      if (!existingNote) {
        return { success: false, error: 'Note not found' };
      }

      // Whitelist-merge only pinned, archived, lastEmailSeen
      if ('pinned' in fields) {
        existingNote.pinned = fields.pinned;
      }
      if ('archived' in fields) {
        existingNote.archived = fields.archived;
      }
      if ('lastEmailSeen' in fields) {
        existingNote.lastEmailSeen = fields.lastEmailSeen;
      }

      // Write the merged note back
      await chrome.storage.sync.set({
        [storageKey]: existingNote
      });

      console.log('Background: Note fields updated successfully for threadId:', threadId);

      return { success: true, noteData: existingNote };
    } catch (error) {
      console.error('Background: Error updating note fields for threadId:', threadId, error);
      return { success: false, error: error.message };
    }
  }

  // Get all notes
  async getAllNotes() {
    try {
      const allData = await chrome.storage.sync.get(null);
      const notes = {};

      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(this.storagePrefix) && key !== this.metadataKey) {
          const threadId = key.replace(this.storagePrefix, '');
          notes[threadId] = value;
        }
      }

      return notes;
    } catch (error) {
      console.error('Error getting all notes:', error);
      return {};
    }
  }

  // Update metadata for tracking
  async updateMetadata(threadId, noteData) {
    try {
      const metadata = await this.getMetadata();
      metadata.notes[threadId] = {
        platform: noteData.platform,
        account: noteData.account,
        accountEmail: noteData.accountEmail,
        accountIndex: noteData.accountIndex,
        originalThreadId: noteData.originalThreadId,
        lastModified: noteData.lastModified,
        created: metadata.notes[threadId]?.created || noteData.timestamp
      };
      metadata.totalNotes = Object.keys(metadata.notes).length;
      metadata.lastUpdated = Date.now();

      await chrome.storage.sync.set({
        [this.metadataKey]: metadata
      });
    } catch (error) {
      console.error('Error updating metadata:', error);
    }
  }

  // Remove from metadata
  async removeFromMetadata(threadId) {
    try {
      const metadata = await this.getMetadata();
      delete metadata.notes[threadId];
      metadata.totalNotes = Object.keys(metadata.notes).length;
      metadata.lastUpdated = Date.now();

      await chrome.storage.sync.set({
        [this.metadataKey]: metadata
      });
    } catch (error) {
      console.error('Error removing from metadata:', error);
    }
  }

  // Get metadata
  async getMetadata() {
    try {
      const result = await chrome.storage.sync.get([this.metadataKey]);
      return result[this.metadataKey] || {
        version: '1.0.0',
        notes: {},
        totalNotes: 0,
        created: Date.now(),
        lastUpdated: Date.now()
      };
    } catch (error) {
      console.error('Error getting metadata:', error);
      return {
        version: '1.0.0',
        notes: {},
        totalNotes: 0,
        created: Date.now(),
        lastUpdated: Date.now()
      };
    }
  }

  // Check storage usage
  async getStorageUsage() {
    try {
      const usage = await chrome.storage.sync.getBytesInUse();
      const quota = chrome.storage.sync.QUOTA_BYTES || 102400; // 100KB default
      return {
        used: usage,
        quota: quota,
        percentage: (usage / quota) * 100,
        available: quota - usage
      };
    } catch (error) {
      console.error('Error getting storage usage:', error);
      return null;
    }
  }

  // Get or create a persistent device identifier (used for backup provenance)
  async getDeviceId() {
    try {
      const result = await chrome.storage.local.get(['deviceId']);
      if (result.deviceId) return result.deviceId;

      const deviceId = crypto.randomUUID();
      await chrome.storage.local.set({ deviceId });
      return deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return 'unknown-device';
    }
  }

  // Export all notes to a backup file
  async exportNotes() {
    try {
      console.log('Background: Starting notes export');
      
      const allNotes = await this.getAllNotes();
      const metadata = await this.getMetadata();
      const timestamp = new Date().toISOString();
      
      const backupData = {
        version: '2.0.0',
        createdDate: timestamp,
        deviceId: await this.getDeviceId(),
        metadata: metadata,
        notes: allNotes,
        totalNotes: Object.keys(allNotes).length
      };
      
      const jsonString = JSON.stringify(backupData, null, 2);
      
      // Generate filename with timestamp
      const dateStr = new Date().toISOString().split('T')[0];
      const timeStr = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
      const filename = `email-notes-backup-${dateStr}-${timeStr}.json`;
      
      // Convert to data URL for download (works in service workers)
      const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonString)));
      
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        saveAs: true // Let user choose location
      });
      
      console.log('Background: Export initiated with download ID:', downloadId);
      
      return { 
        success: true, 
        downloadId: downloadId, 
        filename: filename,
        notesCount: Object.keys(allNotes).length
      };
    } catch (error) {
      console.error('Background: Error exporting notes:', error);
      return { success: false, error: error.message };
    }
  }

  // Import notes from a backup file
  async importNotes(fileContent, options = {}) {
    try {
      console.log('Background: Starting notes import');
      
      let importData;
      try {
        importData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error('Invalid backup file format - not valid JSON');
      }
      
      // Validate backup file structure (unified format)
      if (!importData.notes || typeof importData.notes !== 'object') {
        throw new Error('Invalid backup file - notes data missing or corrupted');
      }
      
      if (!importData.version) {
        throw new Error('Invalid backup file - version information missing');
      }
      
      const { merge = false, overwrite = false } = options;
      let imported = 0;
      let skipped = 0;
      let errors = 0;
      
      // Import each note
      for (const [threadId, noteData] of Object.entries(importData.notes)) {
        try {
          const storageKey = `${this.storagePrefix}${threadId}`;
          
          if (!merge) {
            // Check if note already exists
            const existing = await chrome.storage.sync.get([storageKey]);
            if (existing[storageKey] && !overwrite) {
              skipped++;
              continue;
            }
          }
          
          // Validate note data structure
          if (!noteData.content || !noteData.threadId) {
            console.warn('Skipping invalid note data for thread:', threadId);
            errors++;
            continue;
          }
          
          // Restore the note with current timestamp for lastModified if importing
          const restoreData = {
            ...noteData,
            importedAt: Date.now(),
            originalBackupDate: importData.createdDate
          };
          
          await chrome.storage.sync.set({ [storageKey]: restoreData });
          imported++;
          
        } catch (noteError) {
          console.error('Error importing individual note:', threadId, noteError);
          errors++;
        }
      }
      
      // Update metadata
      if (imported > 0) {
        const currentMetadata = await this.getMetadata();
        currentMetadata.totalNotes = Object.keys(await this.getAllNotes()).length;
        currentMetadata.lastUpdated = Date.now();
        currentMetadata.lastImport = {
          date: Date.now(),
          importedNotes: imported,
          skippedNotes: skipped,
          errors: errors,
          sourceVersion: importData.version
        };
        
        await chrome.storage.sync.set({ [this.metadataKey]: currentMetadata });
      }
      
      console.log(`Background: Import completed - ${imported} imported, ${skipped} skipped, ${errors} errors`);
      
      return {
        success: true,
        imported: imported,
        skipped: skipped,
        errors: errors,
        totalInBackup: Object.keys(importData.notes).length
      };
      
    } catch (error) {
      console.error('Background: Error importing notes:', error);
      return { success: false, error: error.message };
    }
  }

}

// Initialize storage manager
const storageManager = new EmailNotesStorage();

chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Email Thread Notes extension installed/updated');

  // Set global side panel behavior - enable by default
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

  // Set default panel path globally (not per-tab)
  await chrome.sidePanel.setOptions({
    path: 'src/sidebar.html',
    enabled: true
  });

  console.log('Side panel configured globally');
});

// Handle extension icon click to open side panel
chrome.action.onClicked.addListener(async (tab) => {
  console.log('Extension icon clicked on tab:', tab.id, 'URL:', tab.url);

  // Explicitly open the side panel for this tab
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
    console.log('Side panel opened successfully');
  } catch (error) {
    console.error('Failed to open side panel:', error);
  }
});

// Listen for tab updates to manage sidebar visibility
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.url) {
    handleTabUrlChange(tabId, changeInfo.url);
  }
});

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url) {
      handleTabUrlChange(activeInfo.tabId, tab.url);
    }
  } catch (error) {
    console.log('Error getting tab info:', error);
  }
});

async function handleTabUrlChange(tabId, url) {
  const emailSitePattern = /mail\.google\.com|outlook\.(office365|office|live)\.com/;
  const isEmailSite = emailSitePattern.test(url);

  console.log('Tab URL changed:', url, '- Email site:', isEmailSite);

  // Don't use per-tab enable/disable - it breaks the click-to-open behavior
  // Instead, we'll just let the user manually close the panel on non-email sites
  // The panel will still only show useful data when on email sites
}

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  const handleAsync = async () => {
    try {
      switch (request.action) {
        case 'saveNote':
          const saveResult = await storageManager.saveNote(
            request.threadId,
            request.content,
            request.platform || 'gmail',
            request.account,
            request.originalThreadId,
            request.subject,
            request.accountEmail,
            request.accountIndex
          );
          sendResponse(saveResult);
          break;

        case 'getNote':
          const note = await storageManager.getNote(request.threadId);
          sendResponse({ note });
          break;

        case 'deleteNote':
          const deleteResult = await storageManager.deleteNote(request.threadId);
          sendResponse(deleteResult);
          break;

        case 'updateNoteFields':
          const updateResult = await storageManager.updateNoteFields(request.threadId, request.fields || {});
          sendResponse(updateResult);
          break;

        case 'getAllNotes':
          const allNotes = await storageManager.getAllNotes();
          sendResponse({ notes: allNotes });
          break;

        case 'getStorageUsage':
          const usage = await storageManager.getStorageUsage();
          sendResponse({ usage });
          break;

        case 'getMetadata':
          const metadata = await storageManager.getMetadata();
          sendResponse({ metadata });
          break;

        case 'exportNotes':
          const exportResult = await storageManager.exportNotes();
          sendResponse(exportResult);
          break;

        case 'importNotes':
          const importResult = await storageManager.importNotes(
            request.fileContent,
            request.options || {}
          );
          sendResponse(importResult);
          break;

        default:
          sendResponse({ success: false, error: 'Unknown action' });
      }
    } catch (error) {
      console.error('Background script error:', error);
      sendResponse({ success: false, error: error.message });
    }
  };

  handleAsync();
  return true; // Keep message channel open for async response
});

