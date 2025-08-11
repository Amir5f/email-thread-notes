// Background script for Email Thread Notes extension

class EmailNotesStorage {
  constructor() {
    this.storagePrefix = 'email_notes_';
    this.metadataKey = 'email_notes_metadata';
    this.debouncedBackupTimer = null;
    this.backupDebounceDelay = 10000; // 10 seconds
  }

  // Save a note for a specific thread
  async saveNote(threadId, content, platform = 'gmail', account = null, originalThreadId = null, subject = null, accountEmail = null, accountIndex = null) {
    try {
      console.log('Background: Saving note for threadId:', threadId, 'platform:', platform, 'account:', accountEmail || account, 'content length:', content.length);
      
      const noteData = {
        content: content,
        timestamp: Date.now(),
        platform: platform,
        threadId: threadId,
        account: account,
        accountEmail: accountEmail,
        accountIndex: accountIndex,
        originalThreadId: originalThreadId,
        subject: subject,
        lastModified: Date.now()
      };

      const storageKey = `${this.storagePrefix}${threadId}`;
      console.log('Background: Using storage key:', storageKey);
      
      // Save the note
      await chrome.storage.local.set({
        [storageKey]: noteData
      });

      console.log('Background: Note saved successfully for threadId:', threadId);

      // Update metadata
      await this.updateMetadata(threadId, noteData);

      // Note: Debounced backup will be triggered by the content script after auto-save
      // No immediate backup needed here to avoid duplicate downloads

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
      
      // DEBUG: Get ALL storage to see what's actually stored
      const allStorage = await chrome.storage.local.get(null);
      console.log('Background: ALL STORAGE CONTENTS:');
      Object.keys(allStorage).forEach(key => {
        if (key.startsWith(this.storagePrefix)) {
          console.log(`  ${key}: ${JSON.stringify(allStorage[key])}`);
        }
      });
      
      const result = await chrome.storage.local.get([storageKey]);
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
      const result = await chrome.storage.local.get([storageKey]);
      const noteExists = result[storageKey] !== undefined;
      
      if (noteExists) {
        await chrome.storage.local.remove([storageKey]);
        console.log('Background: Note deleted successfully for threadId:', threadId);
        
        // Update metadata
        await this.removeFromMetadata(threadId);
        
        // Trigger immediate backup for delete operations (important for data safety)
        await this.immediateBackup();
        
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

  // Get all notes (with data recovery from disk if Chrome storage is empty)
  async getAllNotes() {
    try {
      const allData = await chrome.storage.local.get(null);
      const notes = {};
      
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith(this.storagePrefix) && key !== this.metadataKey) {
          const threadId = key.replace(this.storagePrefix, '');
          notes[threadId] = value;
        }
      }
      
      // If no notes found in Chrome storage, attempt data recovery from disk
      if (Object.keys(notes).length === 0) {
        console.log('No notes found in Chrome storage, attempting data recovery from disk');
        await this.attemptDataRecovery();
        
        // Try again after recovery attempt
        const recoveredData = await chrome.storage.local.get(null);
        for (const [key, value] of Object.entries(recoveredData)) {
          if (key.startsWith(this.storagePrefix) && key !== this.metadataKey) {
            const threadId = key.replace(this.storagePrefix, '');
            notes[threadId] = value;
          }
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

      await chrome.storage.local.set({
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

      await chrome.storage.local.set({
        [this.metadataKey]: metadata
      });
    } catch (error) {
      console.error('Error removing from metadata:', error);
    }
  }

  // Get metadata
  async getMetadata() {
    try {
      const result = await chrome.storage.local.get([this.metadataKey]);
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
      const usage = await chrome.storage.local.getBytesInUse();
      const quota = chrome.storage.local.QUOTA_BYTES || 5242880; // 5MB default
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
            const existing = await chrome.storage.local.get([storageKey]);
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
          
          await chrome.storage.local.set({ [storageKey]: restoreData });
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
        
        await chrome.storage.local.set({ [this.metadataKey]: currentMetadata });
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

  // Get backup settings
  async getBackupSettings() {
    try {
      const result = await chrome.storage.local.get(['backupSettings']);
      return result.backupSettings || {
        autoBackupEnabled: false,
        autoBackupFrequency: 'weekly', // daily, weekly, monthly
        lastAutoBackup: null,
        backupLocation: 'downloads', // downloads, gdrive, icloud
        includeMetadata: true
      };
    } catch (error) {
      console.error('Error getting backup settings:', error);
      return null;
    }
  }

  // Save backup settings
  async saveBackupSettings(settings) {
    try {
      await chrome.storage.local.set({ backupSettings: settings });
      return { success: true };
    } catch (error) {
      console.error('Error saving backup settings:', error);
      return { success: false, error: error.message };
    }
  }

  // Auto-sync functionality
  async enableAutoSync(frequencyMinutes = 5) {
    try {
      console.log('Background: Enabling auto-sync with frequency:', frequencyMinutes, 'minutes');
      
      // Clear any existing sync timer
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
      }
      
      // Create sync file immediately
      await this.createSyncFile();
      
      // Set up periodic sync
      this.syncTimer = setInterval(async () => {
        await this.performAutoSync();
      }, frequencyMinutes * 60 * 1000);
      
      // Save sync settings
      const syncSettings = {
        enabled: true,
        frequency: frequencyMinutes,
        lastSync: Date.now(),
        syncFileName: 'email-notes-sync.json'
      };
      
      await chrome.storage.local.set({ syncSettings });
      
      return { success: true, message: 'Auto-sync enabled' };
    } catch (error) {
      console.error('Error enabling auto-sync:', error);
      return { success: false, error: error.message };
    }
  }

  async disableAutoSync() {
    try {
      console.log('Background: Disabling auto-sync');
      
      if (this.syncTimer) {
        clearInterval(this.syncTimer);
        this.syncTimer = null;
      }
      
      const syncSettings = {
        enabled: false,
        frequency: 5,
        lastSync: null,
        syncFileName: 'email-notes-sync.json'
      };
      
      await chrome.storage.local.set({ syncSettings });
      
      return { success: true, message: 'Auto-sync disabled' };
    } catch (error) {
      console.error('Error disabling auto-sync:', error);
      return { success: false, error: error.message };
    }
  }

  async createSyncFile() {
    try {
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
      
      // Convert to data URL for download (works in service workers)
      const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonString)));
      
      // Create file in EmailNotes subfolder for symlink compatibility
      const filename = 'EmailNotes/EmailNotes/email-notes-sync.json';
      
      // Download to user's configured subfolder in Downloads
      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: filename,
        conflictAction: 'overwrite', // Always overwrite the sync file
        saveAs: false // Don't prompt user, use default Downloads location
      });
      
      console.log('Background: Sync file created with download ID:', downloadId);
      
      // Update last sync time
      const currentSyncSettings = await this.getSyncSettings();
      currentSyncSettings.lastSync = Date.now();
      await chrome.storage.local.set({ syncSettings: currentSyncSettings });
      
      return { success: true, downloadId };
    } catch (error) {
      console.error('Error creating sync file:', error);
      return { success: false, error: error.message };
    }
  }

  async performAutoSync() {
    try {
      console.log('Background: Performing auto-sync');
      
      // TODO: Check if sync file was modified externally and import changes
      // For now, just export current state
      await this.createSyncFile();
      
      return { success: true };
    } catch (error) {
      console.error('Error during auto-sync:', error);
      return { success: false, error: error.message };
    }
  }

  async getSyncSettings() {
    try {
      const result = await chrome.storage.local.get(['syncSettings']);
      return result.syncSettings || {
        enabled: false,
        frequency: 5,
        lastSync: null,
        syncFileName: 'email-notes-sync.json',
        syncFolder: 'EmailNotes'
      };
    } catch (error) {
      console.error('Error getting sync settings:', error);
      return { enabled: false, frequency: 5, lastSync: null, syncFileName: 'email-notes-sync.json', syncFolder: 'EmailNotes' };
    }
  }

  async getDeviceId() {
    try {
      let result = await chrome.storage.local.get(['deviceId']);
      if (!result.deviceId) {
        // Generate a unique device ID
        const deviceId = 'device_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        await chrome.storage.local.set({ deviceId });
        return deviceId;
      }
      return result.deviceId;
    } catch (error) {
      console.error('Error getting device ID:', error);
      return 'unknown_device';
    }
  }

  // Debounced backup to disk - triggers after user stops typing for 2 seconds
  triggerDebouncedBackup() {
    // Clear existing timer
    if (this.debouncedBackupTimer) {
      clearTimeout(this.debouncedBackupTimer);
    }

    // Set new timer for debounced backup
    this.debouncedBackupTimer = setTimeout(async () => {
      try {
        console.log('Background: Performing debounced backup to disk');
        await this.createSyncFile();
      } catch (error) {
        console.error('Error during debounced backup:', error);
      }
    }, this.backupDebounceDelay);
  }

  // Immediate backup to disk - for save/delete operations
  async immediateBackup() {
    try {
      console.log('Background: Performing immediate backup to disk');
      return await this.createSyncFile();
    } catch (error) {
      console.error('Error during immediate backup:', error);
      return { success: false, error: error.message };
    }
  }

  // Attempt to recover data from sync file if Chrome storage is empty
  async attemptDataRecovery() {
    try {
      console.log('Background: Attempting data recovery from sync file');
      
      // Try to read the sync file by simulating a file picker dialog
      // Since we can't directly read files from disk in a service worker,
      // we'll check if there's a sync file and ask user to import it
      
      // For now, we'll just log that recovery should happen
      // In a real scenario, this would trigger a notification to the user
      console.log('Background: Data recovery requires user action - import sync file manually');
      
      // Check if we have any backup settings that indicate where the file might be
      const syncSettings = await this.getSyncSettings();
      if (syncSettings.lastSync) {
        console.log('Background: Last sync was at:', new Date(syncSettings.lastSync));
        console.log('Background: Sync file should be at: Downloads/EmailNotes/EmailNotes/email-notes-sync.json');
      }
      
      return { 
        success: false, 
        requiresUserAction: true, 
        message: 'Data recovery requires manually importing the sync file from Downloads/EmailNotes/EmailNotes/email-notes-sync.json'
      };
      
    } catch (error) {
      console.error('Error during data recovery attempt:', error);
      return { success: false, error: error.message };
    }
  }
}

// Initialize storage manager
const storageManager = new EmailNotesStorage();

chrome.runtime.onInstalled.addListener(() => {
  console.log('Email Thread Notes extension installed');
});

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

        case 'getBackupSettings':
          const backupSettings = await storageManager.getBackupSettings();
          sendResponse({ settings: backupSettings });
          break;

        case 'saveBackupSettings':
          const saveSettingsResult = await storageManager.saveBackupSettings(request.settings);
          sendResponse(saveSettingsResult);
          break;

        case 'enableAutoSync':
          const enableSyncResult = await storageManager.enableAutoSync(request.frequency);
          sendResponse(enableSyncResult);
          break;

        case 'disableAutoSync':
          const disableSyncResult = await storageManager.disableAutoSync();
          sendResponse(disableSyncResult);
          break;

        case 'getSyncSettings':
          const syncSettings = await storageManager.getSyncSettings();
          sendResponse({ settings: syncSettings });
          break;

        case 'createSyncFile':
          const createSyncResult = await storageManager.createSyncFile();
          sendResponse(createSyncResult);
          break;

        case 'triggerImmediateSync':
          const immediateSyncResult = await storageManager.performAutoSync();
          if (immediateSyncResult.success) {
            sendResponse({ success: true, message: 'Sync completed successfully' });
          } else {
            sendResponse({ success: false, error: immediateSyncResult.error || 'Sync failed' });
          }
          break;

        case 'triggerDebouncedBackup':
          storageManager.triggerDebouncedBackup();
          sendResponse({ success: true, message: 'Debounced backup scheduled' });
          break;

        case 'immediateBackup':
          const backupResult = await storageManager.immediateBackup();
          sendResponse(backupResult);
          break;

        case 'attemptDataRecovery':
          const recoveryResult = await storageManager.attemptDataRecovery();
          sendResponse(recoveryResult);
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