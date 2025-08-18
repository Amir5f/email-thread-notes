// Sidebar script for Email Thread Notes extension
class EmailNotesSidebar {
  constructor() {
    this.currentThreadId = null;
    this.currentPlatform = null;
    this.currentView = 'all'; // 'thread' or 'all'
    this.saveTimeout = null;
    this.init();
  }

  async init() {
    console.log('Email Notes Sidebar initialized');
    
    // Set up UI event listeners
    this.setupEventListeners();
    
    // Initial load
    await this.loadInitialState();
    
    // Listen for thread updates from content scripts
    this.setupMessageListener();
    
    // Request current thread info from active tab
    this.requestCurrentThreadInfo();
  }

  setupEventListeners() {
    // Button click handlers
    document.getElementById('threadNotesBtn').addEventListener('click', () => {
      this.switchToThreadView();
    });

    document.getElementById('allNotesBtn').addEventListener('click', () => {
      this.switchToAllNotesView();
    });

    // Textarea input handler for auto-save and RTL detection
    const textarea = document.getElementById('notesTextarea');
    textarea.addEventListener('input', () => {
      this.handleNotesInput();
      this.detectAndSetTextDirection(textarea);
    });

    // Save button handler
    const saveBtn = document.getElementById('saveNoteBtn');
    saveBtn.addEventListener('click', () => {
      this.saveCurrentNoteImmediately();
    });

    // Delete button handler
    const deleteBtn = document.getElementById('deleteNoteBtn');
    deleteBtn.addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    // Search and filter handlers for All Notes view
    const searchInput = document.getElementById('notesSearchInput');
    const sortFilter = document.getElementById('sortFilter');

    searchInput.addEventListener('input', () => {
      this.filterAndDisplayNotes();
    });

    sortFilter.addEventListener('change', () => {
      this.filterAndDisplayNotes();
    });

    // Handle window focus to refresh current thread and notes
    window.addEventListener('focus', () => {
      console.log('Sidebar gained focus, refreshing current state');
      this.requestCurrentThreadInfo();
      
      // Also refresh All Notes if we're in that view
      if (this.currentView === 'all' && this.allNotes) {
        this.loadAllNotesView();
      }
    });

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup critical save triggers
    this.setupSaveTriggers();
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S to save (prevent default browser save)
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (this.currentView === 'thread' && this.currentThreadId) {
          this.saveCurrentNoteImmediately();
        }
      }

      // Ctrl/Cmd + F to focus search (when in All Notes view)
      if ((e.ctrlKey || e.metaKey) && e.key === 'f' && this.currentView === 'all') {
        e.preventDefault();
        const searchInput = document.getElementById('notesSearchInput');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }

      // Rich text formatting shortcuts when textarea is focused
      const textarea = document.getElementById('notesTextarea');
      if (textarea && e.target === textarea) {
        this.handleFormattingShortcuts(e, textarea);
      }

      // Escape to clear search
      if (e.key === 'Escape') {
        const searchInput = document.getElementById('notesSearchInput');
        if (searchInput && searchInput === document.activeElement) {
          searchInput.value = '';
          this.filterAndDisplayNotes();
          searchInput.blur();
        }
      }
    });
  }

  setupSaveTriggers() {
    // Save immediately before window/tab close
    window.addEventListener('beforeunload', () => {
      if (this.hasPendingChanges()) {
        this.saveCurrentNoteImmediately();
      }
    });

    // Save when page visibility changes (tab switch, minimize, etc.)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden' && this.hasPendingChanges()) {
        this.saveCurrentNoteImmediately();
      }
    });

    // Save when user clicks outside the textarea (loses focus)
    document.addEventListener('click', (e) => {
      const textarea = document.getElementById('notesTextarea');
      if (textarea && e.target !== textarea && this.hasPendingChanges()) {
        this.saveCurrentNoteImmediately();
      }
    });
  }

  hasPendingChanges() {
    return this.currentThreadId && 
           this.currentView === 'thread' && 
           (this.saveTimeout || this.typingTimeout);
  }

  saveCurrentNoteImmediately() {
    // Clear any pending timeouts
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
      this.saveTimeout = null;
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
      this.typingTimeout = null;
    }
    
    // Save immediately
    this.saveCurrentNote();
  }

  setupMessageListener() {
    // Listen for messages from content scripts
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'threadChanged') {
        console.log('Sidebar: Thread changed', message);
        this.handleThreadChange(message.threadId, message.platform, message.subject, message.account, message.accountEmail);
        sendResponse({ success: true });
      } else if (message.action === 'platformChanged') {
        console.log('Sidebar: Platform changed', message);
        this.handlePlatformChange(message.platform, message.account, message.accountEmail);
        sendResponse({ success: true });
      }
      // Return true to keep message channel open for async response
      return true;
    });
  }

  async requestCurrentThreadInfo() {
    try {
      // Get the active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!activeTab) {
        this.handleNoThread();
        return;
      }

      // Check if we're on a supported email domain (safe check)
      const supportedDomains = [
        'mail.google.com',
        'outlook.office365.com', 
        'outlook.office.com',
        'outlook.live.com'
      ];
      
      let isEmailDomain = false;
      if (activeTab.url) {
        try {
          const url = new URL(activeTab.url);
          isEmailDomain = supportedDomains.some(domain => url.hostname === domain);
        } catch (urlError) {
          console.log('Could not parse URL, treating as non-email domain');
          isEmailDomain = false;
        }
      }
      
      if (isEmailDomain) {
        // Send message to content script to get current thread info
        chrome.tabs.sendMessage(activeTab.id, { action: 'getCurrentThread' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('No content script response:', chrome.runtime.lastError.message);
            this.handleNoThread();
            return;
          }
          
          if (response && response.threadId) {
            this.handleThreadChange(response.threadId, response.platform, response.subject);
          } else {
            this.handleNoThread();
          }
        });
        
        // Update platform indicator
        const platform = url.hostname === 'mail.google.com' ? 'Gmail' : 'Outlook';
        this.handlePlatformChange(platform);
      } else {
        this.handleNoThread();
      }
    } catch (error) {
      console.error('Error requesting current thread info:', error);
      this.handleNoThread();
    }
  }

  async loadInitialState() {
    // Load all notes for the All Notes view
    await this.loadAllNotesView();
    
    // Show the All Notes view by default
    this.switchToAllNotesView();
  }

  handleThreadChange(threadId, platform, subject, account, accountEmail) {
    const wasThreadView = this.currentView === 'thread';
    const previousThreadId = this.currentThreadId;
    
    // Save any pending changes from previous thread
    if (previousThreadId && previousThreadId !== threadId && this.hasPendingChanges()) {
      console.log('Thread changing, saving pending changes for:', previousThreadId);
      this.saveCurrentNoteImmediately();
    }
    
    this.currentThreadId = threadId;
    this.currentPlatform = platform;
    this.currentAccount = account;
    this.currentAccountEmail = accountEmail;
    
    if (threadId) {
      // Update thread info display
      this.updateThreadInfo(threadId, platform, subject, account, accountEmail);
      
      // Enable Thread Notes button
      const threadBtn = document.getElementById('threadNotesBtn');
      threadBtn.disabled = false;
      
      // Auto-switch to thread view when entering any thread
      if (threadId !== previousThreadId) {
        this.switchToThreadView();
      } else if (this.currentView === 'thread') {
        // Reload notes if already in thread view
        this.loadThreadNotes();
      }
    } else {
      // No thread - handle accordingly
      this.handleNoThread();
    }
  }


  handlePlatformChange(platform, account, accountEmail) {
    const previousPlatform = this.currentPlatform;
    const previousAccount = this.currentAccount;
    
    this.currentPlatform = platform;
    this.currentAccount = account;
    this.currentAccountEmail = accountEmail;
    
    // Update platform indicator
    const indicator = document.getElementById('platformIndicator');
    indicator.textContent = platform;
    indicator.style.display = 'inline-block';
    
    // If platform or account changed, refresh All Notes view immediately
    if ((previousPlatform !== platform || previousAccount !== account) && this.allNotes) {
      console.log('Platform/account changed, refreshing All Notes view');
      this.loadAllNotesView();
    }
  }

  async handleNoThread() {
    this.currentThreadId = null;
    
    // Disable Thread Notes button
    const threadBtn = document.getElementById('threadNotesBtn');
    threadBtn.disabled = true;
    
    // Switch to All Notes view if we were in Thread view
    if (this.currentView === 'thread') {
      this.switchToAllNotesView();
    }
    
    // Check if we're on an email domain before showing the message
    const indicator = document.getElementById('platformIndicator');
    
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (activeTab && activeTab.url) {
        const supportedDomains = [
          'mail.google.com',
          'outlook.office365.com', 
          'outlook.office.com',
          'outlook.live.com'
        ];
        
        try {
          const url = new URL(activeTab.url);
          const isEmailDomain = supportedDomains.some(domain => url.hostname === domain);
          
          if (isEmailDomain) {
            // On email domain but no thread - hide indicator
            indicator.style.display = 'none';
          } else {
            // On non-email domain - show helpful message
            indicator.textContent = 'Visit Gmail or Outlook to add thread notes';
            indicator.style.display = 'block';
            indicator.style.background = '#fff3cd';
            indicator.style.color = '#856404';
          }
        } catch (urlError) {
          // Can't parse URL - assume non-email domain
          indicator.textContent = 'Visit Gmail or Outlook to add thread notes';
          indicator.style.display = 'block';
          indicator.style.background = '#fff3cd';
          indicator.style.color = '#856404';
        }
      } else {
        // No tab info - show general message
        indicator.textContent = 'Visit Gmail or Outlook to add thread notes';
        indicator.style.display = 'block';
        indicator.style.background = '#fff3cd';
        indicator.style.color = '#856404';
      }
    } catch (error) {
      // Error getting tab info - hide indicator
      indicator.style.display = 'none';
    }
  }

  updateThreadInfo(threadId, platform, subject, account, accountEmail) {
    const threadInfo = document.getElementById('threadInfo');
    const threadSubject = document.getElementById('threadSubject');
    const threadDetails = document.getElementById('threadDetails');
    
    threadSubject.textContent = subject || 'Email Thread';
    
    // Show account email if available, otherwise show platform + thread ID
    const accountDisplay = accountEmail || `Thread: ${threadId.substring(0, 8)}...`;
    threadDetails.textContent = `${platform} • ${accountDisplay}`;
    threadInfo.style.display = 'block';
  }

  switchToThreadView() {
    if (!this.currentThreadId) {
      // Can't switch to thread view without a thread
      return;
    }
    
    this.currentView = 'thread';
    
    // Update button states
    document.getElementById('threadNotesBtn').classList.add('active');
    document.getElementById('allNotesBtn').classList.remove('active');
    
    // Show thread notes view
    document.getElementById('threadNotesView').classList.add('active');
    document.getElementById('allNotesView').classList.remove('active');
    document.getElementById('noThreadView').classList.remove('active');
    
    // Load notes for current thread
    this.loadThreadNotes();
  }

  switchToAllNotesView() {
    // Save any pending changes before switching views
    if (this.hasPendingChanges()) {
      this.saveCurrentNoteImmediately();
    }
    
    this.currentView = 'all';
    
    // Update button states
    document.getElementById('threadNotesBtn').classList.remove('active');
    document.getElementById('allNotesBtn').classList.add('active');
    
    // Show all notes view
    document.getElementById('threadNotesView').classList.remove('active');
    document.getElementById('allNotesView').classList.add('active');
    document.getElementById('noThreadView').classList.remove('active');
    
    // Refresh all notes
    this.loadAllNotesView();
  }

  async loadThreadNotes() {
    if (!this.currentThreadId) return;
    
    try {
      // Show loading state
      this.updateSaveStatus('loading', 'Loading...');
      
      // Get note for current thread
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId: this.currentThreadId
      });
      
      const textarea = document.getElementById('notesTextarea');
      const lastUpdated = document.getElementById('lastUpdated');
      
      if (response.note) {
        textarea.value = response.note.content || '';
        if (response.note.lastModified) {
          lastUpdated.textContent = this.formatTimestamp(new Date(response.note.lastModified));
        }
        this.updateSaveStatus('saved', 'Saved');
        
        // Auto-switch to ready state after showing saved briefly
        setTimeout(() => {
          this.updateSaveStatus('ready', 'Ready');
        }, 1000);
      } else {
        textarea.value = '';
        lastUpdated.textContent = '';
        this.updateSaveStatus('ready', 'Ready');
      }
      
      // Detect and set text direction for loaded content
      this.detectAndSetTextDirection(textarea);
      
      // Focus textarea
      setTimeout(() => textarea.focus(), 100);
      
    } catch (error) {
      console.error('Error loading thread notes:', error);
      this.updateSaveStatus('error', 'Load failed');
      setTimeout(() => {
        this.updateSaveStatus('ready', 'Ready');
      }, 3000);
    }
  }

  async loadAllNotesView() {
    try {
      const notesContent = document.querySelector('#allNotesView .notes-content');
      
      // Show loading in content area only
      notesContent.innerHTML = `
        <div class="loading-state">
          <div class="loading-spinner"></div>
          <div>Loading your notes...</div>
        </div>
      `;
      
      // Get all notes
      const response = await chrome.runtime.sendMessage({ action: 'getAllNotes' });
      
      if (!response.notes || Object.keys(response.notes).length === 0) {
        this.allNotes = [];
        this.showEmptyAllNotesState();
        return;
      }
      
      // Store all notes for filtering
      this.allNotes = Object.entries(response.notes);
      
      // Apply current filters and display
      this.filterAndDisplayNotes();
      
    } catch (error) {
      console.error('Error loading all notes:', error);
      this.showErrorAllNotesState();
    }
  }

  filterAndDisplayNotes() {
    if (!this.allNotes || this.allNotes.length === 0) {
      this.showEmptyAllNotesState();
      return;
    }

    // Get current filter values
    const searchTerm = document.getElementById('notesSearchInput').value.toLowerCase();
    const sortFilter = document.getElementById('sortFilter').value;
    
    // Determine current platform for filtering
    const currentPlatform = this.currentPlatform ? this.currentPlatform.toLowerCase() : null;

    // Filter notes
    let filteredNotes = this.allNotes.filter(([threadId, noteData]) => {
      // Platform filter - only show notes for current platform
      if (currentPlatform && noteData.platform !== currentPlatform) {
        return false;
      }

      // Account filter - only show notes for current account
      if (this.currentAccount && noteData.account !== this.currentAccount) {
        return false;
      }

      // Alternative account filtering using accountEmail if available
      if (this.currentAccountEmail && noteData.accountEmail && 
          noteData.accountEmail !== this.currentAccountEmail) {
        return false;
      }

      // Search filter
      if (searchTerm) {
        const searchableText = [
          noteData.content || '',
          noteData.subject || '',
          noteData.accountEmail || ''
        ].join(' ').toLowerCase();
        
        if (!searchableText.includes(searchTerm)) {
          return false;
        }
      }

      return true;
    });

    // Sort notes
    filteredNotes.sort((a, b) => {
      const [, noteA] = a;
      const [, noteB] = b;

      switch (sortFilter) {
        case 'oldest':
          return (noteA.lastModified || 0) - (noteB.lastModified || 0);
        case 'subject':
          const subjectA = (noteA.subject || 'No Subject').toLowerCase();
          const subjectB = (noteB.subject || 'No Subject').toLowerCase();
          return subjectA.localeCompare(subjectB);
        case 'recent':
        default:
          return (noteB.lastModified || 0) - (noteA.lastModified || 0);
      }
    });

    // Display filtered notes
    if (filteredNotes.length === 0) {
      this.showNoFilterResultsState(searchTerm, currentPlatform);
    } else {
      this.displayAllNotes(filteredNotes);
    }
  }

  showEmptyAllNotesState() {
    const notesContent = document.querySelector('#allNotesView .notes-content');
    notesContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <div class="empty-title">No notes saved yet</div>
        <div class="empty-description">
          Open a Gmail or Outlook conversation and click "Thread Notes" to create your first note.
        </div>
      </div>
    `;
  }

  showErrorAllNotesState() {
    const notesContent = document.querySelector('#allNotesView .notes-content');
    notesContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">Error loading notes</div>
        <div class="empty-description">
          Please try again later.
        </div>
      </div>
    `;
  }

  showNoFilterResultsState(searchTerm, currentPlatform) {
    const notesContent = document.querySelector('#allNotesView .notes-content');
    
    let filterDescription = 'Try adjusting your search.';
    if (searchTerm) {
      filterDescription = `No notes found matching "${searchTerm}".`;
    } else {
      filterDescription = 'No notes found for this email platform.';
    }

    notesContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <div class="empty-title">No notes found</div>
        <div class="empty-description">
          ${filterDescription}
        </div>
      </div>
    `;
  }

  displayAllNotes(noteEntries) {
    const notesContent = document.querySelector('#allNotesView .notes-content');
    
    const notesHtml = noteEntries.map(([threadId, noteData]) => {
      const preview = noteData.content.length > 100 
        ? noteData.content.substring(0, 100) + '...' 
        : noteData.content;
      const timestamp = this.formatTimestamp(new Date(noteData.lastModified || noteData.timestamp));
      const subject = noteData.subject || 'No Subject';
      const platform = noteData.platform || 'gmail';
      
      return `
        <div class="note-item" data-thread-id="${threadId}">
          <div class="note-header">
            <div class="note-subject">${this.escapeHtml(subject)}</div>
            <div class="note-platform">${platform}</div>
          </div>
          <div class="note-preview">${this.escapeHtml(preview)}</div>
          <div class="note-timestamp">${timestamp}</div>
        </div>
      `;
    }).join('');
    
    notesContent.innerHTML = `
      <div class="notes-list-header">
        <div class="notes-count">${noteEntries.length} saved note${noteEntries.length === 1 ? '' : 's'}</div>
      </div>
      <div class="notes-list">
        ${notesHtml}
      </div>
    `;
    
    // Add CSS for notes list
    this.addNotesListStyles();
    
    // Add click handlers for note items
    document.querySelectorAll('.note-item').forEach(item => {
      const clickHandler = () => {
        const threadId = item.getAttribute('data-thread-id');
        this.openThread(threadId);
      };

      const contextHandler = (e) => {
        e.preventDefault();
        this.showNoteContextMenu(e, item);
      };

      item.addEventListener('click', clickHandler);
      item.addEventListener('contextmenu', contextHandler);

      // Store handlers for cleanup if needed
      item._clickHandler = clickHandler;
      item._contextHandler = contextHandler;
    });
  }

  addNotesListStyles() {
    if (document.getElementById('notesListStyles')) return;
    
    const style = document.createElement('style');
    style.id = 'notesListStyles';
    style.textContent = `
      .notes-list-header {
        padding: 12px 0;
        border-bottom: 1px solid #e8eaed;
        margin-bottom: 8px;
      }
      
      .notes-count {
        font-size: 12px;
        color: #5f6368;
        font-weight: 500;
      }
      
      .notes-list {
        flex: 1;
        overflow-y: auto;
        max-height: calc(100vh - 200px);
      }
      
      .note-item {
        padding: 12px;
        border-bottom: 1px solid #f1f3f4;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .note-item:hover {
        background-color: #f8f9fa;
      }
      
      .note-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      
      .note-subject {
        font-weight: 500;
        color: #202124;
        font-size: 13px;
        flex: 1;
        truncate: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }
      
      .note-platform {
        font-size: 10px;
        color: #5f6368;
        background: #e8f0fe;
        padding: 2px 6px;
        border-radius: 8px;
        text-transform: capitalize;
      }
      
      .note-preview {
        color: #5f6368;
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 6px;
      }
      
      .note-timestamp {
        color: #9aa0a6;
        font-size: 11px;
      }
    `;
    
    document.head.appendChild(style);
  }

  async openThread(threadId) {
    // If this is the current thread, just switch to thread view
    if (threadId === this.currentThreadId) {
      this.switchToThreadView();
      return;
    }

    try {
      // Get the note data to determine platform and original thread ID
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId: threadId
      });

      if (!response.note) {
        console.error('Note not found for thread:', threadId);
        return;
      }

      const noteData = response.note;
      const platform = noteData.platform || 'gmail';
      const originalThreadId = noteData.originalThreadId || threadId.split('_').pop();
      
      // Construct the appropriate URL based on platform
      let targetUrl;
      
      if (platform === 'gmail') {
        // Extract account index from threadId if available
        const accountMatch = threadId.match(/gmail_account_(\d+)_/);
        const accountIndex = accountMatch ? accountMatch[1] : '0';
        targetUrl = `https://mail.google.com/mail/u/${accountIndex}/#inbox/${originalThreadId}`;
      } else if (platform === 'outlook') {
        // For Outlook, try to construct the specific thread URL
        // Outlook URLs follow pattern: https://outlook.office365.com/mail/inbox/id/{threadId}
        if (originalThreadId && originalThreadId.length > 10) {
          targetUrl = `https://outlook.office365.com/mail/inbox/id/${originalThreadId}`;
        } else {
          targetUrl = `https://outlook.office365.com/mail/inbox`;
        }
        console.log('Outlook thread URL:', targetUrl);
      }

      console.log('Navigating to thread:', targetUrl);
      
      // Navigate to the thread
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        chrome.tabs.update(activeTab.id, { url: targetUrl });
      }
      
    } catch (error) {
      console.error('Error opening thread:', error);
      alert('Unable to navigate to thread. Please try again.');
    }
  }

  showNoteContextMenu(event, noteItem) {
    // Remove any existing context menu
    const existingMenu = document.querySelector('.note-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    // Create context menu
    const contextMenu = document.createElement('div');
    contextMenu.className = 'note-context-menu';
    contextMenu.innerHTML = `
      <div class="context-menu-item delete-item">
        <span class="menu-icon">🗑️</span>
        <span class="menu-text">Delete Note</span>
      </div>
    `;
    
    contextMenu.style.cssText = `
      position: fixed;
      top: ${event.clientY}px;
      left: ${event.clientX}px;
      background: white;
      border: 1px solid #dadce0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10002;
      font-family: inherit;
      font-size: 13px;
      min-width: 120px;
    `;

    const deleteItem = contextMenu.querySelector('.delete-item');
    deleteItem.style.cssText = `
      padding: 8px 12px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.2s;
    `;

    deleteItem.addEventListener('mouseenter', () => {
      deleteItem.style.backgroundColor = '#fee2e2';
      deleteItem.style.color = '#dc2626';
    });

    deleteItem.addEventListener('mouseleave', () => {
      deleteItem.style.backgroundColor = 'white';
      deleteItem.style.color = 'inherit';
    });

    deleteItem.addEventListener('click', async () => {
      contextMenu.remove();
      await this.deleteNoteFromList(noteItem);
    });

    // Add to page
    document.body.appendChild(contextMenu);

    // Close menu when clicking outside
    const closeMenu = (e) => {
      if (!contextMenu.contains(e.target)) {
        contextMenu.remove();
        document.removeEventListener('click', closeMenu);
      }
    };
    
    // Add listener on next tick to avoid immediate closure
    setTimeout(() => {
      document.addEventListener('click', closeMenu);
    }, 0);
  }

  async deleteNoteFromList(noteItem) {
    const threadId = noteItem.getAttribute('data-thread-id');
    
    if (!threadId) {
      console.error('No thread ID found for note item');
      return;
    }

    // Show confirmation dialog
    const confirmed = confirm('Are you sure you want to delete this note? This action cannot be undone.');
    if (!confirmed) return;

    try {
      console.log('Deleting note with thread ID:', threadId);
      
      const response = await chrome.runtime.sendMessage({
        action: 'deleteNote',
        threadId: threadId
      });

      if (response.success) {
        console.log('Note deleted successfully from list view');
        
        // Remove the item from the list with animation
        noteItem.style.transition = 'all 0.3s ease';
        noteItem.style.opacity = '0';
        noteItem.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
          // Reload all notes to get fresh data
          this.loadAllNotesView();
          
          // Also refresh current thread view if it's the same note
          if (threadId === this.currentThreadId && this.currentView === 'thread') {
            this.loadThreadNotes();
          }
        }, 300);
      } else {
        console.error('Failed to delete note:', response.error);
        alert('Failed to delete note. Please try again.');
      }
    } catch (error) {
      console.error('Error deleting note from list:', error);
      alert('Error deleting note. Please try again.');
    }
  }

  handleNotesInput() {
    if (!this.currentThreadId) return;
    
    this.updateSaveStatus('typing', 'Typing...');
    
    // Clear existing timeouts
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    
    // Set timeout to return to ready state after user stops typing
    this.typingTimeout = setTimeout(() => {
      this.updateSaveStatus('ready', 'Ready');
    }, 2000);
    
    // Set timeout for auto-save (120 seconds to avoid frequent save dialogs)
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentNote();
    }, 120000);
  }

  async saveCurrentNote() {
    if (!this.currentThreadId) return;
    
    const textarea = document.getElementById('notesTextarea');
    const content = textarea.value.trim();
    
    try {
      // Clear typing timeout since we're now saving
      if (this.typingTimeout) {
        clearTimeout(this.typingTimeout);
      }
      
      this.updateSaveStatus('saving', 'Saving...');
      
      // Get current thread subject for storage
      const subject = this.getCurrentThreadSubject();
      
      const response = await chrome.runtime.sendMessage({
        action: 'saveNote',
        threadId: this.currentThreadId,
        content: content,
        platform: this.currentPlatform?.toLowerCase() || 'gmail',
        account: this.currentAccount,
        accountEmail: this.currentAccountEmail,
        subject: subject
      });
      
      if (response.success) {
        this.updateSaveStatus('saved', 'Saved');
        
        // Update last modified timestamp
        const lastUpdated = document.getElementById('lastUpdated');
        lastUpdated.textContent = this.formatTimestamp(new Date());
        
        // Trigger debounced backup
        chrome.runtime.sendMessage({ action: 'triggerDebouncedBackup' });
        
        // Refresh All Notes list if it's loaded
        if (this.allNotes) {
          this.loadAllNotesView();
        }
        
        // Return to ready state after 2 seconds
        setTimeout(() => {
          this.updateSaveStatus('ready', 'Ready');
        }, 2000);
      } else {
        this.updateSaveStatus('error', 'Save failed');
        console.error('Save failed:', response.error);
        setTimeout(() => {
          this.updateSaveStatus('ready', 'Ready');
        }, 3000);
      }
    } catch (error) {
      console.error('Error saving note:', error);
      this.updateSaveStatus('error', 'Save error');
      setTimeout(() => {
        this.updateSaveStatus('ready', 'Ready');
      }, 3000);
    }
  }

  getCurrentThreadSubject() {
    // Get subject from thread info if available
    const threadSubjectElement = document.getElementById('threadSubject');
    if (threadSubjectElement && threadSubjectElement.textContent !== 'Email Thread') {
      return threadSubjectElement.textContent;
    }
    
    // Fallback to requesting from content script
    return null;
  }

  async refreshThreadSubject() {
    if (!this.currentThreadId) return;

    try {
      // Get the active tab
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) return;

      // Request updated subject from content script
      chrome.tabs.sendMessage(activeTab.id, { action: 'getUpdatedSubject' }, (response) => {
        if (chrome.runtime.lastError) {
          console.log('Could not get updated subject:', chrome.runtime.lastError.message);
          return;
        }
        
        if (response && response.subject && response.threadId === this.currentThreadId) {
          // Update the subject display
          const threadSubjectElement = document.getElementById('threadSubject');
          if (threadSubjectElement) {
            threadSubjectElement.textContent = response.subject;
          }
        }
      });
    } catch (error) {
      console.error('Error refreshing thread subject:', error);
    }
  }

  async deleteCurrentNote() {
    if (!this.currentThreadId) return;
    
    // Show confirmation dialog
    const confirmed = confirm('Are you sure you want to delete this note? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      this.updateSaveStatus('saving', 'Deleting...');
      
      const response = await chrome.runtime.sendMessage({
        action: 'deleteNote',
        threadId: this.currentThreadId
      });
      
      if (response.success) {
        // Clear the textarea
        const textarea = document.getElementById('notesTextarea');
        textarea.value = '';
        
        // Clear last updated
        const lastUpdated = document.getElementById('lastUpdated');
        lastUpdated.textContent = '';
        
        this.updateSaveStatus('saved', 'Note deleted');
        
        // Return to ready state after 2 seconds
        setTimeout(() => {
          this.updateSaveStatus('ready', 'Ready');
        }, 2000);
        
        // Refresh all notes view if it's currently shown
        if (this.currentView === 'all') {
          this.loadAllNotesView();
        }
      } else {
        this.updateSaveStatus('error', 'Delete failed');
        console.error('Delete failed:', response.error);
        setTimeout(() => {
          this.updateSaveStatus('ready', 'Ready');
        }, 3000);
      }
    } catch (error) {
      console.error('Error deleting note:', error);
      this.updateSaveStatus('error', 'Delete error');
      setTimeout(() => {
        this.updateSaveStatus('ready', 'Ready');
      }, 3000);
    }
  }

  updateSaveStatus(status, text) {
    const indicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    
    // Remove all status classes
    indicator.className = 'status-indicator';
    
    // Add specific status class
    indicator.classList.add(status);
    statusText.textContent = text;
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

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  detectAndSetTextDirection(textarea) {
    const text = textarea.value;
    if (!text.trim()) {
      // Reset to auto direction for empty text
      textarea.style.direction = 'auto';
      textarea.style.textAlign = 'start';
      return;
    }

    // Check if text contains RTL characters
    const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
    const hasRtlChars = rtlRegex.test(text);
    
    // Get first meaningful character (skip spaces/punctuation)
    const meaningfulText = text.trim().replace(/^[^\p{L}]+/u, '');
    const firstChar = meaningfulText.charAt(0);
    
    if (hasRtlChars && rtlRegex.test(firstChar)) {
      // Text starts with RTL character - set RTL direction
      textarea.style.direction = 'rtl';
      textarea.style.textAlign = 'right';
    } else {
      // Text starts with LTR character or no RTL chars - set LTR direction
      textarea.style.direction = 'ltr';
      textarea.style.textAlign = 'left';
    }
  }

  handleFormattingShortcuts(e, textarea) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    
    // Handle Tab for bullet points
    if (e.key === 'Tab') {
      e.preventDefault();
      const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = textarea.value.substring(lineStart, end);
      
      if (e.shiftKey) {
        // Shift+Tab: Remove indentation
        if (currentLine.startsWith('  ')) {
          this.replaceTextRange(textarea, lineStart, lineStart + 2, '');
        }
      } else {
        // Tab: Add indentation or bullet point
        if (currentLine.trim() === '') {
          this.insertTextAtCursor(textarea, '• ');
        } else {
          this.insertTextAtCursor(textarea, '  ');
        }
      }
      return;
    }

    // Handle Enter for continuing lists
    if (e.key === 'Enter') {
      const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
      const currentLine = textarea.value.substring(lineStart, start);
      
      // Auto-continue bullet points
      if (currentLine.match(/^\s*[•\-\*]\s/)) {
        e.preventDefault();
        const indent = currentLine.match(/^\s*/)[0];
        const bullet = currentLine.match(/[•\-\*]/)[0];
        this.insertTextAtCursor(textarea, `\n${indent}${bullet} `);
        return;
      }
      
      // Auto-continue numbered lists
      const numberMatch = currentLine.match(/^(\s*)(\d+)\.\s/);
      if (numberMatch) {
        e.preventDefault();
        const indent = numberMatch[1];
        const nextNumber = parseInt(numberMatch[2]) + 1;
        this.insertTextAtCursor(textarea, `\n${indent}${nextNumber}. `);
        return;
      }
    }

    // Handle formatting shortcuts
    if ((e.ctrlKey || e.metaKey) && selectedText) {
      let replacement = null;
      
      switch (e.key.toLowerCase()) {
        case 'b': // Bold
          e.preventDefault();
          replacement = `**${selectedText}**`;
          break;
        case 'u': // Underline
          e.preventDefault();
          replacement = `__${selectedText}__`;
          break;
        case 'i': // Italic (optional)
          e.preventDefault();
          replacement = `*${selectedText}*`;
          break;
      }
      
      if (replacement) {
        this.replaceSelectedText(textarea, replacement);
      }
    }
  }

  insertTextAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    
    textarea.value = before + text + after;
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    
    // Trigger input event for auto-save
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  replaceSelectedText(textarea, replacement) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    
    textarea.value = before + replacement + after;
    textarea.selectionStart = start;
    textarea.selectionEnd = start + replacement.length;
    
    // Trigger input event for auto-save
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  replaceTextRange(textarea, start, end, replacement) {
    const before = textarea.value.substring(0, start);
    const after = textarea.value.substring(end);
    
    textarea.value = before + replacement + after;
    textarea.selectionStart = textarea.selectionEnd = start + replacement.length;
    
    // Trigger input event for auto-save
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
}

// Initialize sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new EmailNotesSidebar();
});