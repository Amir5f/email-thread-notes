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
    
    // Add floating "All Notes" button
    this.addFloatingButton();
    
    // Listen for extension toggle
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'toggleExtension') {
        this.extensionEnabled = request.enabled;
        if (this.extensionEnabled) {
          this.startThreadDetection();
          this.addFloatingButton();
        } else {
          this.stopThreadDetection();
          this.notesManager?.hideNotesPanel();
          this.removeFloatingButton();
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
    const urlMatch = window.location.href.match(/outlook\.(office365|office)\.com\/mail\/([^\/]+)/) || 
                     window.location.href.match(/outlook\.live\.com\/mail\/([^\/]+)/);
    if (urlMatch) {
      const accountId = urlMatch[2] || urlMatch[1]; // Handle different capture groups
      this.currentAccount = `outlook_${accountId}`;
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
      console.log('Outlook: Thread changed:', this.currentThreadId, '->', threadId);
      this.currentThreadId = threadId;
      
      if (this.notesManager) {
        this.notesManager.handleThreadChange(threadId, this.currentAccount);
      } else {
        console.log('Outlook: ERROR - notesManager is null!');
      }
    } else if (!threadId && !this.currentThreadId) {
      // Only log once when no thread is found
      console.log('Outlook: No thread ID found - may need to wait for page to load');
    }
  }

  extractThreadId() {
    // Method 1: From URL
    const urlPatterns = [
      // Original patterns
      /\/mail\/id\/([A-Za-z0-9%\-_\.]+)/,
      /\/mail\/.*?id=([A-Za-z0-9%\-_\.]+)/,
      /conversationId=([A-Za-z0-9%\-_\.]+)/,
      
      // Additional patterns for outlook.office.com
      /\/mail\/inbox\/id\/([A-Za-z0-9%\-_\.]+)/,
      /\/mail\/.*\/id\/([A-Za-z0-9%\-_\.]+)/,
      /\/id\/([A-Za-z0-9%\-_\.]+)/,
      /#id=([A-Za-z0-9%\-_\.]+)/,
      /messageId=([A-Za-z0-9%\-_\.]+)/,
      /threadId=([A-Za-z0-9%\-_\.]+)/
    ];

    for (const pattern of urlPatterns) {
      const match = window.location.href.match(pattern);
      if (match) {
        const threadId = decodeURIComponent(match[1]);
        return threadId;
      }
    }

    // Method 2: From DOM attributes
    const domSelectors = [
      '[data-convid]',
      '[data-conversation-id]',
      '[data-thread-id]',
      '[data-message-id]',
      '[aria-label*="Conversation"]',
      '.ms-ConversationHeader',
      '[data-testid="conversation"]',
      '[data-testid="message-list"]'
    ];

    for (const selector of domSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const convId = element.getAttribute('data-convid') || 
                      element.getAttribute('data-conversation-id') || 
                      element.getAttribute('data-thread-id') ||
                      element.getAttribute('data-message-id') ||
                      element.getAttribute('id');
        if (convId) {
          return convId;
        }
      }
    }

    // Method 3: Try to extract from message items
    const messageSelectors = [
      '[role="listitem"][data-message-id]',
      '.ms-MessageItem',
      '[class*="message"]',
      '[data-testid="message"]',
      '[role="article"]'
    ];
    
    for (const selector of messageSelectors) {
      const messageElement = document.querySelector(selector);
      if (messageElement) {
        const messageId = messageElement.getAttribute('data-message-id') || 
                         messageElement.getAttribute('data-thread-id') ||
                         messageElement.getAttribute('id');
        if (messageId) {
          // Use first part of message ID as thread ID
          const threadId = messageId.split('-')[0];
          return threadId;
        }
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

  addFloatingButton() {
    if (document.querySelector('.outlook-all-notes-button') || !this.extensionEnabled) return;

    console.log('Outlook: Adding floating All Notes button');

    const button = document.createElement('div');
    button.className = 'outlook-all-notes-button';
    button.innerHTML = '📝';
    button.title = 'View all your notes';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 56px;
      height: 56px;
      background: #0078d4;
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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    button.addEventListener('mouseenter', () => {
      button.style.backgroundColor = '#106ebe';
    });

    button.addEventListener('mouseleave', () => {
      button.style.backgroundColor = '#0078d4';
    });

    button.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      console.log('Outlook: All Notes button clicked');
      if (this.notesManager) {
        this.notesManager.showAllNotesPanel();
      }
    });

    document.body.appendChild(button);
  }

  removeFloatingButton() {
    const button = document.querySelector('.outlook-all-notes-button');
    if (button) {
      button.remove();
    }
  }

  updateFloatingButtonVisibility() {
    const floatingButton = document.querySelector('.outlook-all-notes-button');
    if (floatingButton) {
      floatingButton.style.display = this.extensionEnabled ? 'flex' : 'none';
      
      // Update button appearance based on context
      if (this.currentThreadId) {
        floatingButton.title = 'View all your notes';
        floatingButton.style.background = '#0078d4';
      } else {
        floatingButton.title = 'View all your notes';
        floatingButton.style.background = '#107c10';
      }
    }
  }
}

// Notes Manager class similar to Gmail but adapted for Outlook
class OutlookNotesManager {
  constructor() {
    this.currentThreadId = null;
    this.currentAccount = null;
    this.notesPanel = null;
    this.notesButton = null;
    this.buttonCreationAttempts = 0;
    this.maxButtonCreationAttempts = 3;
  }

  async handleThreadChange(threadId, account) {
    this.currentThreadId = threadId;
    this.currentAccount = account;
    this.buttonCreationAttempts = 0; // Reset attempts for new thread
    
    console.log('Outlook: Handling thread change to:', threadId, 'for account:', account);
    
    // Create or update notes button
    this.createNotesButton();
    
    // Check if this thread has existing notes (but don't auto-open)
    const existingNote = await this.loadNote(threadId);
    if (existingNote && existingNote.content.trim()) {
      console.log('Outlook: Thread has existing notes (not auto-opening)');
      // TODO: Could add visual indicator that thread has notes
    }
  }

  createNotesButton() {
    console.log('Outlook: Creating notes button...');
    
    // Remove existing button
    const existingButton = document.querySelector('.outlook-notes-button');
    if (existingButton) {
      console.log('Outlook: Removing existing button');
      existingButton.remove();
    }

    // Try to find a good location for the notes button in Outlook's interface
    const buttonContainer = this.findButtonContainer();
    if (!buttonContainer) {
      this.buttonCreationAttempts++;
      console.log(`Outlook: Could not find suitable button container (attempt ${this.buttonCreationAttempts}/${this.maxButtonCreationAttempts})`);
      
      // Try again after a short delay in case the DOM is still loading
      if (this.buttonCreationAttempts < this.maxButtonCreationAttempts) {
        setTimeout(() => {
          console.log('Outlook: Retrying button creation after delay...');
          this.createNotesButton();
        }, 2000);
      } else {
        console.log('Outlook: Max button creation attempts reached, giving up');
      }
      
      return;
    }

    console.log('Outlook: Found button container, creating button...');
    this.buttonCreationAttempts = 0; // Reset attempts on success

    this.notesButton = document.createElement('button');
    this.notesButton.className = 'outlook-notes-button';
    this.notesButton.innerHTML = '📝 Notes';
    this.notesButton.title = 'Add private notes to this conversation';
    
    // Style the button to match Outlook's design with !important to override inheritance
    this.notesButton.style.cssText = `
      background: #0078d4 !important;
      color: white !important;
      border: none !important;
      border-radius: 2px !important;
      padding: 8px 12px !important;
      font-size: 14px !important;
      cursor: pointer !important;
      margin: 4px !important;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 4px !important;
      z-index: 1000 !important;
      position: relative !important;
      width: auto !important;
      height: auto !important;
      min-width: 80px !important;
      min-height: 32px !important;
      max-width: 150px !important;
      max-height: 48px !important;
      flex: none !important;
      flex-grow: 0 !important;
      flex-shrink: 0 !important;
      flex-basis: auto !important;
      white-space: nowrap !important;
      box-sizing: border-box !important;
    `;

    // Hover effects
    this.notesButton.addEventListener('mouseenter', () => {
      this.notesButton.style.setProperty('background-color', '#106ebe', 'important');
    });

    this.notesButton.addEventListener('mouseleave', () => {
      this.notesButton.style.setProperty('background-color', '#0078d4', 'important');
    });

    this.notesButton.addEventListener('click', (e) => {
      console.log('Outlook: Thread Notes button clicked for thread:', this.currentThreadId);
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      this.showNotesPanel();
    });

    buttonContainer.appendChild(this.notesButton);
    
    console.log('Outlook: Button successfully created and appended to container');
    console.log('Outlook: Button element:', this.notesButton);
    console.log('Outlook: Button container:', buttonContainer);
    console.log('Outlook: Button is visible:', this.notesButton.offsetWidth > 0 && this.notesButton.offsetHeight > 0);
    console.log('Outlook: Button computed style visibility:', window.getComputedStyle(this.notesButton).visibility);
    console.log('Outlook: Button computed style display:', window.getComputedStyle(this.notesButton).display);
    console.log('Outlook: Button computed style opacity:', window.getComputedStyle(this.notesButton).opacity);
  }

  findButtonContainer() {
    console.log('Outlook: Searching for button container...');
    
    // Try various Outlook interface locations for the notes button
    // Prioritize thread-specific toolbars over global ones
    const selectors = [
      // Thread/message-specific toolbars (highest priority)
      '.ms-MessageHeader [role="toolbar"]',
      '.ms-ConversationHeader [role="toolbar"]',
      '[data-testid="message-header"] [role="toolbar"]',
      '[data-testid="conversation-header"] [role="toolbar"]',
      '.thread-item-header [role="toolbar"]',
      '.conversation-header [role="toolbar"]',
      
      // Message/thread containers with toolbars
      '[role="main"] .ms-MessageHeader',
      '[role="main"] .ms-ConversationHeader',
      '[role="main"] [data-testid="message-header"]',
      '[role="main"] [data-testid="conversation-header"]',
      
      // Specific toolbar classes
      '.ms-CommandBar:not([aria-label*="New"])', // Exclude "New Email" toolbar
      '.ms-MessageHeader',
      '.ms-ConversationHeader .ms-CommandBar',
      '.message-actions',
      '.message-header-actions',
      '.thread-header-actions',
      
      // Content area toolbars (avoid left sidebar)
      '[role="main"] [role="toolbar"]:not([aria-label*="New"])',
      'main [role="toolbar"]:not([aria-label*="New"])',
      
      // Fluent UI selectors
      '.fui-CommandBar',
      '.fui-Toolbar',
      '[class*="commandBar"]:not([aria-label*="New"])',
      '[class*="toolbar"]:not([aria-label*="New"])',
      '[class*="header-actions"]',
      
      // Additional selectors for outlook.office.com split-view
      '[data-testid="toolbar"]:not([aria-label*="New"])',
      '.toolbar-container'
    ];

    console.log('Outlook: Trying', selectors.length, 'selectors...');
    
    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container) {
        // Additional validation to avoid wrong containers
        const containerText = container.textContent || '';
        const containerLabel = container.getAttribute('aria-label') || '';
        
        // Skip containers that are likely the "New Email" area, sidebar, or global navigation
        if (containerLabel.includes('New') || 
            containerLabel.includes('Compose') ||
            containerText.includes('New message') || 
            containerText.includes('Compose') ||
            containerText.includes('New email') ||
            container.closest('[role="navigation"]') || // Skip sidebar
            container.closest('.ms-Nav') || // Skip navigation
            container.closest('[data-app-section="MailCompose"]') || // Skip compose area
            container.closest('[aria-label*="New"]') || // Skip New-related areas
            !container.closest('[role="main"]')) { // Must be in main content area
          console.log('Outlook: Skipping container (likely New Email or sidebar):', selector, 'Label:', containerLabel);
          continue;
        }
        
        // Additional check: prefer containers that are closer to thread content
        const isInThreadArea = container.closest('[data-testid="message"]') || 
                              container.closest('[class*="thread"]') ||
                              container.closest('[class*="conversation"]') ||
                              container.querySelector('[data-testid="message"]');
                              
        if (!isInThreadArea && selector.includes('toolbar')) {
          console.log('Outlook: Skipping toolbar not in thread area:', selector);
          continue;
        }
        
        console.log('Outlook: Found button container with selector:', selector);
        console.log('Outlook: Container element:', container);
        console.log('Outlook: Container aria-label:', containerLabel);
        return container;
      }
    }

    // If no specific container found, try to find any visible element that could work
    console.log('Outlook: No specific container found, trying fallback options...');
    
    const fallbacks = [
      'body > div[role="main"]',
      '[role="main"]',
      'main',
      'body > div:first-child'
    ];
    
    for (const selector of fallbacks) {
      const container = document.querySelector(selector);
      if (container) {
        console.log('Outlook: Using fallback container:', selector);
        return container;
      }
    }
    
    console.log('Outlook: No suitable button container found');
    return null;
  }

  async showNotesPanel() {
    console.log('Outlook: Showing notes panel for thread:', this.currentThreadId);
    
    // Create notes panel if it doesn't exist or if it's the wrong type
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
    console.log('Outlook: Searching for thread subject...');
    
    const selectors = [
      // Skip the problematic [role="heading"] span selector and try more specific ones first
      
      // Outlook.office.com specific selectors (try these first)
      'h1[id*="subject"]',
      'h2[id*="subject"]',
      '[id*="subject"] h1',
      '[id*="subject"] h2',
      '[data-testid*="subject"]',
      '[aria-labelledby*="subject"]',
      '[class*="subject"]:not([aria-hidden="true"])',
      
      // Original selectors for outlook.office365.com
      '.ms-MessageHeader-subject',
      '[data-testid="message-subject"]',
      '.subject-text',
      '.ms-ConversationHeader h2',
      'h1[data-testid="subject-text"]',
      
      // Additional selectors for outlook.office.com
      '[data-testid="subject-text"]',
      '[aria-label*="Subject"] span',
      '[aria-label*="Subject"]',
      '.subject',
      'h1[class*="subject"]',
      'h2[class*="subject"]',
      '[class*="Subject"]',
      '[class*="subject-text"]',
      
      // Try content areas first, then fallback to generic
      '[role="main"] h1:not([aria-hidden="true"])',
      '[role="main"] h2:not([aria-hidden="true"])',
      
      // Try message containers
      '[role="main"] [class*="message"] h1',
      '[role="main"] [class*="message"] h2',
      '[role="main"] [class*="thread"] h1',
      '[role="main"] [class*="thread"] h2',
      
      // Fluent UI patterns
      '.fui-Title',
      '[class*="Title"]:not([aria-hidden="true"])',
      '[class*="header"] h1',
      '[class*="header"] h2',
      
      // Last resort - the problematic one, but only after trying others
      '[role="main"] [role="heading"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent ? element.textContent.trim() : '';
        console.log('Outlook: Trying selector:', selector, '-> Element:', element, '-> Text:', `"${text}"`);
        
        // If we find a heading element, explore its siblings and parent for the actual text
        if (selector.includes('heading')) {
          console.log('Outlook: Found heading element, exploring context...');
          const parent = element.parentElement;
          if (parent) {
            console.log('Outlook: Heading parent:', parent);
            const siblings = Array.from(parent.children);
            siblings.forEach((sibling, index) => {
              const siblingText = sibling.textContent ? sibling.textContent.trim() : '';
              console.log(`Outlook: Sibling ${index}:`, sibling, `-> Text: "${siblingText}"`);
            });
            
            // Check if parent has useful text
            const parentText = parent.textContent ? parent.textContent.trim() : '';
            if (parentText && parentText.length > 0 && parentText.length < 200) {
              console.log('Outlook: Found subject in heading parent:', parentText);
              return parentText;
            }
          }
        }
        
        if (text && text.length > 0) {
          console.log('Outlook: Found subject with selector:', selector, '-> Subject:', text);
          return text;
        }
      }
    }

    // Try a more aggressive approach - look for all headings and spans with text
    console.log('Outlook: Trying fallback approach - searching all headings and spans...');
    
    const fallbackSelectors = ['h1', 'h2', 'h3', '[role="heading"]'];
    for (const selector of fallbackSelectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        const text = element.textContent ? element.textContent.trim() : '';
        if (text && text.length > 3 && text.length < 200) {
          // Skip common non-subject text
          if (!text.includes('Outlook') && 
              !text.includes('Microsoft') && 
              !text.includes('Search') &&
              !text.includes('Mail') &&
              !text.includes('Inbox') &&
              !text.includes('Sent') &&
              !text.toLowerCase().includes('new message')) {
            console.log('Outlook: Found potential subject via fallback:', selector, '-> Subject:', text);
            return text;
          }
        }
      }
    }

    // Try looking for subject in specific areas where conversation content appears
    console.log('Outlook: Trying conversation area search...');
    const conversationAreas = [
      '[role="main"]',
      '[data-testid="conversation"]', 
      '[class*="conversation"]',
      '[class*="thread"]',
      '[class*="message"]'
    ];
    
    for (const areaSelector of conversationAreas) {
      const area = document.querySelector(areaSelector);
      if (area) {
        // Look for strong, bold, or prominently displayed text within this area
        const textSelectors = ['strong', 'b', '[style*="font-weight"]', '[class*="bold"]', '[class*="title"]'];
        for (const textSelector of textSelectors) {
          const elements = area.querySelectorAll(textSelector);
          for (const element of elements) {
            const text = element.textContent ? element.textContent.trim() : '';
            if (text && text.length > 5 && text.length < 150) {
              console.log('Outlook: Found potential subject in conversation area:', areaSelector, textSelector, '-> Subject:', text);
              return text;
            }
          }
        }
      }
    }

    // Try to get subject from page title as fallback
    const pageTitle = document.title;
    if (pageTitle && pageTitle !== 'Outlook' && !pageTitle.includes('Microsoft') && pageTitle.length > 0) {
      console.log('Outlook: Using page title as subject:', pageTitle);
      return pageTitle;
    }

    console.log('Outlook: No subject found, using default');
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

  async showAllNotesPanel() {
    // Create or show notes list panel
    if (!this.notesPanel || !this.notesPanel.classList.contains('notes-list-panel')) {
      if (this.notesPanel) {
        this.notesPanel.remove();
      }
      this.createAllNotesPanel();
    }

    // Load and display all notes for current account
    await this.loadAndDisplayNotesList();
    
    this.notesPanel.classList.add('visible');
    this.notesPanel.style.display = 'flex';
  }

  createAllNotesPanel() {
    console.log('Outlook: Creating All Notes panel');
    
    this.notesPanel = document.createElement('div');
    this.notesPanel.className = 'notes-panel notes-list-panel outlook-notes-panel';
    
    const accountDisplay = this.currentAccount && this.currentAccount.includes('@') ? 
                          this.currentAccount : 
                          (this.currentAccount || 'Outlook Account');
    
    this.notesPanel.innerHTML = `
      <div class="notes-header">
        <div class="notes-title-section">
          <h3>📝 All Notes</h3>
          <div class="account-info">Account: ${accountDisplay}</div>
        </div>
        <button class="notes-close">×</button>
      </div>
      <div class="notes-list-content">
        <div class="loading-message">Loading your notes...</div>
      </div>
      <div class="resize-handle" title="Drag to resize"></div>
    `;
    
    // Match Gmail's styling but with Outlook colors
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
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      min-width: 280px;
      min-height: 300px;
      overflow: hidden;
    `;

    // Style the header to match Gmail
    const header = this.notesPanel.querySelector('.notes-header');
    if (header) {
      header.style.cssText = `
        padding: 16px 16px 12px 16px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        background: #f8f9fa;
        border-radius: 8px 8px 0 0;
        cursor: move;
        user-select: none;
      `;
      
      const titleSection = header.querySelector('.notes-title-section');
      if (titleSection) {
        titleSection.style.cssText = `
          flex: 1;
          min-width: 0;
        `;
        
        const titleElement = titleSection.querySelector('h3');
        if (titleElement) {
          titleElement.style.cssText = `
            margin: 0 0 4px 0;
            font-size: 14px;
            font-weight: 500;
            color: #202124;
          `;
        }
        
        const accountInfo = titleSection.querySelector('.account-info');
        if (accountInfo) {
          accountInfo.style.cssText = `
            font-size: 12px;
            color: #5f6368;
            font-weight: 400;
          `;
        }
      }
      
      const closeBtn = header.querySelector('.notes-close');
      if (closeBtn) {
        closeBtn.style.cssText = `
          background: none;
          border: none;
          font-size: 20px;
          cursor: pointer;
          color: #5f6368;
          padding: 4px;
        `;
      }
    }

    // Style the content area to match Gmail
    const content = this.notesPanel.querySelector('.notes-list-content');
    if (content) {
      content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        padding: 0;
      `;
    }

    // Minimal additional styles
    const style = document.createElement('style');
    style.textContent = `
      .outlook-notes-panel .loading-message,
      .outlook-notes-panel .error-message,
      .outlook-notes-panel .empty-notes-message {
        text-align: center;
        padding: 40px 20px;
        font-size: 14px;
        color: #5f6368;
      }
      
      .outlook-notes-panel .error-message {
        color: #d93025;
      }
      
      .outlook-notes-panel .empty-notes-message > div:first-child {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
      }
    `;
    
    if (!document.querySelector('#outlook-notes-styles')) {
      style.id = 'outlook-notes-styles';
      document.head.appendChild(style);
    }

    // Setup event listeners for all notes panel
    this.setupAllNotesEventListeners();
    
    // Append to body
    document.body.appendChild(this.notesPanel);
  }

  setupAllNotesEventListeners() {
    const closeBtn = this.notesPanel.querySelector('.notes-close');
    
    // Close button
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
          !e.target.closest('.outlook-all-notes-button')) {
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
  }

  async loadAndDisplayNotesList() {
    try {
      console.log('Outlook: Loading all notes for display');
      const response = await chrome.runtime.sendMessage({ action: 'getAllNotes' });
      
      if (response.notes) {
        this.displayNotesList(response.notes);
      } else {
        this.displayEmptyNotesList();
      }
    } catch (error) {
      console.error('Outlook: Error loading notes list:', error);
      this.displayErrorMessage('Failed to load notes');
    }
  }

  displayNotesList(allNotes) {
    const content = this.notesPanel.querySelector('.notes-list-content');
    if (!content) return;

    // Filter notes for current account
    const accountNotes = this.filterNotesByCurrentAccount(allNotes);
    const noteEntries = Object.entries(accountNotes);

    if (noteEntries.length === 0) {
      this.displayEmptyNotesList();
      return;
    }

    // Sort by last modified date (newest first) - match Gmail behavior
    noteEntries.sort((a, b) => {
      const dateA = new Date(a[1].lastModified || a[1].timestamp || 0);
      const dateB = new Date(b[1].lastModified || b[1].timestamp || 0);
      return dateB - dateA;
    });

    // Match Gmail's data presentation format
    const notesHtml = noteEntries.map(([threadId, noteData]) => {
      // Use stored subject or try to get current subject if available
      let subject = noteData.subject || 'Outlook Conversation';
      
      // If subject is generic, try to get a better one from stored data
      if (subject === 'Outlook Conversation' && noteData.content) {
        // Try to extract subject from first line of content if it looks like a subject
        const firstLine = noteData.content.split('\n')[0].trim();
        if (firstLine.length > 5 && firstLine.length < 100 && !firstLine.includes('.') && !firstLine.includes(',')) {
          subject = firstLine;
        }
      }
      
      const preview = noteData.content && noteData.content.length > 60 
        ? noteData.content.substring(0, 60) + '...' 
        : (noteData.content || 'No content');
      const timestamp = this.formatTimestamp(new Date(noteData.lastModified || noteData.timestamp));
      
      console.log('Outlook: Note item - ThreadId:', threadId, 'Subject:', subject, 'Stored subject:', noteData.subject);
      
      return `
        <div class="note-item" data-thread-id="${threadId}">
          <div class="note-subject">${this.escapeHtml(subject)}</div>
          <div class="note-preview">${this.escapeHtml(preview)}</div>
          <div class="note-timestamp">${timestamp}</div>
        </div>
      `;
    }).join('');

    // Match Gmail's layout structure
    content.innerHTML = `
      <div class="notes-list-header">
        <div class="notes-count">${noteEntries.length} saved note${noteEntries.length === 1 ? '' : 's'}</div>
      </div>
      <div class="notes-items">
        ${notesHtml}
      </div>
    `;

    // Style to match Gmail exactly
    const listHeader = content.querySelector('.notes-list-header');
    if (listHeader) {
      listHeader.style.cssText = `
        padding: 12px 15px;
        border-bottom: 1px solid #f1f3f4;
        background: #fafbfc;
        font-size: 12px;
        color: #5f6368;
        font-weight: 500;
      `;
    }

    const notesItems = content.querySelector('.notes-items');
    if (notesItems) {
      notesItems.style.cssText = `
        max-height: 300px;
        overflow-y: auto;
      `;
    }

    // Style individual note items to match Gmail
    content.querySelectorAll('.note-item').forEach(item => {
      item.style.cssText = `
        padding: 12px 15px;
        border-bottom: 1px solid #f1f3f4;
        cursor: pointer;
        transition: background-color 0.2s;
        position: relative;
      `;
      
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = '#f8f9fa';
      });
      
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'white';
      });
      
      item.addEventListener('click', () => {
        const threadId = item.getAttribute('data-thread-id');
        this.openNoteFromList(threadId);
      });
    });

    // Style note content elements to match Gmail
    content.querySelectorAll('.note-subject').forEach(subject => {
      subject.style.cssText = `
        font-size: 13px;
        font-weight: 400;
        color: #202124;
        line-height: 1.3;
        margin-bottom: 2px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
    });

    content.querySelectorAll('.note-preview').forEach(preview => {
      preview.style.cssText = `
        font-size: 12px;
        color: #5f6368;
        line-height: 1.4;
        margin-bottom: 4px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      `;
    });

    content.querySelectorAll('.note-timestamp').forEach(timestamp => {
      timestamp.style.cssText = `
        font-size: 11px;
        color: #80868b;
        line-height: 1.2;
      `;
    });
  }

  filterNotesByCurrentAccount(notes) {
    const filtered = {};
    
    for (const [threadId, noteData] of Object.entries(notes)) {
      // Filter by platform and account
      if (noteData.platform === 'outlook') {
        // Check if the threadId contains our current account prefix
        if (threadId.startsWith(`${this.currentAccount}_`) || 
            noteData.account === this.currentAccount || 
            noteData.accountEmail === this.currentAccount) {
          filtered[threadId] = noteData;
        }
      }
    }
    
    return filtered;
  }

  displayEmptyNotesList() {
    const content = this.notesPanel.querySelector('.notes-list-content');
    if (content) {
      content.innerHTML = `
        <div class="notes-list-header">
          <div class="notes-count">0 saved notes</div>
        </div>
        <div class="empty-notes-message">
          <div>📝</div>
          <div>No notes found for this account</div>
          <div style="margin-top: 8px; font-size: 12px; opacity: 0.8;">Notes will appear here as you create them in email threads</div>
        </div>
      `;

      // Style the header consistently
      const listHeader = content.querySelector('.notes-list-header');
      if (listHeader) {
        listHeader.style.cssText = `
          padding: 12px 15px;
          border-bottom: 1px solid #f1f3f4;
          background: #fafbfc;
          font-size: 12px;
          color: #5f6368;
          font-weight: 500;
        `;
      }
    }
  }

  displayErrorMessage(message) {
    const content = this.notesPanel.querySelector('.notes-list-content');
    if (content) {
      content.innerHTML = `<div class="error-message">⚠️ ${message}</div>`;
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async openNoteFromList(threadId) {
    // This would ideally navigate to the thread, but for now just close the list
    console.log('Outlook: Opening note for thread:', threadId);
    this.hideNotesPanel();
    // TODO: Navigate to the specific thread in Outlook (complex due to URL structure)
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
    window.location.href.includes('outlook.office.com') ||
    window.location.href.includes('outlook.live.com')) {
  
  // Wait for Outlook interface to load
  setTimeout(() => {
    new OutlookThreadDetector();
  }, 2000);
}