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
      await checkPlatformStatus(tab);
      
      // Load extension state
      await loadExtensionState();
      
      // Load statistics
      await loadStatistics();
      
      // Setup event listeners
      setupEventListeners();
      
      // Load notes list if not on email platform
      if (!currentPlatform) {
        await loadNotesList();
      }
      
    } catch (error) {
      console.error('Error initializing popup:', error);
      statusElement.textContent = 'Error loading extension';
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
    // Extract Gmail account from URL and try to get email address
    try {
      const match = url.match(/mail\.google\.com\/mail\/u\/(\d+)/);
      const accountIndex = match ? match[1] : '0';
      
      // Try to get the actual email address from the active tab
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Try to execute script to get email address
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          func: () => {
            // Try to find Gmail user email in the page
            const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
            const selectors = ['[data-email]', '.gb_A', '.gb_C', '[aria-label*="@"]'];
            
            for (const selector of selectors) {
              const elements = document.querySelectorAll(selector);
              for (const element of elements) {
                if (element.dataset && element.dataset.email) return element.dataset.email;
                const ariaLabel = element.getAttribute('aria-label');
                if (ariaLabel) {
                  const match = ariaLabel.match(emailRegex);
                  if (match && match[0].includes('gmail.com')) return match[0];
                }
                const title = element.title;
                if (title) {
                  const match = title.match(emailRegex);
                  if (match && match[0].includes('gmail.com')) return match[0];
                }
                const text = element.textContent;
                if (text) {
                  const match = text.match(emailRegex);
                  if (match && match[0].includes('gmail.com')) return match[0];
                }
              }
            }
            
            // Fallback: look for any Gmail address in page content
            const bodyText = document.body.textContent;
            const matches = bodyText.match(emailRegex);
            if (matches) {
              const gmailMatch = matches.find(email => 
                email.includes('gmail.com') && 
                !email.includes('noreply') &&
                !email.includes('no-reply')
              );
              if (gmailMatch) return gmailMatch;
            }
            
            return null;
          }
        });
        
        if (results && results[0] && results[0].result) {
          return results[0].result;
        }
      } catch (scriptError) {
        console.log('Could not execute script to detect email:', scriptError);
      }
      
      // Fallback to account index
      return `Gmail Account ${parseInt(accountIndex) + 1}`;
    } catch (error) {
      console.error('Error detecting Gmail account:', error);
      return null;
    }
  }
  
  async function detectOutlookAccount(url) {
    // Outlook account detection - simplified for now
    return null; // TODO: Implement Outlook account detection
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
    if (!currentPlatform) return notes;
    
    const filtered = {};
    for (const [threadId, noteData] of Object.entries(notes)) {
      if (noteData.platform === currentPlatform) {
        // TODO: Add account-level filtering when implemented
        filtered[threadId] = noteData;
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
  
  function setupEventListeners() {
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
});