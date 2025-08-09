// Gmail content script - SIMPLE WORKING VERSION
class GmailThreadDetector {
  constructor() {
    this.currentThreadId = null;
    this.notesPanel = null;
    this.extensionEnabled = true;
    this.currentAccount = null;
    this.init();
  }

  async init() {
    console.log('Gmail Thread Detector initialized');
    
    // Check if extension is enabled
    await this.checkExtensionState();
    
    // Detect current Gmail account
    this.detectCurrentAccount();
    
    // Setup message listener for toggle events
    this.setupMessageListener();
    
    if (this.extensionEnabled) {
      // Wait for Gmail to load
      setTimeout(() => {
        this.setupThreadDetection();
      }, 2000);
    }
  }

  setupThreadDetection() {
    // Detect thread changes on URL changes
    let lastUrl = location.href;
    const checkUrlChange = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => this.detectCurrentThread(), 100);
      }
    };
    
    setInterval(checkUrlChange, 1000);
    
    // Initial detection
    this.detectCurrentThread();
    
    // Add floating button
    this.addFloatingButton();
  }

  detectCurrentThread() {
    if (!this.extensionEnabled) return;
    
    const threadId = this.getThreadIdFromUrl();
    
    if (threadId && threadId !== this.currentThreadId) {
      console.log('THREAD CHANGED:', this.currentThreadId, '->', threadId);
      this.currentThreadId = threadId;
      
      // Update floating button appearance
      this.updateFloatingButtonVisibility();
      
      // Hide panel when thread changes AND reload notes for new thread
      if (this.notesPanel && this.notesPanel.classList.contains('visible')) {
        console.log('Updating panel for new thread');
        this.updatePanelForNewThread();
      } else {
        // Auto-open bubble for threads with existing notes
        this.checkAndAutoOpenNotes(threadId);
      }
    } else if (!threadId && this.currentThreadId) {
      // No thread detected - update button but keep it visible
      console.log('No thread detected - showing notes list mode');
      this.currentThreadId = null;
      this.updateFloatingButtonVisibility();
      // Don't hide the panel automatically - let user decide
    }
  }

  async updatePanelForNewThread() {
    if (!this.notesPanel) return;
    
    // Load note for current thread
    const existingNote = await this.loadNote(this.currentThreadId);
    const textarea = this.notesPanel.querySelector('.notes-textarea');
    
    // Clear and set new content
    textarea.value = existingNote ? existingNote.content : '';
    console.log('Updated panel content for thread:', this.currentThreadId);
  }

  getThreadIdFromUrl() {
    const hash = window.location.hash;
    const href = window.location.href;
    
    console.log('=== DEBUGGING URL PARSING ===');
    console.log('Full URL:', href);
    console.log('Hash:', hash);
    
    // Try multiple patterns that Gmail might use
    const patterns = [
      /#inbox\/([A-Za-z\d]+)$/, // Gmail inbox thread format like #inbox/FMfcgzQbgcWHH...
      /thread-f:([a-f\d]+)/, // Original thread-f pattern
      /thread\/([a-f\d]+)/, // Alternative pattern
      /#([a-f\d]{16,})/, // Direct hash ID
      /\/([A-Za-z\d]{20,})$/, // Long alphanumeric ID at end
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = hash.match(pattern) || href.match(pattern);
      if (match) {
        console.log(`Found thread ID with pattern ${i}:`, match[1]);
        return match[1];
      }
    }
    
    console.log('No thread ID found in URL');
    return null;
  }

  addFloatingButton() {
    if (document.querySelector('.gmail-notes-button') || !this.extensionEnabled) return;

    const button = document.createElement('div');
    button.className = 'gmail-notes-button';
    button.innerHTML = '📝';
    button.title = 'Add notes to this conversation';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      background: #1a73e8;
      border: none;
      border-radius: 50%;
      color: white;
      font-size: 20px;
      cursor: pointer;
      z-index: 10001;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    `;

    button.addEventListener('click', () => {
      this.toggleNotesPanel();
    });

    document.body.appendChild(button);
  }

  updateFloatingButtonVisibility() {
    const floatingButton = document.querySelector('.gmail-notes-button');
    if (floatingButton) {
      // Show button when extension is enabled, regardless of thread detection
      floatingButton.style.display = this.extensionEnabled ? 'flex' : 'none';
      
      // Update button appearance based on context
      if (this.currentThreadId) {
        floatingButton.title = 'Add notes to this conversation';
        floatingButton.style.background = '#1a73e8';
      } else {
        floatingButton.title = 'View all your notes';
        floatingButton.style.background = '#34a853';
      }
    }
  }

  async checkAndAutoOpenNotes(threadId) {
    // Check if thread has existing notes and auto-open if so
    try {
      const existingNote = await this.loadNote(threadId);
      if (existingNote && existingNote.content && existingNote.content.trim()) {
        console.log('Thread has existing notes - auto-opening panel');
        this.showNotesPanel();
      }
    } catch (error) {
      console.error('Error checking for existing notes:', error);
    }
  }

  toggleNotesPanel() {
    if (!this.extensionEnabled) {
      console.log('Extension disabled');
      return;
    }
    
    if (this.notesPanel && this.notesPanel.classList.contains('visible')) {
      console.log('Hiding notes panel');
      this.hideNotesPanel();
    } else {
      if (!this.currentThreadId) {
        console.log('No thread detected - showing notes list');
        this.showNotesListPanel();
      } else {
        console.log('Showing notes panel for current thread');
        this.showNotesPanel();
      }
    }
  }

  hideNotesPanel() {
    if (this.notesPanel) {
      this.notesPanel.classList.remove('visible');
      this.notesPanel.style.display = 'none';
    }
  }

  async showNotesPanel() {
    // Make sure we have the right type of panel for thread notes
    if (!this.notesPanel || this.notesPanel.classList.contains('notes-list-panel')) {
      if (this.notesPanel) {
        this.notesPanel.remove();
      }
      this.createNotesPanel();
    }

    // Update thread subject
    const threadSubject = this.notesPanel.querySelector('.thread-subject');
    if (threadSubject) {
      const subject = this.getCurrentThreadSubject();
      threadSubject.textContent = subject || 'Gmail Conversation';
      threadSubject.title = subject || 'No subject available';
    }

    // Load existing note
    const existingNote = await this.loadNote(this.currentThreadId);
    
    const textarea = this.notesPanel.querySelector('.notes-textarea');
    const lastUpdated = this.notesPanel.querySelector('.last-updated');
    const statusText = this.notesPanel.querySelector('.status-text');
    const statusIndicator = this.notesPanel.querySelector('.status-indicator');
    
    if (textarea) textarea.value = existingNote ? existingNote.content : '';
    
    if (existingNote && existingNote.lastModified && lastUpdated && statusIndicator && statusText) {
      lastUpdated.textContent = this.formatTimestamp(new Date(existingNote.lastModified));
      statusIndicator.style.color = '#10b981';
      statusText.textContent = 'Saved';
    } else if (lastUpdated && statusIndicator && statusText) {
      lastUpdated.textContent = '';
      statusIndicator.style.color = '#6b7280';
      statusText.textContent = 'Ready';
    }
    
    this.notesPanel.classList.add('visible');
    this.notesPanel.style.display = 'flex';
    if (textarea) setTimeout(() => textarea.focus(), 100);
  }

  createNotesPanel() {
    this.notesPanel = document.createElement('div');
    this.notesPanel.className = 'notes-panel';
    this.notesPanel.innerHTML = `
      <div class="notes-header">
        <div class="notes-title-section">
          <h3>📝 Notes</h3>
          <div class="thread-subject" title="Thread subject">Loading...</div>
        </div>
        <button class="notes-close">×</button>
      </div>
      <textarea class="notes-textarea" placeholder="Add your private notes..."></textarea>
      <div class="notes-footer">
        <div class="save-status">
          <span class="status-indicator">●</span>
          <span class="status-text">Ready</span>
        </div>
        <div class="last-updated"></div>
      </div>
    `;
    
    this.notesPanel.style.cssText = `
      position: fixed;
      top: 50px;
      right: 50px;
      width: 320px;
      height: 420px;
      background: white;
      border: 1px solid #dadce0;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 10000;
      display: none;
      flex-direction: column;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
    `;

    const header = this.notesPanel.querySelector('.notes-header');
    header.style.cssText = `
      padding: 15px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: #f8f9fa;
      border-radius: 8px 8px 0 0;
    `;

    const titleSection = this.notesPanel.querySelector('.notes-title-section');
    titleSection.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    const titleElement = titleSection.querySelector('h3');
    titleElement.style.cssText = `
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 500;
      color: #202124;
    `;

    const threadSubject = titleSection.querySelector('.thread-subject');
    threadSubject.style.cssText = `
      font-size: 12px;
      color: #5f6368;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 220px;
    `;

    const textarea = this.notesPanel.querySelector('.notes-textarea');
    textarea.style.cssText = `
      flex: 1;
      padding: 15px;
      border: none;
      resize: none;
      outline: none;
      font-family: inherit;
      font-size: 13px;
      line-height: 1.4;
    `;

    const footer = this.notesPanel.querySelector('.notes-footer');
    footer.style.cssText = `
      padding: 8px 15px;
      border-top: 1px solid #f1f3f4;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #5f6368;
      background: #fafbfc;
      border-radius: 0 0 8px 8px;
    `;

    const saveStatus = footer.querySelector('.save-status');
    saveStatus.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
    `;

    const statusIndicator = footer.querySelector('.status-indicator');
    statusIndicator.style.cssText = `
      color: #6b7280;
      font-size: 10px;
    `;

    const lastUpdated = footer.querySelector('.last-updated');
    lastUpdated.style.cssText = `
      font-size: 11px;
      color: #9ca3af;
    `;

    const closeBtn = this.notesPanel.querySelector('.notes-close');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
    `;

    // Event listeners
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Close button clicked');
      this.hideNotesPanel();
    });

    // Click outside to close
    const handleClickOutside = (e) => {
      if (this.notesPanel && 
          this.notesPanel.classList.contains('visible') && 
          !this.notesPanel.contains(e.target) &&
          !e.target.closest('.gmail-notes-button')) {
        console.log('Clicked outside - closing panel');
        this.hideNotesPanel();
      }
    };
    document.addEventListener('click', handleClickOutside);

    // Prevent panel clicks from bubbling
    this.notesPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    let saveTimeout;

    textarea.addEventListener('input', () => {
      // Show typing indicator
      const statusIndicator = this.notesPanel.querySelector('.status-indicator');
      const statusText = this.notesPanel.querySelector('.status-text');
      
      statusIndicator.style.color = '#fbbf24';
      statusText.textContent = 'Typing...';
      
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(async () => {
        await this.saveNoteWithStatus(this.currentThreadId, textarea.value);
      }, 1000);
    });

    // Show panel when visible
    this.notesPanel.classList.add('visible');
    this.notesPanel.style.display = 'flex';

    document.body.appendChild(this.notesPanel);
  }

  async checkExtensionState() {
    try {
      const result = await chrome.storage.local.get(['extensionEnabled']);
      this.extensionEnabled = result.extensionEnabled !== false; // Default to enabled
      console.log('Extension enabled:', this.extensionEnabled);
    } catch (error) {
      console.error('Error checking extension state:', error);
      this.extensionEnabled = true; // Default to enabled on error
    }
  }
  
  detectCurrentAccount() {
    try {
      // Detect Gmail account from URL
      const match = window.location.href.match(/mail\.google\.com\/mail\/u\/(\d+)/);
      this.currentAccount = match ? `gmail_account_${match[1]}` : 'gmail_account_0';
      console.log('Detected Gmail account:', this.currentAccount);
    } catch (error) {
      console.error('Error detecting account:', error);
      this.currentAccount = 'gmail_account_0';
    }
  }
  
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'toggleExtension') {
        this.extensionEnabled = message.enabled;
        console.log('Extension toggled:', this.extensionEnabled);
        
        if (!this.extensionEnabled) {
          // Hide all UI elements
          this.hideNotesPanel();
          const floatingButton = document.querySelector('.gmail-notes-button');
          if (floatingButton) {
            floatingButton.style.display = 'none';
          }
        } else {
          // Re-enable and detect current thread
          this.updateFloatingButtonVisibility();
          this.detectCurrentThread();
        }
        
        sendResponse({ success: true });
      }
    });
  }
  
  async saveNote(threadId, content, subject = null) {
    if (!threadId || !this.extensionEnabled) return;
    
    try {
      // Create account-specific thread ID
      const accountSpecificThreadId = `${this.currentAccount}_${threadId}`;
      
      const response = await chrome.runtime.sendMessage({
        action: 'saveNote',
        threadId: accountSpecificThreadId,
        content: content,
        platform: 'gmail',
        account: this.currentAccount,
        originalThreadId: threadId,
        subject: subject
      });
      
      console.log('Note saved for thread:', threadId, 'account:', this.currentAccount, response.success ? '✓' : '✗');
      return response;
    } catch (error) {
      console.error('Error saving note:', error);
      return { success: false, error: error.message };
    }
  }

  async saveNoteWithStatus(threadId, content) {
    if (!this.notesPanel || !threadId) return;
    
    const statusIndicator = this.notesPanel.querySelector('.status-indicator');
    const statusText = this.notesPanel.querySelector('.status-text');
    const lastUpdated = this.notesPanel.querySelector('.last-updated');
    
    try {
      // Show saving status
      if (statusIndicator) statusIndicator.style.color = '#3b82f6';
      if (statusText) statusText.textContent = 'Saving...';
      
      // Also save the current thread subject for future reference
      const subject = this.getCurrentThreadSubject();
      
      const response = await this.saveNote(threadId, content.trim(), subject);
      
      if (response.success) {
        // Show saved status
        if (statusIndicator) statusIndicator.style.color = '#10b981';
        if (statusText) statusText.textContent = '✓ Saved';
        if (lastUpdated) lastUpdated.textContent = this.formatTimestamp(new Date());
        
        // Return to ready after 2 seconds
        setTimeout(() => {
          if (statusIndicator) statusIndicator.style.color = '#6b7280';
          if (statusText) statusText.textContent = 'Ready';
        }, 2000);
      } else {
        // Show error status
        if (statusIndicator) statusIndicator.style.color = '#ef4444';
        if (statusText) statusText.textContent = 'Save failed';
        
        setTimeout(() => {
          if (statusIndicator) statusIndicator.style.color = '#6b7280';
          if (statusText) statusText.textContent = 'Ready';
        }, 3000);
      }
    } catch (error) {
      if (statusIndicator) statusIndicator.style.color = '#ef4444';
      if (statusText) statusText.textContent = 'Error';
      console.error('Error saving note:', error);
    }
  }

  getCurrentThreadSubject() {
    // Try multiple selectors to find the email subject
    const selectors = [
      '.hP', // Gmail conversation subject
      '.bog', // Alternative subject
      '.a1f', // Another Gmail selector
      'h2', // Generic subject heading
      '.nH .hP', // Nested subject
    ];
    
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        let subject = element.textContent.trim();
        // Truncate long subjects
        if (subject.length > 35) {
          subject = subject.substring(0, 35) + '...';
        }
        return subject;
      }
    }
    
    return null;
  }

  formatTimestamp(date) {
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

  async showNotesListPanel() {
    // Create or show notes list panel
    if (!this.notesPanel || !this.notesPanel.classList.contains('notes-list-panel')) {
      if (this.notesPanel) {
        this.notesPanel.remove();
      }
      this.createNotesListPanel();
    }

    // Load and display all notes for current account
    await this.loadAndDisplayNotesList();
    
    this.notesPanel.classList.add('visible');
    this.notesPanel.style.display = 'flex';
  }

  createNotesListPanel() {
    this.notesPanel = document.createElement('div');
    this.notesPanel.className = 'notes-panel notes-list-panel';
    this.notesPanel.innerHTML = `
      <div class="notes-header">
        <div class="notes-title-section">
          <h3>📝 All Notes</h3>
          <div class="account-info">Account: ${this.currentAccount || 'Default'}</div>
        </div>
        <button class="notes-close">×</button>
      </div>
      <div class="notes-list-content">
        <div class="loading-message">Loading your notes...</div>
      </div>
    `;
    
    this.notesPanel.style.cssText = `
      position: fixed;
      top: 50px;
      right: 50px;
      width: 350px;
      height: 450px;
      background: white;
      border: 1px solid #dadce0;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.15);
      z-index: 10000;
      display: none;
      flex-direction: column;
      font-family: 'Google Sans', Roboto, Arial, sans-serif;
    `;

    // Style the header
    const header = this.notesPanel.querySelector('.notes-header');
    header.style.cssText = `
      padding: 15px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      background: #f8f9fa;
      border-radius: 8px 8px 0 0;
    `;

    const titleSection = this.notesPanel.querySelector('.notes-title-section');
    titleSection.style.cssText = `
      flex: 1;
      min-width: 0;
    `;

    const titleElement = titleSection.querySelector('h3');
    titleElement.style.cssText = `
      margin: 0 0 4px 0;
      font-size: 14px;
      font-weight: 500;
      color: #202124;
    `;

    const accountInfo = titleSection.querySelector('.account-info');
    accountInfo.style.cssText = `
      font-size: 12px;
      color: #5f6368;
      font-weight: 400;
    `;

    const closeBtn = this.notesPanel.querySelector('.notes-close');
    closeBtn.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: #5f6368;
      padding: 4px;
    `;

    // Style the content area
    const contentArea = this.notesPanel.querySelector('.notes-list-content');
    contentArea.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 0;
    `;

    // Event listeners
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideNotesPanel();
    });

    // Click outside to close
    const handleClickOutside = (e) => {
      if (this.notesPanel && 
          this.notesPanel.classList.contains('visible') && 
          !this.notesPanel.contains(e.target) &&
          !e.target.closest('.gmail-notes-button')) {
        this.hideNotesPanel();
      }
    };
    document.addEventListener('click', handleClickOutside);

    // Prevent panel clicks from bubbling
    this.notesPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    document.body.appendChild(this.notesPanel);
  }

  async loadAndDisplayNotesList() {
    try {
      // Get all notes
      const response = await chrome.runtime.sendMessage({ action: 'getAllNotes' });
      
      if (!response.notes) {
        this.displayNoNotes();
        return;
      }

      // Filter notes for current account
      const accountNotes = this.filterNotesByAccount(response.notes);
      const noteEntries = Object.entries(accountNotes);
      
      if (noteEntries.length === 0) {
        this.displayNoNotes();
        return;
      }

      // Sort by last modified (newest first)
      noteEntries.sort((a, b) => (b[1].lastModified || 0) - (a[1].lastModified || 0));
      
      this.displayNotesList(noteEntries);
      
    } catch (error) {
      console.error('Error loading notes list:', error);
      this.displayError();
    }
  }

  filterNotesByAccount(allNotes) {
    const filtered = {};
    const accountPrefix = `${this.currentAccount}_`;
    
    for (const [threadId, noteData] of Object.entries(allNotes)) {
      if (threadId.startsWith(accountPrefix) && noteData.platform === 'gmail') {
        filtered[threadId] = noteData;
      }
    }
    
    return filtered;
  }

  async displayNotesList(noteEntries) {
    const contentArea = this.notesPanel.querySelector('.notes-list-content');
    
    // Get subjects for each thread
    const notesWithSubjects = await Promise.all(
      noteEntries.map(async ([threadId, noteData]) => {
        const originalThreadId = noteData.originalThreadId || threadId.replace(`${this.currentAccount}_`, '');
        const subject = await this.getThreadSubjectFromStorage(threadId) || await this.fetchThreadSubject(originalThreadId) || 'No Subject';
        
        return {
          threadId,
          originalThreadId,
          noteData,
          subject
        };
      })
    );
    
    const notesHtml = notesWithSubjects.map(({ threadId, originalThreadId, noteData, subject }) => {
      const preview = noteData.content.length > 60 
        ? noteData.content.substring(0, 60) + '...' 
        : noteData.content;
      const timestamp = this.formatTimestamp(new Date(noteData.lastModified || noteData.timestamp));
      
      return `
        <div class="note-item" data-thread-id="${originalThreadId}" data-full-thread-id="${threadId}">
          <div class="note-subject">${this.escapeHtml(subject)}</div>
          <div class="note-preview">${this.escapeHtml(preview)}</div>
          <div class="note-timestamp">${timestamp}</div>
        </div>
      `;
    }).join('');
    
    contentArea.innerHTML = `
      <div class="notes-list-header">
        <div class="notes-count">${noteEntries.length} saved note${noteEntries.length === 1 ? '' : 's'}</div>
      </div>
      <div class="notes-items">
        ${notesHtml}
      </div>
    `;

    // Style the list
    const listHeader = contentArea.querySelector('.notes-list-header');
    listHeader.style.cssText = `
      padding: 12px 15px;
      border-bottom: 1px solid #f1f3f4;
      background: #fafbfc;
      font-size: 12px;
      color: #5f6368;
      font-weight: 500;
    `;

    const notesItems = contentArea.querySelector('.notes-items');
    notesItems.style.cssText = `
      max-height: 300px;
      overflow-y: auto;
    `;

    // Style individual note items
    contentArea.querySelectorAll('.note-item').forEach(item => {
      item.style.cssText = `
        padding: 12px 15px;
        border-bottom: 1px solid #f1f3f4;
        cursor: pointer;
        transition: background-color 0.2s;
      `;
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f8f9fa';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });
      
      item.addEventListener('click', () => {
        const originalThreadId = item.getAttribute('data-thread-id');
        this.openGmailThread(originalThreadId);
      });
    });

    // Style note subjects, previews, and timestamps
    contentArea.querySelectorAll('.note-subject').forEach(subject => {
      subject.style.cssText = `
        font-weight: 500;
        color: #202124;
        margin-bottom: 4px;
        font-size: 13px;
      `;
    });

    contentArea.querySelectorAll('.note-preview').forEach(preview => {
      preview.style.cssText = `
        color: #5f6368;
        font-size: 12px;
        margin-bottom: 4px;
        line-height: 1.4;
      `;
    });

    contentArea.querySelectorAll('.note-timestamp').forEach(timestamp => {
      timestamp.style.cssText = `
        color: #9ca3af;
        font-size: 11px;
      `;
    });
  }

  displayNoNotes() {
    const contentArea = this.notesPanel.querySelector('.notes-list-content');
    contentArea.innerHTML = `
      <div class="no-notes-message">
        <div class="no-notes-icon">📝</div>
        <div class="no-notes-text">No notes saved yet</div>
        <div class="no-notes-subtext">Open a Gmail conversation and click the notes button to create your first note.</div>
      </div>
    `;

    const message = contentArea.querySelector('.no-notes-message');
    message.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px 20px;
      text-align: center;
    `;

    const icon = message.querySelector('.no-notes-icon');
    icon.style.cssText = `
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    `;

    const text = message.querySelector('.no-notes-text');
    text.style.cssText = `
      font-size: 16px;
      font-weight: 500;
      color: #5f6368;
      margin-bottom: 8px;
    `;

    const subtext = message.querySelector('.no-notes-subtext');
    subtext.style.cssText = `
      font-size: 12px;
      color: #9ca3af;
      line-height: 1.4;
    `;
  }

  displayError() {
    const contentArea = this.notesPanel.querySelector('.notes-list-content');
    contentArea.innerHTML = `
      <div class="error-message">
        <div class="error-icon">⚠️</div>
        <div class="error-text">Error loading notes</div>
        <div class="error-subtext">Please try again later.</div>
      </div>
    `;

    const message = contentArea.querySelector('.error-message');
    message.style.cssText = `
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 40px 20px;
      text-align: center;
    `;
  }

  async getThreadSubjectFromStorage(threadId) {
    // Check if we've stored the subject before
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId: threadId
      });
      
      return response.note?.subject || null;
    } catch (error) {
      return null;
    }
  }
  
  async fetchThreadSubject(originalThreadId) {
    // Try to get subject from current Gmail page if thread is visible
    try {
      // Look for thread elements that might contain the subject
      const threadSelectors = [
        `[data-thread-id*="${originalThreadId}"] .bog`,
        `[data-thread-id*="${originalThreadId}"] .hP`,
        `[data-legacy-thread-id*="${originalThreadId}"] .bog`,
        `[data-legacy-thread-id*="${originalThreadId}"] .hP`,
      ];
      
      for (const selector of threadSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent.trim()) {
          let subject = element.textContent.trim();
          // Clean up the subject
          subject = subject.replace(/^Re:\s*/i, '').replace(/^Fwd:\s*/i, '');
          if (subject.length > 40) {
            subject = subject.substring(0, 40) + '...';
          }
          return subject;
        }
      }
      
      // Fallback: try to find any subject on the page
      const fallbackSelectors = ['.hP', '.bog', '.a1f'];
      for (const selector of fallbackSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (element && element.textContent.trim()) {
            let subject = element.textContent.trim();
            if (subject.length > 40) {
              subject = subject.substring(0, 40) + '...';
            }
            return subject;
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching thread subject:', error);
      return null;
    }
  }
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  openGmailThread(threadId) {
    // Construct Gmail URL for the specific thread
    const accountNumber = this.currentAccount ? this.currentAccount.replace('gmail_account_', '') : '0';
    const gmailUrl = `https://mail.google.com/mail/u/${accountNumber}/#inbox/${threadId}`;
    
    console.log('Opening Gmail thread:', gmailUrl);
    
    // Navigate to the thread
    window.location.href = gmailUrl;
    
    // Close the panel
    this.hideNotesPanel();
  }

  async loadNote(threadId) {
    if (!threadId || !this.extensionEnabled) return null;
    
    try {
      // Create account-specific thread ID
      const accountSpecificThreadId = `${this.currentAccount}_${threadId}`;
      
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId: accountSpecificThreadId
      });
      
      console.log('Note loaded for thread:', threadId, 'account:', this.currentAccount, response.note ? '✓' : 'empty');
      return response.note;
    } catch (error) {
      console.error('Error loading note:', error);
      return null;
    }
  }
}

// Override the CSS visibility
const style = document.createElement('style');
style.textContent = `
  .notes-panel.visible {
    display: flex !important;
  }
`;
document.head.appendChild(style);

// Initialize
if (window.location.href.includes('mail.google.com')) {
  new GmailThreadDetector();
}