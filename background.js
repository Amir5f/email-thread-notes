// Background script for Email Thread Notes extension

class EmailNotesStorage {
  constructor() {
    this.storagePrefix = 'email_notes_';
    this.metadataKey = 'email_notes_metadata';
  }

  // Save a note for a specific thread
  async saveNote(threadId, content, platform = 'gmail', account = null, originalThreadId = null, subject = null) {
    try {
      console.log('Background: Saving note for threadId:', threadId, 'platform:', platform, 'account:', account, 'content length:', content.length);
      
      const noteData = {
        content: content,
        timestamp: Date.now(),
        platform: platform,
        threadId: threadId,
        account: account,
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
      const storageKey = `${this.storagePrefix}${threadId}`;
      await chrome.storage.local.remove([storageKey]);
      
      // Update metadata
      await this.removeFromMetadata(threadId);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting note:', error);
      return { success: false, error: error.message };
    }
  }

  // Get all notes
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
            request.subject
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