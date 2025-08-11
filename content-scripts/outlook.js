// Outlook content script for Email Thread Notes extension

console.log('Email Thread Notes: Outlook integration v2.0');

class OutlookThreadDetector {
  constructor() {
    console.log('Outlook thread detection initialized');
    this.currentThreadId = null;
    this.currentAccount = null;
    this.notesManager = null;
    this.extensionEnabled = true;
    
    this.init();
  }

  async init() {
    // Check if extension is enabled
    try {
      const result = await chrome.storage.local.get(['extensionEnabled']);
      this.extensionEnabled = result.extensionEnabled !== false;
    } catch (error) {
      console.error('Error checking extension state:', error);
    }

    if (!this.extensionEnabled) {
      console.log('Extension disabled, not initializing Outlook detection');
      return;
    }

    // Initialize notes manager
    this.notesManager = new OutlookNotesManager();
    
    // Detect current account
    this.detectAccount();
    
    // Start monitoring for thread changes
    this.startThreadDetection();
    
    // Listen for extension toggle
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleExtension') {
        this.extensionEnabled = request.enabled;
        if (this.extensionEnabled) {
          this.startThreadDetection();
        } else {
          this.stopThreadDetection();
          this.notesManager?.hideNotesPanel();
        }
      }
    });
  }

  detectAccount() {
    // Try to extract account from various Outlook selectors
    const selectors = [
      '[data-testid="account-manager-button"] [data-testid="persona-email"]',
      '.ms-Persona-primaryText',
      '[role="button"][aria-label*="@"]',
      '.owa-persona-email'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.includes('@')) {
        this.currentAccount = element.textContent.trim();
        console.log('Detected Outlook account:', this.currentAccount);
        return;
      }
    }

    // Fallback to URL-based detection
    const urlMatch = window.location.href.match(/outlook\.office365\.com\/mail\/([^\/]+)/);
    if (urlMatch) {
      this.currentAccount = `outlook_${urlMatch[1]}`;
      console.log('Using URL-based account detection:', this.currentAccount);
    } else {
      this.currentAccount = 'outlook_default';
      console.log('Using default account:', this.currentAccount);
    }
  }

  startThreadDetection() {
    if (!this.extensionEnabled) return;

    // Monitor URL changes for thread switching
    this.checkCurrentThread();
    
    // Set up periodic checking for thread changes
    this.threadCheckInterval = setInterval(() => {
      this.checkCurrentThread();
    }, 1000);

    console.log('Outlook thread detection started');
  }

  stopThreadDetection() {
    if (this.threadCheckInterval) {
      clearInterval(this.threadCheckInterval);
    }
    console.log('Outlook thread detection stopped');
  }

  checkCurrentThread() {
    const threadId = this.extractThreadId();
    
    if (threadId && threadId !== this.currentThreadId) {
      console.log('Thread changed:', this.currentThreadId, '->', threadId);
      this.currentThreadId = threadId;
      
      if (this.notesManager) {
        this.notesManager.handleThreadChange(threadId, this.currentAccount);
      }
    }
  }

  extractThreadId() {
    // Method 1: From URL
    const urlPatterns = [
      /\/mail\/id\/([A-Za-z0-9%\-_\.]+)/,
      /\/mail\/.*?id=([A-Za-z0-9%\-_\.]+)/,
      /conversationId=([A-Za-z0-9%\-_\.]+)/
    ];

    for (const pattern of urlPatterns) {
      const match = window.location.href.match(pattern);
      if (match) {
        return decodeURIComponent(match[1]);
      }
    }

    // Method 2: From DOM attributes
    const domSelectors = [
      '[data-convid]',
      '[data-conversation-id]',
      '[aria-label*="Conversation"]',
      '.ms-ConversationHeader'
    ];

    for (const selector of domSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const convId = element.getAttribute('data-convid') || 
                      element.getAttribute('data-conversation-id') || 
                      element.getAttribute('id');
        if (convId) {
          return convId;
        }
      }
    }

    // Method 3: Try to extract from message items
    const messageElement = document.querySelector('[role="listitem"][data-message-id], .ms-MessageItem, [class*="message"]');
    if (messageElement) {
      const messageId = messageElement.getAttribute('data-message-id') || 
                       messageElement.getAttribute('id');
      if (messageId) {
        // Use first part of message ID as thread ID
        return messageId.split('-')[0];
      }
    }

    return null;
  }

  getCurrentThreadSubject() {
    const selectors = [
      '.ms-MessageHeader-subject',
      '[data-testid="message-subject"]',
      '.subject-text',
      '.ms-ConversationHeader h2',
      '[role="heading"] span'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return 'Outlook Conversation';
  }
}

// Notes Manager class similar to Gmail but adapted for Outlook
class OutlookNotesManager {
  constructor() {
    this.currentThreadId = null;
    this.currentAccount = null;
    this.notesPanel = null;
    this.notesButton = null;
  }

  async handleThreadChange(threadId, account) {
    this.currentThreadId = threadId;
    this.currentAccount = account;
    
    console.log('Outlook: Handling thread change to:', threadId, 'for account:', account);
    
    // Create or update notes button
    this.createNotesButton();
    
    // Check if this thread has existing notes and auto-open if it does
    const existingNote = await this.loadNote(threadId);
    if (existingNote && existingNote.content.trim()) {
      console.log('Outlook: Thread has existing notes, auto-opening panel');
      setTimeout(() => this.showNotesPanel(), 500);
    }
  }

  createNotesButton() {
    // Remove existing button
    const existingButton = document.querySelector('.outlook-notes-button');
    if (existingButton) {
      existingButton.remove();
    }

    // Try to find a good location for the notes button in Outlook's interface
    const buttonContainer = this.findButtonContainer();
    if (!buttonContainer) {
      console.log('Could not find suitable button container in Outlook');
      return;
    }

    this.notesButton = document.createElement('button');
    this.notesButton.className = 'outlook-notes-button';
    this.notesButton.innerHTML = '📝 Notes';
    this.notesButton.title = 'Add private notes to this conversation';
    
    // Style the button to match Outlook's design
    this.notesButton.style.cssText = `
      background: #0078d4;
      color: white;
      border: none;
      border-radius: 2px;
      padding: 8px 12px;
      font-size: 14px;
      cursor: pointer;
      margin: 4px;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      z-index: 1000;
      position: relative;
    `;

    // Hover effects
    this.notesButton.addEventListener('mouseenter', () => {
      this.notesButton.style.backgroundColor = '#106ebe';
    });

    this.notesButton.addEventListener('mouseleave', () => {
      this.notesButton.style.backgroundColor = '#0078d4';
    });

    this.notesButton.addEventListener('click', () => {
      console.log('Outlook notes button clicked');
      this.showNotesPanel();
    });

    buttonContainer.appendChild(this.notesButton);
  }

  findButtonContainer() {
    // Try various Outlook interface locations for the notes button
    const selectors = [
      '.ms-CommandBar',
      '[role="toolbar"]',
      '.ms-MessageHeader',
      '.ms-ConversationHeader .ms-CommandBar',
      '.message-actions',
      '.toolbar-container'
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container) {
        console.log('Found button container:', selector);
        return container;
      }
    }

    return null;
  }

  async showNotesPanel() {
    console.log('Outlook: Showing notes panel for thread:', this.currentThreadId);
    
    // Create notes panel if it doesn't exist
    if (!this.notesPanel) {
      this.createNotesPanel();
    }

    // Update thread subject
    const threadSubject = this.notesPanel.querySelector('.thread-subject');
    if (threadSubject) {
      const subject = this.getCurrentThreadSubject();
      threadSubject.textContent = subject || 'Outlook Conversation';
      threadSubject.title = subject || 'No subject available';
    }

    // Load existing note
    const existingNote = await this.loadNote(this.currentThreadId);
    
    const textarea = this.notesPanel.querySelector('.notes-textarea');
    const lastUpdated = this.notesPanel.querySelector('.last-updated');
    const statusText = this.notesPanel.querySelector('.status-text');
    const statusIndicator = this.notesPanel.querySelector('.status-indicator');
    
    if (textarea) textarea.value = existingNote ? existingNote.content : '';
    
    // Update last modified display
    if (lastUpdated && existingNote) {
      const lastMod = new Date(existingNote.lastModified || existingNote.timestamp);
      lastUpdated.textContent = `Last updated: ${this.formatTimestamp(lastMod)}`;
      lastUpdated.style.display = 'block';
    } else if (lastUpdated) {
      lastUpdated.style.display = 'none';
    }

    // Show panel
    this.notesPanel.style.display = 'flex';
    this.notesPanel.classList.add('visible');
    
    // Focus textarea
    if (textarea) {
      setTimeout(() => textarea.focus(), 100);
    }

    console.log('Outlook notes panel shown');
  }

  createNotesPanel() {
    this.notesPanel = document.createElement('div');
    this.notesPanel.className = 'notes-panel outlook-notes-panel';
    this.notesPanel.innerHTML = `
      <div class="notes-header">
        <div class="notes-title-section">
          <h3>📝 Notes</h3>
          <div class="thread-subject" title="Thread subject">Loading...</div>
        </div>
        <div class="notes-header-actions">
          <button class="notes-delete" title="Delete this note">🗑️</button>
          <button class="notes-close">×</button>
        </div>
      </div>
      <textarea class="notes-textarea" placeholder="Add your private notes..."></textarea>
      <div class="notes-footer">
        <div class="save-status">
          <span class="status-indicator">●</span>
          <span class="status-text">Ready</span>
        </div>
        <div class="last-updated"></div>
      </div>
      <div class="resize-handle" title="Drag to resize"></div>
    `;
    
    // Outlook-specific styling
    this.notesPanel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 50px;
      width: 320px;
      height: 420px;
      background: white;
      border: 1px solid #c8c6c4;
      border-radius: 2px;
      box-shadow: 0 6.4px 14.4px 0 rgba(0,0,0,0.132), 0 1.2px 3.6px 0 rgba(0,0,0,0.108);
      z-index: 10000;
      display: none;
      flex-direction: column;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-width: 280px;
      min-height: 300px;
      overflow: hidden;
    `;

    // Add Outlook-specific styles to header
    const header = this.notesPanel.querySelector('.notes-header');
    if (header) {
      header.style.cssText = `
        padding: 12px 16px;
        background: #f3f2f1;
        border-bottom: 1px solid #c8c6c4;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        cursor: move;
        user-select: none;
      `;
    }

    // Style textarea for Outlook
    const textarea = this.notesPanel.querySelector('.notes-textarea');
    if (textarea) {
      textarea.style.cssText = `
        flex: 1;
        border: none;
        padding: 16px;
        font-size: 14px;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        resize: none;
        outline: none;
        background: white;
      `;
    }

    // Style footer
    const footer = this.notesPanel.querySelector('.notes-footer');
    if (footer) {
      footer.style.cssText = `
        padding: 8px 16px;
        background: #faf9f8;
        border-top: 1px solid #edebe9;
        display: flex;
        justify-content: space-between;
        align-items: center;
        font-size: 12px;
        color: #605e5c;
      `;
    }

    // Add event listeners
    this.setupEventListeners();
    
    // Append to body
    document.body.appendChild(this.notesPanel);
  }

  setupEventListeners() {
    const closeBtn = this.notesPanel.querySelector('.notes-close');
    const deleteBtn = this.notesPanel.querySelector('.notes-delete');
    const textarea = this.notesPanel.querySelector('.notes-textarea');

    // Close button
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.hideNotesPanel();
    });

    // Delete button
    deleteBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await this.deleteCurrentNote();
    });

    // Delete button hover effects
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.backgroundColor = '#fde7e9';
      deleteBtn.style.color = '#d13438';
    });

    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.backgroundColor = 'transparent';
      deleteBtn.style.color = '#605e5c';
    });

    // Click outside to close
    const handleClickOutside = (e) => {
      if (this.notesPanel && 
          this.notesPanel.classList.contains('visible') && 
          !this.notesPanel.contains(e.target) &&
          !e.target.closest('.outlook-notes-button')) {
        this.hideNotesPanel();
      }
    };
    document.addEventListener('click', handleClickOutside);

    // Prevent panel clicks from bubbling
    this.notesPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });

    // Add dragging and resizing
    this.setupPanelDragging();
    this.setupPanelResizing();

    // Auto-save functionality
    let saveTimeout;
    textarea.addEventListener('input', () => {
      // Show typing indicator
      const statusIndicator = this.notesPanel.querySelector('.status-indicator');
      const statusText = this.notesPanel.querySelector('.status-text');
      
      if (statusIndicator) statusIndicator.style.color = '#0078d4';
      if (statusText) statusText.textContent = 'Typing...';

      // Clear existing timeout
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }

      // Set new timeout for auto-save
      saveTimeout = setTimeout(async () => {
        await this.saveNote(textarea.value);
        // Trigger debounced backup to disk after saving
        chrome.runtime.sendMessage({ action: 'triggerDebouncedBackup' });
      }, 1000);
    });
  }

  setupPanelDragging() {
    const header = this.notesPanel.querySelector('.notes-header');
    if (!header) return;

    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      
      isDragging = true;
      this.notesPanel.classList.add('dragging');
      
      const rect = this.notesPanel.getBoundingClientRect();
      dragOffset.x = e.clientX - rect.left;
      dragOffset.y = e.clientY - rect.top;
      
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;
      
      const maxX = window.innerWidth - this.notesPanel.offsetWidth;
      const maxY = window.innerHeight - this.notesPanel.offsetHeight;
      
      const clampedX = Math.max(0, Math.min(newX, maxX));
      const clampedY = Math.max(0, Math.min(newY, maxY));
      
      this.notesPanel.style.left = clampedX + 'px';
      this.notesPanel.style.top = clampedY + 'px';
      this.notesPanel.style.right = 'auto';
      
      e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        this.notesPanel.classList.remove('dragging');
      }
    });
  }

  setupPanelResizing() {
    const resizeHandle = this.notesPanel.querySelector('.resize-handle');
    if (!resizeHandle) return;

    resizeHandle.style.cssText = `
      position: absolute;
      bottom: 0;
      right: 0;
      width: 16px;
      height: 16px;
      cursor: se-resize;
      background: linear-gradient(-45deg, transparent 30%, #c8c6c4 30%, #c8c6c4 40%, transparent 40%, transparent 50%, #c8c6c4 50%, #c8c6c4 60%, transparent 60%);
    `;

    let isResizing = false;
    let startSize = { width: 0, height: 0 };
    let startMouse = { x: 0, y: 0 };

    resizeHandle.addEventListener('mousedown', (e) => {
      isResizing = true;
      this.notesPanel.classList.add('resizing');
      
      startSize.width = parseInt(getComputedStyle(this.notesPanel).width, 10);
      startSize.height = parseInt(getComputedStyle(this.notesPanel).height, 10);
      startMouse.x = e.clientX;
      startMouse.y = e.clientY;
      
      e.preventDefault();
      e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startMouse.x;
      const deltaY = e.clientY - startMouse.y;
      
      const newWidth = Math.max(280, startSize.width + deltaX);
      const newHeight = Math.max(300, startSize.height + deltaY);
      
      this.notesPanel.style.width = newWidth + 'px';
      this.notesPanel.style.height = newHeight + 'px';
      
      e.preventDefault();
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        this.notesPanel.classList.remove('resizing');
      }
    });
  }

  async saveNote(content) {
    if (!this.currentThreadId) return;

    try {
      const accountSpecificThreadId = `${this.currentAccount}_${this.currentThreadId}`;
      const subject = this.getCurrentThreadSubject();
      
      const response = await chrome.runtime.sendMessage({
        action: 'saveNote',
        threadId: accountSpecificThreadId,
        content: content,
        platform: 'outlook',
        account: this.currentAccount,
        subject: subject,
        accountEmail: this.currentAccount.includes('@') ? this.currentAccount : null
      });

      // Update UI status
      const statusIndicator = this.notesPanel.querySelector('.status-indicator');
      const statusText = this.notesPanel.querySelector('.status-text');
      const lastUpdated = this.notesPanel.querySelector('.last-updated');

      if (response.success) {
        if (statusIndicator) statusIndicator.style.color = '#107c10';
        if (statusText) statusText.textContent = 'Saved';
        if (lastUpdated) {
          lastUpdated.textContent = `Last updated: ${this.formatTimestamp(new Date())}`;
          lastUpdated.style.display = 'block';
        }

        // Reset status after 2 seconds
        setTimeout(() => {
          if (statusIndicator) statusIndicator.style.color = '#605e5c';
          if (statusText) statusText.textContent = 'Ready';
        }, 2000);
      } else {
        if (statusIndicator) statusIndicator.style.color = '#d13438';
        if (statusText) statusText.textContent = 'Error';
      }
    } catch (error) {
      console.error('Error saving Outlook note:', error);
    }
  }

  async deleteCurrentNote() {
    if (!this.currentThreadId) return;

    const confirmed = confirm('Delete this note? This action cannot be undone.');
    if (!confirmed) return;

    try {
      const accountSpecificThreadId = `${this.currentAccount}_${this.currentThreadId}`;
      const response = await chrome.runtime.sendMessage({
        action: 'deleteNote',
        threadId: accountSpecificThreadId
      });

      if (response.success) {
        // Clear textarea
        const textarea = this.notesPanel.querySelector('.notes-textarea');
        if (textarea) textarea.value = '';

        // Update status
        const statusText = this.notesPanel.querySelector('.status-text');
        const lastUpdated = this.notesPanel.querySelector('.last-updated');
        
        if (statusText) statusText.textContent = 'Deleted';
        if (lastUpdated) lastUpdated.style.display = 'none';

        // Hide panel after short delay
        setTimeout(() => {
          this.hideNotesPanel();
        }, 1000);
      }
    } catch (error) {
      console.error('Error deleting Outlook note:', error);
    }
  }

  getCurrentThreadSubject() {
    const selectors = [
      '.ms-MessageHeader-subject',
      '[data-testid="message-subject"]',
      '.subject-text',
      '.ms-ConversationHeader h2',
      '[role="heading"] span',
      'h1[data-testid="subject-text"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        return element.textContent.trim();
      }
    }

    return 'Outlook Conversation';
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

  hideNotesPanel() {
    if (this.notesPanel) {
      this.notesPanel.style.display = 'none';
    }
  }

  async loadNote(threadId) {
    if (!threadId) return null;
    
    try {
      const accountSpecificThreadId = `${this.currentAccount}_${threadId}`;
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId: accountSpecificThreadId
      });
      
      return response.note;
    } catch (error) {
      console.error('Error loading Outlook note:', error);
      return null;
    }
  }
}

// Initialize when on Outlook
if (window.location.href.includes('outlook.office365.com') || 
    window.location.href.includes('outlook.live.com')) {
  
  // Wait for Outlook interface to load
  setTimeout(() => {
    new OutlookThreadDetector();
  }, 2000);
}