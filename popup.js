// Popup script for Email Thread Notes extension
document.addEventListener('DOMContentLoaded', async () => {
  const statusElement = document.getElementById('status');
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statsElement = document.getElementById('stats');
  const notesListElement = document.getElementById('notesList');
  const platformInfoElement = document.getElementById('platformInfo');
  
  let currentPlatform = null;
  let currentAccount = null;
  
  // Initialize popup
  await initializePopup();
  
  async function initializePopup() {
    try {
      // Get active tab and check platform
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Add timeout to prevent hanging
      await Promise.race([
        checkPlatformStatus(tab),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Platform check timeout')), 3000))
      ]).catch(error => {
        console.warn('Platform check failed:', error);
        // Continue with basic setup
        statusElement.textContent = 'Platform detection failed';
        statusElement.className = 'status inactive';
      });
      
      // Load extension state
      await loadExtensionState();
      
      // Load statistics
      await Promise.race([
        loadStatistics(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Statistics timeout')), 2000))
      ]).catch(error => {
        console.warn('Statistics loading failed:', error);
        statsElement.textContent = 'Stats unavailable';
      });
      
      // Setup event listeners
      await setupEventListeners();
      
      // Load notes list only when on supported email platform
      if (currentPlatform) {
        await Promise.race([
          loadNotesList(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Notes list timeout')), 2000))
        ]).catch(error => {
          console.warn('Notes list loading failed:', error);
        });
      }
      
    } catch (error) {
      console.error('Error initializing popup:', error);
      statusElement.textContent = 'Extension loaded with errors';
      statusElement.className = 'status inactive';
    }
  }
  
  async function checkPlatformStatus(tab) {
    if (tab.url.includes('mail.google.com')) {
      currentPlatform = 'gmail';
      currentAccount = await detectGmailAccount(tab.url);
      
      if (currentAccount && currentAccount.includes('@')) {
        statusElement.textContent = 'Active on Gmail';
        platformInfoElement.textContent = `Extension is active for: ${currentAccount}`;
      } else {
        statusElement.textContent = `Active on Gmail${currentAccount ? ` (${currentAccount})` : ''}`;
        platformInfoElement.textContent = 'Extension is active on this Gmail account.';
      }
      statusElement.className = 'status active';
      
    } else if (tab.url.includes('outlook.office365.com') || tab.url.includes('outlook.live.com')) {
      currentPlatform = 'outlook';
      currentAccount = await detectOutlookAccount(tab.url);
      statusElement.textContent = `Active on Outlook${currentAccount ? ` (${currentAccount})` : ''}`;
      statusElement.className = 'status active';
      platformInfoElement.textContent = 'Extension is active on this Outlook account.';
    } else {
      currentPlatform = null;
      currentAccount = null;
      statusElement.textContent = 'Not on supported email platform';
      statusElement.className = 'status inactive';
      platformInfoElement.textContent = 'Navigate to Gmail or Outlook to use notes on conversations.';
    }
  }
  
  async function detectGmailAccount(url) {
    // Simplified Gmail account detection - just use URL for now
    try {
      const match = url.match(/mail\.google\.com\/mail\/u\/(\d+)/);
      const accountIndex = match ? match[1] : '0';
      
      // Return simple account name - don't try complex email detection that can hang
      return `Gmail Account ${parseInt(accountIndex) + 1}`;
    } catch (error) {
      console.error('Error detecting Gmail account:', error);
      return 'Gmail Account';
    }
  }
  
  async function detectOutlookAccount(url) {
    // Try to detect Outlook account from URL
    try {
      const match = url.match(/outlook\.office365\.com\/mail\/([^\/]+)/);
      const accountId = match ? match[1] : 'default';
      
      // Return simple account identifier for now
      return `Outlook Account (${accountId})`;
    } catch (error) {
      console.error('Error detecting Outlook account:', error);
      return 'Outlook Account';
    }
  }
  
  async function loadExtensionState() {
    try {
      const result = await chrome.storage.local.get(['extensionEnabled']);
      const isEnabled = result.extensionEnabled !== false; // Default to enabled
      
      toggleSwitch.classList.toggle('enabled', isEnabled);
    } catch (error) {
      console.error('Error loading extension state:', error);
    }
  }
  
  async function loadStatistics() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getMetadata' });
      const allNotesResponse = await chrome.runtime.sendMessage({ action: 'getAllNotes' });
      
      if (response.metadata && allNotesResponse.notes) {
        const metadata = response.metadata;
        const allNotes = allNotesResponse.notes;
        
        // Filter notes by current account/platform if available
        const filteredNotes = filterNotesByAccount(allNotes);
        const noteCount = Object.keys(filteredNotes).length;
        
        let accountDisplay = '';
        if (currentAccount) {
          if (currentAccount.includes('@')) {
            accountDisplay = `<div>👤 ${currentAccount}</div>`;
          } else {
            accountDisplay = `<div>👤 Account: ${currentAccount}</div>`;
          }
        }
        
        statsElement.innerHTML = `
          <div>📝 ${noteCount} notes saved</div>
          <div>🌐 Platform: ${currentPlatform || 'All'}</div>
          ${accountDisplay}
        `;
      }
    } catch (error) {
      console.error('Error loading statistics:', error);
      statsElement.textContent = 'Error loading statistics';
    }
  }
  
  function filterNotesByAccount(notes) {
    // If we're on a specific platform/account, filter notes accordingly
    if (!currentPlatform || !currentAccount) return notes;
    
    const filtered = {};
    for (const [threadId, noteData] of Object.entries(notes)) {
      // Filter by platform first
      if (noteData.platform === currentPlatform) {
        // Then filter by account - check if the threadId starts with current account
        if (threadId.startsWith(`${currentAccount}_`)) {
          filtered[threadId] = noteData;
        }
        // Also check if the noteData has account info that matches
        else if (noteData.account === currentAccount || noteData.accountEmail === currentAccount) {
          filtered[threadId] = noteData;
        }
      }
    }
    return filtered;
  }
  
  async function loadNotesList() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllNotes' });
      
      if (response.notes) {
        const filteredNotes = filterNotesByAccount(response.notes);
        const noteEntries = Object.entries(filteredNotes);
        
        if (noteEntries.length === 0) {
          notesListElement.style.display = 'none';
          return;
        }
        
        // Sort by last modified
        noteEntries.sort((a, b) => (b[1].lastModified || 0) - (a[1].lastModified || 0));
        
        notesListElement.innerHTML = noteEntries.map(([threadId, noteData]) => {
          const preview = noteData.content.substring(0, 60) + (noteData.content.length > 60 ? '...' : '');
          const timestamp = formatTimestamp(new Date(noteData.lastModified || noteData.timestamp));
          
          return `
            <div class="note-item" data-thread-id="${threadId}" data-platform="${noteData.platform}">
              <div class="note-subject">📧 ${noteData.platform.toUpperCase()} Thread</div>
              <div class="note-preview">${preview}</div>
              <div class="note-timestamp">${timestamp}</div>
            </div>
          `;
        }).join('');
        
        notesListElement.style.display = 'block';
        
        // Add click handlers for note items
        notesListElement.querySelectorAll('.note-item').forEach(item => {
          item.addEventListener('click', () => {
            const threadId = item.getAttribute('data-thread-id');
            const platform = item.getAttribute('data-platform');
            openThreadWithNotes(threadId, platform);
          });
        });
      }
    } catch (error) {
      console.error('Error loading notes list:', error);
    }
  }
  
  async function setupEventListeners() {
    toggleSwitch.addEventListener('click', async () => {
      const isCurrentlyEnabled = toggleSwitch.classList.contains('enabled');
      const newState = !isCurrentlyEnabled;
      
      try {
        // Save new state
        await chrome.storage.local.set({ extensionEnabled: newState });
        
        // Update UI
        toggleSwitch.classList.toggle('enabled', newState);
        
        // Notify content scripts of the change
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && (tab.url.includes('mail.google.com') || tab.url.includes('outlook'))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'toggleExtension',
            enabled: newState
          }).catch(() => {
            // Content script might not be ready, that's OK
          });
        }
        
      } catch (error) {
        console.error('Error toggling extension:', error);
      }
    });
    
    // Setup backup functionality
    setupBackupEventListeners();
    
    // Setup sync functionality
    setupSyncEventListeners();
    
    // Load sync settings
    await loadSyncSettings();
  }
  
  function setupBackupEventListeners() {
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const syncNowBtn = document.getElementById('syncNowBtn');
    const importFile = document.getElementById('importFile');
    const backupStatus = document.getElementById('backupStatus');
    
    exportBtn.addEventListener('click', async () => {
      try {
        exportBtn.disabled = true;
        exportBtn.textContent = 'Exporting...';
        backupStatus.textContent = 'Preparing your notes for export...';
        
        const response = await chrome.runtime.sendMessage({ action: 'exportNotes' });
        
        if (response.success) {
          backupStatus.textContent = `✓ Exported ${response.notesCount} notes to ${response.filename}`;
          backupStatus.style.color = '#059669';
        } else {
          backupStatus.textContent = `✗ Export failed: ${response.error}`;
          backupStatus.style.color = '#dc2626';
        }
        
      } catch (error) {
        console.error('Export error:', error);
        backupStatus.textContent = '✗ Export failed - please try again';
        backupStatus.style.color = '#dc2626';
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Export Notes';
        
        // Reset status after a few seconds
        setTimeout(() => {
          backupStatus.textContent = 'Click Export to save your notes to a file';
          backupStatus.style.color = '#6b7280';
        }, 5000);
      }
    });
    
    importBtn.addEventListener('click', () => {
      importFile.click();
    });
    
    importFile.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        importBtn.disabled = true;
        importBtn.textContent = 'Importing...';
        backupStatus.textContent = 'Reading and importing notes...';
        
        const fileContent = await readFileAsText(file);
        
        // Show import options dialog
        const importOptions = await showImportOptionsDialog();
        if (!importOptions) {
          // User cancelled
          return;
        }
        
        const response = await chrome.runtime.sendMessage({
          action: 'importNotes',
          fileContent: fileContent,
          options: importOptions
        });
        
        if (response.success) {
          const { imported, skipped, errors, totalInBackup } = response;
          let message = `✓ Import completed: ${imported} imported`;
          if (skipped > 0) message += `, ${skipped} skipped`;
          if (errors > 0) message += `, ${errors} errors`;
          
          backupStatus.textContent = message;
          backupStatus.style.color = '#059669';
          
          // Refresh statistics
          await loadStatistics();
        } else {
          backupStatus.textContent = `✗ Import failed: ${response.error}`;
          backupStatus.style.color = '#dc2626';
        }
        
      } catch (error) {
        console.error('Import error:', error);
        backupStatus.textContent = '✗ Import failed - invalid backup file';
        backupStatus.style.color = '#dc2626';
      } finally {
        importBtn.disabled = false;
        importBtn.textContent = 'Import Notes';
        importFile.value = ''; // Reset file input
        
        // Reset status after a few seconds
        setTimeout(() => {
          backupStatus.textContent = 'Click Export to save your notes to a file';
          backupStatus.style.color = '#6b7280';
        }, 5000);
      }
    });

    // Sync Now button event listener
    if (syncNowBtn) {
      syncNowBtn.addEventListener('click', async () => {
        try {
          syncNowBtn.disabled = true;
          syncNowBtn.textContent = '🔄 Syncing...';
          backupStatus.textContent = 'Triggering immediate sync...';
          
          // Trigger immediate auto-sync
          const response = await chrome.runtime.sendMessage({ action: 'triggerImmediateSync' });
          
          if (response.success) {
            syncNowBtn.textContent = '✓ Synced!';
            syncNowBtn.style.backgroundColor = '#059669';
            backupStatus.textContent = response.message || '✓ Sync completed successfully';
            backupStatus.style.color = '#059669';
            
            // Reset button after 2 seconds
            setTimeout(() => {
              syncNowBtn.textContent = '🔄 Sync Now';
              syncNowBtn.style.backgroundColor = '';
              syncNowBtn.disabled = false;
            }, 2000);
          } else {
            syncNowBtn.textContent = '✗ Failed';
            syncNowBtn.style.backgroundColor = '#dc2626';
            backupStatus.textContent = response.error || '✗ Sync failed - please try again';
            backupStatus.style.color = '#dc2626';
            
            // Reset button after 3 seconds
            setTimeout(() => {
              syncNowBtn.textContent = '🔄 Sync Now';
              syncNowBtn.style.backgroundColor = '';
              syncNowBtn.disabled = false;
            }, 3000);
          }
          
        } catch (error) {
          console.error('Sync Now error:', error);
          syncNowBtn.textContent = '✗ Error';
          syncNowBtn.style.backgroundColor = '#dc2626';
          backupStatus.textContent = '✗ Sync failed - please try again';
          backupStatus.style.color = '#dc2626';
          
          setTimeout(() => {
            syncNowBtn.textContent = '🔄 Sync Now';
            syncNowBtn.style.backgroundColor = '';
            syncNowBtn.disabled = false;
          }, 3000);
        }
        
        // Reset backup status after a few seconds
        setTimeout(() => {
          backupStatus.textContent = 'Click Export to save your notes to a file';
          backupStatus.style.color = '#6b7280';
        }, 5000);
      });
    }
  }
  
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }
  
  function showImportOptionsDialog() {
    return new Promise((resolve) => {
      const options = {
        merge: false,
        overwrite: false
      };
      
      // For now, use simple confirm dialogs
      // TODO: Create a proper modal dialog
      const merge = confirm('Import Mode:\n\nOK = Replace existing notes\nCancel = Merge with existing notes\n\n(Existing notes with same thread will be kept if you choose Cancel)');
      
      if (merge) {
        // Replace mode
        options.merge = false;
        options.overwrite = true;
      } else {
        // Merge mode
        options.merge = true;
        options.overwrite = false;
      }
      
      resolve(options);
    });
  }
  
  function openThreadWithNotes(threadId, platform) {
    // Open the appropriate email platform and navigate to thread
    const baseUrl = platform === 'gmail' ? 'https://mail.google.com' : 'https://outlook.office365.com';
    
    if (platform === 'gmail') {
      // For Gmail, we can try to construct a URL to the thread
      const gmailUrl = `${baseUrl}/mail/u/${currentAccount ? (parseInt(currentAccount.split(' ')[1]) - 1) : 0}/#inbox/${threadId}`;
      chrome.tabs.create({ url: gmailUrl });
    } else {
      // For Outlook, just open the main page
      chrome.tabs.create({ url: baseUrl });
    }
    
    window.close();
  }
  
  function formatTimestamp(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  }
  
  async function loadSyncSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getSyncSettings' });
      if (response.settings) {
        updateSyncUI(response.settings);
      }
    } catch (error) {
      console.error('Error loading sync settings:', error);
    }
  }
  
  function updateSyncUI(settings) {
    const autoSyncToggle = document.getElementById('autoSyncToggle');
    const syncSettings = document.getElementById('syncSettings');
    const syncFrequency = document.getElementById('syncFrequency');
    const backupStatus = document.getElementById('backupStatus');
    
    if (!autoSyncToggle) return; // Elements might not be loaded yet
    
    // Update toggle state
    autoSyncToggle.classList.toggle('enabled', settings.enabled);
    
    // Show/hide settings
    if (syncSettings) syncSettings.style.display = settings.enabled ? 'block' : 'none';
    
    // Update frequency selection
    if (syncFrequency) {
      syncFrequency.value = settings.frequency.toString();
    }
    
    // Update status message
    if (settings.enabled && settings.lastSync && backupStatus) {
      const lastSyncDate = new Date(settings.lastSync);
      const timeAgo = formatTimestamp(lastSyncDate);
      backupStatus.textContent = `✓ Auto-sync enabled - last sync ${timeAgo}`;
      backupStatus.style.color = '#059669';
    } else if (settings.enabled && backupStatus) {
      backupStatus.textContent = '⚙️ Auto-sync enabled - setting up...';
      backupStatus.style.color = '#3b82f6';
    }
  }
  
  function setupSyncEventListeners() {
    const autoSyncToggle = document.getElementById('autoSyncToggle');
    const syncHeader = document.querySelector('.sync-header');
    const syncFrequency = document.getElementById('syncFrequency');
    const setupSyncBtn = document.getElementById('setupSyncBtn');
    const backupStatus = document.getElementById('backupStatus');
    
    if (!autoSyncToggle) return; // Elements not ready yet
    
    // Toggle sync on/off
    const toggleSync = async () => {
      const isEnabled = autoSyncToggle.classList.contains('enabled');
      
      try {
        if (isEnabled) {
          // Disable sync
          const response = await chrome.runtime.sendMessage({ action: 'disableAutoSync' });
          if (response.success) {
            await loadSyncSettings();
            if (backupStatus) {
              backupStatus.textContent = 'Auto-sync disabled';
              backupStatus.style.color = '#6b7280';
            }
          }
        } else {
          // Enable sync
          const frequency = parseInt(syncFrequency?.value) || 5;
          const response = await chrome.runtime.sendMessage({ 
            action: 'enableAutoSync', 
            frequency: frequency 
          });
          if (response.success) {
            await loadSyncSettings();
            showSyncInstructions();
          } else {
            alert('Failed to enable auto-sync: ' + response.error);
          }
        }
      } catch (error) {
        console.error('Error toggling sync:', error);
        alert('Error configuring sync. Please try again.');
      }
    };
    
    autoSyncToggle.addEventListener('click', toggleSync);
    if (syncHeader) syncHeader.addEventListener('click', toggleSync);
    
    // Update frequency
    if (syncFrequency) {
      syncFrequency.addEventListener('change', async () => {
        const isEnabled = autoSyncToggle.classList.contains('enabled');
        if (isEnabled) {
          const frequency = parseInt(syncFrequency.value) || 5;
          try {
            await chrome.runtime.sendMessage({ 
              action: 'enableAutoSync', 
              frequency: frequency 
            });
            if (backupStatus) {
              backupStatus.textContent = `⚙️ Sync frequency updated to ${frequency} minute${frequency !== 1 ? 's' : ''}`;
              backupStatus.style.color = '#3b82f6';
            }
          } catch (error) {
            console.error('Error updating sync frequency:', error);
          }
        }
      });
    }
    
    // Setup sync folder
    if (setupSyncBtn) {
      setupSyncBtn.addEventListener('click', () => {
        showSyncInstructions();
      });
    }
  }
  
  function showSyncInstructions() {
    const frequency = document.getElementById('syncFrequency')?.value || '5';
    const isEnabled = document.getElementById('autoSyncToggle')?.classList.contains('enabled');
    
    let fileStatus = isEnabled ? 
      '✅ Extension creates: Downloads/EmailNotes/EmailNotes/email-notes-sync.json' :
      '⚠️  Enable auto-sync first to create sync file';
    
    const instructions = `CLOUD SYNC SETUP:

${fileStatus}

📁 Create symbolic link to sync folder:

iCloud Drive:
ln -s ~/Library/Mobile\\ Documents/com~apple~CloudDocs/EmailNotes ~/Downloads/EmailNotes

Google Drive:
ln -s ~/Google\\ Drive/EmailNotes ~/Downloads/EmailNotes

Dropbox:
ln -s ~/Dropbox/EmailNotes ~/Downloads/EmailNotes

🔄 Auto-syncs every ${frequency} minutes
📱 Import sync file on other devices`;
    
    alert(instructions);
  }
  
});