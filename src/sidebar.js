// Sidebar script for Email Thread Notes extension
import { initMilkdownEditor } from './milkdown-init.js';

class EmailNotesSidebar {
  constructor() {
    this.currentThreadId = null;
    this.currentPlatform = null;
    this.currentView = 'all'; // 'thread' or 'all'
    this.manualThreadSelection = false;
    this.currentOriginalThreadId = null;
    this.saveTimeout = null;
    this.milkdownEditor = null; // Milkdown editor instance
    this.rtlObserver = null; // MutationObserver for RTL detection

    // Promise to track when Milkdown editor is fully initialized
    this.editorReadyPromise = null;
    this.resolveEditorReady = null;

    this.init();
  }

  async init() {
    console.log('Email Notes Sidebar initialized');

    // Create the editor ready promise
    this.editorReadyPromise = new Promise((resolve) => {
      this.resolveEditorReady = resolve;
    });

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

    // Initialize Milkdown editor after DOM is ready
    setTimeout(async () => {
      try {
        await this.initMilkdownEditor();
      } catch (error) {
        console.error('Failed to initialize Milkdown:', error);
        this.createFallbackEditor();
      }
    }, 50);

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

      // Update open thread button label in case user navigated in Gmail
      if (this.currentThreadId) {
        this.updateOpenThreadButtonLabel();
      }

      // Also refresh All Notes if we're in that view
      if (this.currentView === 'all' && this.allNotes) {
        this.loadAllNotesView();
      }
    });

    // Settings toggle handler
    const settingsToggle = document.getElementById('settingsToggle');
    settingsToggle.addEventListener('click', () => {
      this.toggleSettings();
    });

    // Export button handler
    const exportBtn = document.getElementById('exportNotesBtn');
    exportBtn.addEventListener('click', () => {
      this.exportAllNotes();
    });

    // Import button handler
    const importBtn = document.getElementById('importNotesBtn');
    importBtn.addEventListener('click', () => {
      document.getElementById('importFile').click();
    });

    // Import file handler
    const importFile = document.getElementById('importFile');
    importFile.addEventListener('change', (e) => {
      this.handleImportFile(e);
    });

    // New note button handler (All Notes view)
    const newNoteBtn = document.getElementById('newNoteBtn');
    if (newNoteBtn) {
      newNoteBtn.addEventListener('click', () => {
        this.handleNewNoteButton();
      });
    }

    // Open thread in tab handler
    const openThreadBtn = document.getElementById('openThreadBtn');
    if (openThreadBtn) {
      openThreadBtn.addEventListener('click', () => {
        this.openCurrentThread();
      });
    }

    // Setup keyboard shortcuts
    this.setupKeyboardShortcuts();
    
    // Setup critical save triggers
    this.setupSaveTriggers();

    // Keep the panel focused so clicks register immediately
    this.setupPanelFocusHandling();

    // Initialize stateful UI bits
    this.updateNewNoteButton();
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

    // Save when user clicks outside the editor (loses focus)
    document.addEventListener('click', (e) => {
      const editorContainer = document.querySelector('#quillEditor');
      if (editorContainer && !editorContainer.contains(e.target) && this.hasPendingChanges()) {
        this.saveCurrentNoteImmediately();
      }
    });
  }

  setupPanelFocusHandling() {
    const focusPanel = () => {
      if (!document.hasFocus()) {
        window.focus();
      }
    };

    document.addEventListener('mouseenter', focusPanel, true);
    document.addEventListener('pointerdown', focusPanel, true);
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
        this.handleThreadChange(
          message.threadId,
          message.platform,
          message.subject,
          message.account,
          message.accountEmail,
          message.originalThreadId
        );
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
      let url = null;
      if (activeTab.url) {
        try {
          url = new URL(activeTab.url);
          isEmailDomain = supportedDomains.some(domain => url.hostname === domain);
        } catch (urlError) {
          console.log('Could not parse URL, treating as non-email domain');
          isEmailDomain = false;
        }
      }
      
      if (isEmailDomain && url) {
        // Send message to content script to get current thread info
        chrome.tabs.sendMessage(activeTab.id, { action: 'getCurrentThread' }, (response) => {
          if (chrome.runtime.lastError) {
            console.log('No content script response:', chrome.runtime.lastError.message);
            this.handleNoThread();
            return;
          }
          
          if (response && response.threadId) {
            this.handleThreadChange(
              response.threadId,
              response.platform,
              response.subject,
              response.account,
              response.accountEmail,
              response.originalThreadId
            );
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

  handleThreadChange(threadId, platform, subject, account, accountEmail, originalThreadId) {
    this.manualThreadSelection = false;
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
    this.currentOriginalThreadId = originalThreadId || (threadId ? threadId.split('_').pop() : null);
    
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
      
      if (this.currentView === 'all' && this.allNotes) {
        this.filterAndDisplayNotes();
      }
    } else {
      // No thread - handle accordingly
      this.handleNoThread();
    }

    this.updateNewNoteButton();
  }


  handlePlatformChange(platform, account, accountEmail) {
    const previousPlatform = this.currentPlatform;
    const previousAccount = this.currentAccount;

    this.currentPlatform = platform;
    this.currentAccount = account;
    this.currentAccountEmail = accountEmail;

    // Update platform indicator
    const indicator = document.getElementById('platformIndicator');
    if (indicator) {
      indicator.textContent = platform;
      indicator.style.display = 'inline-block';
    }

    // If platform or account changed, refresh All Notes view immediately
    if ((previousPlatform !== platform || previousAccount !== account) && this.allNotes) {
      console.log('Platform/account changed, refreshing All Notes view');
      this.loadAllNotesView();
    }
  }

  async handleNoThread() {
    if (this.manualThreadSelection) {
      return;
    }
    this.currentThreadId = null;
    this.currentOriginalThreadId = null;
    const openThreadBtn = document.getElementById('openThreadBtn');
    if (openThreadBtn) {
      openThreadBtn.disabled = true;
    }
    const threadInfo = document.getElementById('threadInfo');
    if (threadInfo) {
      threadInfo.style.display = 'none';
    }

    // Keep platform/account info even when no thread is active
    // This allows "All Notes" to filter by current Gmail account
    // DON'T clear these - they're set by handlePlatformChange()
    const wasOnPlatform = this.currentPlatform;
    // this.currentPlatform = null;  // Keep platform info
    // this.currentAccount = null;   // Keep account info
    // this.currentAccountEmail = null; // Keep account email

    // Disable Thread Notes button
    const threadBtn = document.getElementById('threadNotesBtn');
    threadBtn.disabled = true;

    // Switch to All Notes view if we were in Thread view
    if (this.currentView === 'thread') {
      this.switchToAllNotesView();
    } else if (this.currentView === 'all' && wasOnPlatform) {
      // Already in All Notes but platform changed - refresh to show all notes
      this.loadAllNotesView();
    }
    
    if (this.currentView === 'all' && this.allNotes) {
      this.filterAndDisplayNotes();
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

    this.updateNewNoteButton();
  }

  updateThreadInfo(threadId, platform, subject, account, accountEmail) {
    const threadInfo = document.getElementById('threadInfo');
    const threadSubject = document.getElementById('threadSubject');
    const threadSubjectText = document.getElementById('threadSubjectText');
    const threadDetails = document.getElementById('threadDetails');
    const openThreadBtn = document.getElementById('openThreadBtn');

    if (threadSubjectText) {
      threadSubjectText.textContent = subject || 'Email Thread';
    } else if (threadSubject) {
      threadSubject.textContent = subject || 'Email Thread';
    }

    // Show account email if available, otherwise show platform + thread ID
    const accountDisplay = accountEmail || `Thread: ${threadId.substring(0, 8)}...`;
    threadDetails.textContent = `${platform} • ${accountDisplay}`;
    threadInfo.style.display = 'block';
    if (openThreadBtn) {
      openThreadBtn.disabled = false;
      this.updateOpenThreadButtonLabel();
    }
  }

  updateOpenThreadButtonLabel() {
    const openThreadBtn = document.getElementById('openThreadBtn');
    if (!openThreadBtn) return;

    // Check if we're currently on this thread by comparing with browser URL
    this.checkIfOnCurrentThread().then(isOnCurrentThread => {
      const buttonText = openThreadBtn.querySelector('.button-text');
      if (buttonText) {
        if (isOnCurrentThread) {
          buttonText.textContent = 'Current thread';
          openThreadBtn.title = 'You are viewing this thread';
        } else {
          buttonText.textContent = 'Open thread';
          openThreadBtn.title = 'Open this email thread';
        }
      }
    });
  }

  async checkIfOnCurrentThread() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab || !activeTab.url) return false;

      const url = new URL(activeTab.url);

      // Check if we're on Gmail
      if (url.hostname === 'mail.google.com' && this.currentOriginalThreadId) {
        // Extract thread ID from Gmail URL
        const match = url.hash.match(/#inbox\/([A-Za-z\d]+)$/);
        if (match && match[1] === this.currentOriginalThreadId) {
          return true;
        }
      }

      // Could add Outlook check here if needed

      return false;
    } catch (error) {
      console.error('Error checking if on current thread:', error);
      return false;
    }
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

    this.updateNewNoteButton();
  }

  switchToAllNotesView() {
    this.manualThreadSelection = false;
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

    this.updateNewNoteButton();
  }

  async loadThreadNotes() {
    if (!this.currentThreadId) return;

    try {
      console.log('=== LOAD THREAD NOTES ===');
      console.log('Loading notes for thread:', this.currentThreadId);

      // Show loading state
      this.updateSaveStatus('loading', 'Loading...');

      // Wait for editor to be ready before loading content
      await this.editorReadyPromise;

      // Get note for current thread
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId: this.currentThreadId
      });

      console.log('Got response from storage:', {
        hasNote: !!response.note,
        contentLength: response.note?.content?.length || 0,
        threadId: this.currentThreadId
      });

      const lastUpdated = document.getElementById('lastUpdated');

      if (response.note) {
        // Load content into Milkdown editor
        const content = response.note.content || '';
        console.log('📝 Loading content into editor:', content.substring(0, 50) + '...');

        if (!this.currentOriginalThreadId && response.note.originalThreadId) {
          this.currentOriginalThreadId = response.note.originalThreadId;
        }

        if (this.milkdownEditor) {
          // Set markdown content in Milkdown (editor is guaranteed to be ready now)
          console.log('Calling setMarkdown with content...');
          await this.milkdownEditor.setMarkdown(content);

          // Force editor visibility and layout refresh
          const editorRoot = this.milkdownEditor.getEditorRoot();
          if (editorRoot) {
            editorRoot.style.minHeight = '200px';
            editorRoot.style.visibility = 'visible';
            editorRoot.style.opacity = '1';
          }
        } else if (this.fallbackEditor) {
          // Fallback: plain text
          this.fallbackEditor.value = content;
        }

        this.setEditorEmptyState(!content.trim());

        if (response.note.lastModified) {
          lastUpdated.textContent = this.formatTimestamp(new Date(response.note.lastModified));
        }
        this.updateSaveStatus('saved', 'Saved');

        // Auto-switch to ready state after showing saved briefly
        setTimeout(() => {
          this.updateSaveStatus('ready', 'Ready');
        }, 1000);
      } else {
        console.log('📭 No note found for this thread - clearing editor');
        if (this.milkdownEditor) {
          console.log('Calling setMarkdown with empty string...');
          await this.milkdownEditor.setMarkdown('');
          console.log('Editor cleared');
        } else if (this.fallbackEditor) {
          this.fallbackEditor.value = '';
        }
        this.setEditorEmptyState(true);
        lastUpdated.textContent = '';
        this.updateSaveStatus('ready', 'Ready');
      }

      // Focus editor and ensure it's rendered
      setTimeout(() => {
        try {
          if (this.milkdownEditor) {
            const editorRoot = this.milkdownEditor.getEditorRoot();
            if (editorRoot) {
              // Trigger reflow to ensure rendering
              editorRoot.offsetHeight;
            }
            if (this.milkdownEditor.focus) {
              this.milkdownEditor.focus();
            }
          } else if (this.fallbackEditor) {
            this.fallbackEditor.focus();
          }
        } catch (error) {
          console.log('Could not focus editor:', error);
        }
      }, 150);
      
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

    console.log('🔍 Filtering notes. Total notes:', this.allNotes.length);
    console.log('Current filters:', {
      platform: this.currentPlatform,
      account: this.currentAccount,
      accountEmail: this.currentAccountEmail
    });

    // Get current filter values
    const searchTerm = document.getElementById('notesSearchInput').value.toLowerCase();
    const sortFilter = document.getElementById('sortFilter').value;

    // Determine current platform for filtering
    const currentPlatform = this.currentPlatform ? this.currentPlatform.toLowerCase() : null;

    // Filter notes
    let filteredNotes = this.allNotes.filter(([threadId, noteData]) => {
      // Platform filter - only show notes for current platform (Gmail vs Outlook)
      if (currentPlatform && noteData.platform !== currentPlatform) {
        console.log('  ❌ Filtering out (wrong platform):', threadId, noteData.platform, '!==', currentPlatform);
        return false;
      }

      // Account filter - only show notes for current Gmail account (e.g., account 0 vs account 1)
      if (this.currentAccount && noteData.account !== this.currentAccount) {
        console.log('  ❌ Filtering out (wrong account):', threadId, noteData.account, '!==', this.currentAccount);
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

    console.log('📊 After filtering:', filteredNotes.length, 'notes');

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
      this.showNoFilterResultsState(searchTerm);
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

  showNoFilterResultsState(searchTerm) {
    const notesContent = document.querySelector('#allNotesView .notes-content');

    let filterDescription = 'Try adjusting your search.';
    if (searchTerm) {
      filterDescription = `No notes found matching "${searchTerm}".`;
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
    const noteMap = new Map(noteEntries);

    const notesHtml = noteEntries.map(([threadId, noteData]) => {
      // Extract text content from markdown for preview
      const cleanContent = this.extractTextFromMarkdown(noteData.content);
      const preview = cleanContent.length > 100
        ? cleanContent.substring(0, 100) + '...'
        : cleanContent;
      const previewClass = this.isRtlText(cleanContent) ? 'note-preview rtl' : 'note-preview';
      const timestamp = this.formatTimestamp(new Date(noteData.lastModified || noteData.timestamp));
      const subject = noteData.subject || 'No Subject';
      const platform = noteData.platform || 'gmail';
      const originalThreadId = noteData.originalThreadId || threadId.split('_').pop();
      const safeOriginalId = this.escapeHtml(originalThreadId || '');
      const isActive = this.currentThreadId && threadId === this.currentThreadId;
      const activeClass = isActive ? ' active' : '';

      return `
        <div class="note-item${activeClass}"
          data-thread-id="${threadId}"
          data-platform="${platform}"
          data-original-thread-id="${safeOriginalId}"
          data-account="${this.escapeHtml(noteData.account || '')}"
          data-account-email="${this.escapeHtml(noteData.accountEmail || '')}"
          data-subject="${this.escapeHtml(subject)}">
          <div class="note-header">
            <div class="note-subject">${this.escapeHtml(subject)}</div>
            <div class="note-meta">
              <div class="note-platform">${platform}</div>
              <button class="note-open-btn" title="Open email thread" aria-label="Open email thread">
                <svg class="note-open-icon" viewBox="0 0 24 24">
                  <path d="M7 17L17 7" stroke-width="1.6" fill="none" stroke-linecap="round"></path>
                  <polyline points="11,7 17,7 17,13" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
                </svg>
              </button>
            </div>
          </div>
          <div class="${previewClass}">${this.escapeHtml(preview)}</div>
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
      const threadId = item.getAttribute('data-thread-id');
      item._noteData = noteMap.get(threadId) || null;

      const clickHandler = () => {
        this.selectNoteFromList(item);
      };

      const contextHandler = (e) => {
        e.preventDefault();
        this.showNoteContextMenu(e, item);
      };

      item.addEventListener('click', clickHandler);
      item.addEventListener('contextmenu', contextHandler);

      const openBtn = item.querySelector('.note-open-btn');
      if (openBtn) {
        openBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          const platform = item.getAttribute('data-platform');
          const originalThreadId = item.getAttribute('data-original-thread-id');
          this.openThread(threadId, platform, originalThreadId);
        });
      }

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
        padding: 4px 0 8px 0;
        border-bottom: 1px solid #e8eaed;
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      
      .notes-count {
        font-size: 11px;
        color: #5f6368;
        font-weight: 500;
      }
      
      .notes-list {
        flex: 1;
        overflow-y: auto;
        max-height: calc(100vh - 220px);
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-right: 6px;
        scrollbar-width: thin;
        scrollbar-color: transparent transparent;
      }

      .notes-list:hover {
        scrollbar-color: #c5c8cc transparent;
      }

      .notes-list::-webkit-scrollbar {
        width: 6px;
      }

      .notes-list::-webkit-scrollbar-thumb {
        background-color: transparent;
        border-radius: 4px;
      }

      .notes-list:hover::-webkit-scrollbar-thumb {
        background-color: #c5c8cc;
      }
      
      .note-item {
        padding: 12px 14px;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        cursor: pointer;
        transition: background-color 0.2s, border-color 0.2s, box-shadow 0.2s;
        background: #ffffff;
        width: 100%;
        box-shadow: 0 1px 2px rgba(15, 23, 42, 0.05);
      }
      
      .note-item:hover {
        background-color: #fefefe;
        border-color: #d5d9df;
        box-shadow: 0 4px 10px rgba(15, 23, 42, 0.08);
      }
      
      .note-item.active {
        border-color: #818cf8;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.15);
        background: #f5f5ff;
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

      .note-meta {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .note-open-btn {
        border: none;
        background: transparent;
        padding: 4px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #5f6368;
        transition: background 0.2s ease, color 0.2s ease;
      }

      .note-open-btn:hover {
        background: #e8eaed;
        color: #1a73e8;
      }

      .note-open-icon {
        width: 16px;
        height: 16px;
        stroke: currentColor;
      }
      
      .note-preview {
        color: #5f6368;
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 6px;
      }

      .note-preview.rtl {
        direction: rtl;
        text-align: right;
      }
      
      .note-timestamp {
        color: #9aa0a6;
        font-size: 11px;
      }
    `;
    
    document.head.appendChild(style);
  }

  async openThread(threadId, platform, originalThreadId) {
    console.log('=== OPEN THREAD DEBUG ===');
    console.log('openThread called with:', { threadId, platform, originalThreadId });
    console.log('Current state:', {
      currentThreadId: this.currentThreadId,
      currentView: this.currentView,
      manualThreadSelection: this.manualThreadSelection
    });

    // Don't skip navigation - always navigate to the thread
    // User clicked "open thread" button, so they want to go there

    try {
      // Normalize platform to lowercase for comparison
      const platformLower = (platform || 'gmail').toLowerCase();
      console.log('Platform (normalized):', platformLower);

      // Robust extraction of account index and original thread ID from internal format
      // Format: platform_account_X_originalThreadId (e.g., gmail_account_0_abc123)
      let accountIndex = '0';
      let extractedOriginalThreadId = originalThreadId;

      console.log('Initial values:', { accountIndex, extractedOriginalThreadId });

      if (threadId && threadId.includes('_account_')) {
        const match = threadId.match(/^(\w+)_account_(\d+)_(.+)$/);
        console.log('Regex match result:', match);
        if (match) {
          accountIndex = match[2];
          extractedOriginalThreadId = extractedOriginalThreadId || match[3];
          console.log('Extracted from threadId:', { accountIndex, extractedOriginalThreadId });
        }
      }

      // Construct the appropriate URL based on platform
      let targetUrl;

      if (platformLower === 'gmail') {
        if (extractedOriginalThreadId) {
          targetUrl = `https://mail.google.com/mail/u/${accountIndex}/#inbox/${extractedOriginalThreadId}`;
          console.log('✅ Gmail URL constructed:', targetUrl);
          console.log('  - Account Index:', accountIndex);
          console.log('  - Thread ID:', extractedOriginalThreadId);
        } else {
          // Fallback to inbox if we can't construct specific thread URL
          targetUrl = `https://mail.google.com/mail/u/${accountIndex}/#inbox`;
          console.warn('⚠️ Could not extract Gmail thread ID, falling back to inbox:', targetUrl);
        }
      } else if (platformLower === 'outlook') {
        if (extractedOriginalThreadId && extractedOriginalThreadId.length > 10) {
          targetUrl = `https://outlook.office365.com/mail/inbox/id/${extractedOriginalThreadId}`;
          console.log('✅ Outlook URL constructed:', targetUrl);
        } else {
          // Fallback to inbox if thread ID is invalid
          targetUrl = `https://outlook.office365.com/mail/inbox`;
          console.warn('⚠️ Invalid Outlook thread ID, falling back to inbox:', targetUrl);
        }
      } else {
        console.error('❌ Unknown platform:', platform);
        alert('Unknown email platform. Cannot open thread.');
        return;
      }

      console.log('🚀 FINAL TARGET URL:', targetUrl);

      // Navigate to the thread
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab) {
        console.log('Updating tab:', activeTab.id);
        chrome.tabs.update(activeTab.id, { url: targetUrl });
      } else {
        console.error('❌ No active tab found');
      }

    } catch (error) {
      console.error('❌ Error opening thread:', error);
      alert('Unable to navigate to thread. Please try again.');
    }
  }

  openCurrentThread() {
    if (!this.currentThreadId) {
      console.warn('openCurrentThread: No currentThreadId');
      return;
    }

    console.log('openCurrentThread:', {
      threadId: this.currentThreadId,
      platform: this.currentPlatform,
      originalThreadId: this.currentOriginalThreadId
    });

    // Extract original thread ID from currentThreadId if not set
    let originalThreadId = this.currentOriginalThreadId;
    if (!originalThreadId && this.currentThreadId) {
      // Parse from account-specific format: platform_account_X_originalId
      const parts = this.currentThreadId.split('_');
      if (parts.length >= 4) {
        // gmail_account_0_threadId or outlook_account_0_threadId
        originalThreadId = parts.slice(3).join('_');
      } else {
        originalThreadId = this.currentThreadId;
      }
      console.log('Extracted originalThreadId from currentThreadId:', originalThreadId);
    }

    this.openThread(
      this.currentThreadId,
      this.currentPlatform || 'gmail',
      originalThreadId
    );
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

  async selectNoteFromList(noteElement) {
    if (!noteElement) return;

    const noteData = noteElement._noteData || {};
    const threadId = noteElement.getAttribute('data-thread-id');
    const platform = noteElement.getAttribute('data-platform') || noteData.platform || 'gmail';
    const subjectAttr = noteElement.getAttribute('data-subject');
    const accountAttr = noteElement.getAttribute('data-account');
    const accountEmailAttr = noteElement.getAttribute('data-account-email');

    const originalThreadIdAttr = noteElement.getAttribute('data-original-thread-id');
    const subject = subjectAttr ? this.decodeHtml(subjectAttr) : (noteData.subject || 'Email Thread');
    const account = accountAttr ? this.decodeHtml(accountAttr) : (noteData.account || null);
    const accountEmail = accountEmailAttr ? this.decodeHtml(accountEmailAttr) : (noteData.accountEmail || null);

    this.currentThreadId = threadId;
    this.currentPlatform = platform;
    this.currentAccount = account;
    this.currentAccountEmail = accountEmail;
    this.manualThreadSelection = true;
    this.currentOriginalThreadId = originalThreadIdAttr || noteData.originalThreadId || threadId;

    this.updateThreadInfo(threadId, platform, subject, account, accountEmail);

    const threadBtn = document.getElementById('threadNotesBtn');
    threadBtn.disabled = false;

    const content = noteData.content || '';
    if (this.milkdownEditor) {
      try {
        await this.milkdownEditor.setMarkdown(content);
      } catch (error) {
        console.error('Error preloading Milkdown content:', error);
      }
    } else if (this.fallbackEditor) {
      this.fallbackEditor.value = content;
    }

    this.setEditorEmptyState(!content.trim());
    this.switchToThreadView();
  }

  handleNewNoteButton() {
    if (!this.currentThreadId) return;

    // Switch directly to the thread view; loadThreadNotes will handle showing existing content or empty state
    this.manualThreadSelection = false;
    this.switchToThreadView();
  }

  updateNewNoteButton() {
    const newNoteBtn = document.getElementById('newNoteBtn');
    if (!newNoteBtn) return;

    const shouldShow = this.currentView === 'all' && !!this.currentThreadId;
    if (shouldShow) {
      newNoteBtn.classList.add('visible');
    } else {
      newNoteBtn.classList.remove('visible');
    }
  }

  handleNotesInput() {
    if (!this.currentThreadId) return;

    this.setEditorEmptyState(false);
    this.updateSaveStatus('typing', 'Typing...');

    // Clear existing timeouts
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    if (this.typingTimeout) {
      clearTimeout(this.typingTimeout);
    }
    if (this.rtlDetectionTimeout) {
      clearTimeout(this.rtlDetectionTimeout);
    }

    // Set timeout to return to ready state after user stops typing
    this.typingTimeout = setTimeout(() => {
      this.updateSaveStatus('ready', 'Ready');
    }, 2000);

    // Set timeout for auto-save (120 seconds to avoid frequent save dialogs)
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentNote();
    }, 120000);

    // Debounce RTL detection - only run after user stops typing for 500ms
    this.rtlDetectionTimeout = setTimeout(() => {
      this.detectAndSetTextDirection();
    }, 500);
  }

  async saveCurrentNote() {
    if (!this.currentThreadId) return;

    const content = this.milkdownEditor ? this.milkdownEditor.getMarkdown().trim() :
                   this.fallbackEditor ? this.fallbackEditor.value.trim() : '';

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
        subject: subject,
        originalThreadId: this.currentOriginalThreadId
      });

      if (response.success) {
        this.updateSaveStatus('saved', 'Saved');

        // Update last modified timestamp
        const lastUpdated = document.getElementById('lastUpdated');
        lastUpdated.textContent = this.formatTimestamp(new Date());

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
        // Clear the editor
        if (this.milkdownEditor) {
          await this.milkdownEditor.setMarkdown('');
        } else if (this.fallbackEditor) {
          this.fallbackEditor.value = '';
        }
        this.setEditorEmptyState(true);

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

  isRtlText(text) {
    if (!text) return false;
    const rtlPattern = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/;
    return rtlPattern.test(text);
  }

  setEditorEmptyState(isEmpty) {
    const editorContainer = document.getElementById('quillEditor');
    if (!editorContainer) return;
    if (isEmpty) {
      editorContainer.classList.add('editor-empty');
    } else {
      editorContainer.classList.remove('editor-empty');
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  decodeHtml(text) {
    const div = document.createElement('div');
    div.innerHTML = text || '';
    return div.textContent || '';
  }

  toggleSettings() {
    const settingsPanel = document.getElementById('sidebarSettings');
    const settingsToggle = document.getElementById('settingsToggle');
    
    if (settingsPanel.style.display === 'none') {
      settingsPanel.style.display = 'block';
      settingsToggle.classList.add('active');
    } else {
      settingsPanel.style.display = 'none';
      settingsToggle.classList.remove('active');
    }
  }

  async exportAllNotes() {
    try {
      this.showSettingsStatus('Exporting notes...', 'info');
      
      const response = await chrome.runtime.sendMessage({ action: 'exportNotes' });
      
      if (response.success) {
        this.showSettingsStatus(`✓ Exported ${response.notesCount} notes successfully`, 'success');
        
        // Hide status after 3 seconds
        setTimeout(() => {
          this.hideSettingsStatus();
        }, 3000);
      } else {
        this.showSettingsStatus('✗ Export failed: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Export error:', error);
      this.showSettingsStatus('✗ Export error occurred', 'error');
    }
  }

  async handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
      this.showSettingsStatus('Reading import file...', 'info');
      
      const fileContent = await this.readFileAsText(file);
      
      this.showSettingsStatus('Importing notes...', 'info');
      
      const response = await chrome.runtime.sendMessage({
        action: 'importNotes',
        fileContent: fileContent,
        options: { merge: false, overwrite: true }
      });
      
      if (response.success) {
        const { imported, skipped, errors } = response;
        let message = `✓ Import completed: ${imported} imported`;
        if (skipped > 0) message += `, ${skipped} skipped`;
        if (errors > 0) message += `, ${errors} errors`;
        
        this.showSettingsStatus(message, 'success');
        
        // Refresh the notes list to show imported notes
        this.loadAllNotesView();
        
        // Hide status after 5 seconds
        setTimeout(() => {
          this.hideSettingsStatus();
        }, 5000);
      } else {
        this.showSettingsStatus('✗ Import failed: ' + (response.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Import error:', error);
      this.showSettingsStatus('✗ Import error: Invalid file format', 'error');
    }
    
    // Reset file input
    event.target.value = '';
  }

  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsText(file);
    });
  }

  showSettingsStatus(message, type = 'info') {
    const statusElement = document.getElementById('settingsStatus');
    statusElement.textContent = message;
    statusElement.className = `settings-status ${type}`;
    statusElement.style.display = 'block';
  }

  hideSettingsStatus() {
    const statusElement = document.getElementById('settingsStatus');
    statusElement.style.display = 'none';
  }

  detectAndSetTextDirection() {
    try {
      let text = '';
      let rootElement = null;

      if (this.milkdownEditor) {
        text = this.milkdownEditor.getMarkdown();
        rootElement = this.milkdownEditor.getEditorRoot();
      } else if (this.fallbackEditor) {
        text = this.fallbackEditor.value || '';
        rootElement = this.fallbackEditor;
      }

      if (!rootElement) {
        console.log('RTL: No root element found');
        return;
      }

      if (!text.trim()) {
        // Reset to auto direction for empty text
        rootElement.classList.remove('rtl-content', 'ltr-content');
        return;
      }

      // Check if text contains RTL characters
      const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
      const hasRtlChars = rtlRegex.test(text);

      // Get first meaningful character (skip spaces/punctuation)
      const meaningfulText = text.trim().replace(/^[^\p{L}]+/u, '');
      const firstChar = meaningfulText.charAt(0);

      console.log('RTL Detection:', {
        hasRtlChars,
        firstChar,
        isRtl: hasRtlChars && rtlRegex.test(firstChar)
      });

      if (hasRtlChars && rtlRegex.test(firstChar)) {
        // Text starts with RTL character - set RTL direction
        console.log('Setting RTL direction');
        rootElement.style.direction = 'rtl';
        rootElement.style.textAlign = 'right';

        // Also set on ProseMirror editor and all paragraphs
        const pmEditor = rootElement.querySelector('.ProseMirror');
        if (pmEditor) {
          pmEditor.style.direction = 'rtl';
          pmEditor.style.textAlign = 'right';

          // Set on all paragraphs
          pmEditor.querySelectorAll('p').forEach(p => {
            p.style.direction = 'rtl';
            p.style.textAlign = 'right';
          });
        }
      } else {
        // Text starts with LTR character or no RTL chars - set LTR direction
        console.log('Setting LTR direction');
        rootElement.style.direction = 'ltr';
        rootElement.style.textAlign = 'left';

        // Also set on ProseMirror editor
        const pmEditor = rootElement.querySelector('.ProseMirror');
        if (pmEditor) {
          pmEditor.style.direction = 'ltr';
          pmEditor.style.textAlign = 'left';

          // Set on all paragraphs
          pmEditor.querySelectorAll('p').forEach(p => {
            p.style.direction = 'ltr';
            p.style.textAlign = 'left';
          });
        }
      }
    } catch (error) {
      console.error('Error in detectAndSetTextDirection:', error);
    }
  }


  // Initialize Milkdown editor
  async initMilkdownEditor() {
    console.log('🔄 initMilkdownEditor called');

    // Prevent multiple simultaneous initializations
    if (this.isInitializingEditor) {
      console.warn('⚠️ Editor initialization already in progress, skipping...');
      return;
    }

    const editorElement = document.getElementById('quillEditor');
    if (!editorElement) {
      console.error('Milkdown editor element not found');
      this.createFallbackEditor();
      return;
    }

    try {
      this.isInitializingEditor = true;

      // Clean up existing editor first to prevent multiple instances
      if (this.milkdownEditor) {
        console.log('🗑️ Destroying existing Milkdown editor...');
        await this.milkdownEditor.destroy();
        this.milkdownEditor = null;
      }

      // Clean up existing RTL observer
      if (this.rtlObserver) {
        this.rtlObserver.disconnect();
        this.rtlObserver = null;
      }

      // Clear the container to prevent duplicate divs
      console.log('🧹 Clearing editor container...');
      editorElement.innerHTML = '';

      // Count existing milkdown divs (for debugging)
      const existingDivs = document.querySelectorAll('.milkdown');
      if (existingDivs.length > 0) {
        console.warn(`⚠️ Found ${existingDivs.length} existing .milkdown divs, removing them...`);
        existingDivs.forEach(div => div.remove());
      }

      // Initialize Milkdown with onChange handler
      console.log('✨ Creating new Milkdown editor...');
      this.milkdownEditor = await initMilkdownEditor(
        editorElement,
        '',
        (markdown) => {
          try {
            this.handleNotesInput();
            // RTL detection is now debounced in handleNotesInput()
          } catch (error) {
            console.error('Error in change handler:', error);
          }
        }
      );

      console.log('✅ Milkdown editor initialized successfully');

      // Don't use RTL observer - it causes performance issues
      // RTL detection is handled via debounced timeout in handleNotesInput()
      // this.setupRTLObserver();

      // Force a layout refresh to ensure content is visible
      setTimeout(() => {
        const editorRoot = this.milkdownEditor?.getEditorRoot();
        if (editorRoot) {
          editorRoot.style.minHeight = '200px';
        }
      }, 100);

      // Resolve the editor ready promise
      if (this.resolveEditorReady) {
        this.resolveEditorReady();
        console.log('✅ Editor ready promise resolved');
      }

    } catch (error) {
      console.error('❌ Failed to initialize Milkdown editor:', error);
      this.createFallbackEditor();
      // Still resolve the promise even on failure to avoid hanging
      if (this.resolveEditorReady) {
        this.resolveEditorReady();
      }
    } finally {
      // Always reset the initialization flag
      this.isInitializingEditor = false;
      console.log('✅ Editor initialization complete');
    }
  }

  // Set up MutationObserver for RTL detection
  setupRTLObserver() {
    try {
      const editorRoot = this.milkdownEditor?.getEditorRoot();
      if (!editorRoot) return;

      // Create observer to detect text changes for RTL
      this.rtlObserver = new MutationObserver(() => {
        try {
          this.detectAndSetTextDirection();
        } catch (error) {
          console.error('Error in RTL detection:', error);
        }
      });

      // Observe text changes
      this.rtlObserver.observe(editorRoot, {
        childList: true,
        subtree: true,
        characterData: true
      });

      console.log('✅ RTL observer attached');
    } catch (error) {
      console.error('Error setting up RTL observer:', error);
    }
  }

  createFallbackEditor() {
    console.log('Creating fallback textarea editor');
    const container = document.getElementById('quillEditor');
    if (container) {
      container.innerHTML = `
        <textarea 
          id="fallbackEditor" 
          style="width: 100%; min-height: 350px; max-height: 60vh; 
                 padding: 12px; border: 1px solid #dadce0; border-radius: 6px; 
                 font-family: inherit; font-size: 15px; line-height: 1.5; 
                 resize: vertical; outline: none; box-sizing: border-box;
                 transition: border-color 0.2s;"
          placeholder="Add your private notes for this email thread..."
        ></textarea>
      `;
      
      const fallbackEditor = document.getElementById('fallbackEditor');
      
      // Add event listeners properly
      fallbackEditor.addEventListener('input', () => {
        this.handleNotesInput();
      });
      
      fallbackEditor.addEventListener('focus', () => {
        fallbackEditor.style.borderColor = '#1a73e8';
        fallbackEditor.style.boxShadow = '0 0 0 1px #1a73e8';
      });
      
      fallbackEditor.addEventListener('blur', () => {
        fallbackEditor.style.borderColor = '#dadce0';
        fallbackEditor.style.boxShadow = 'none';
      });
      
      // Store reference to fallback
      this.fallbackEditor = fallbackEditor;
    }
  }








  extractTextFromMarkdown(markdown) {
    if (!markdown) return '';

    // Simple markdown to text conversion - remove markdown formatting
    let text = markdown
      .replace(/^#{1,6}\s+/gm, '') // Remove headers
      .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
      .replace(/\*(.+?)\*/g, '$1') // Remove italic
      .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links, keep text
      .replace(/`(.+?)`/g, '$1') // Remove inline code
      .replace(/^[-*+]\s+/gm, '') // Remove list markers
      .replace(/^\d+\.\s+/gm, '') // Remove numbered list markers
      .replace(/^>\s+/gm, ''); // Remove blockquotes

    return text.trim();
  }
}

// Initialize sidebar when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('Scripts loading...');

  try {
    new EmailNotesSidebar();
  } catch (error) {
    console.error('Failed to initialize EmailNotesSidebar:', error);
  }
});
