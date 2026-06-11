// Sidebar script for Email Thread Notes extension
import { initMilkdownEditor } from './milkdown-init.js';

class EmailNotesSidebar {
  constructor() {
    this.currentThreadId = null;
    this.currentPlatform = null;
    this.currentView = 'all'; // 'thread' or 'all'
    this.manualThreadSelection = false;
    this.currentOriginalThreadId = null;
    this.currentLastEmailSeen = null;
    this.saveTimeout = null;
    this.milkdownEditor = null; // Milkdown editor instance
    this.rtlObserver = null; // MutationObserver for RTL detection
    this.currentNoteArchived = false;
    this.currentNotePinned = false;

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

    // Make entire editor container clickable to focus editor
    const editorContainer = document.getElementById('quillEditor');
    if (editorContainer) {
      editorContainer.addEventListener('click', (e) => {
        // Focus editor when clicking anywhere in the container (not on buttons)
        if (!e.target.closest('button')) {
          this.focusEditor();
        }
      });
    }

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

    // Pin button handler
    const pinBtn = document.getElementById('pinNoteBtn');
    if (pinBtn) {
      pinBtn.addEventListener('click', () => {
        this.togglePinCurrentNote();
      });
    }

    // Archive button handler
    const archiveBtn = document.getElementById('archiveNoteBtn');
    if (archiveBtn) {
      archiveBtn.addEventListener('click', () => {
        this.toggleArchiveCurrentNote();
      });
    }

    // Delete button handler
    const deleteBtn = document.getElementById('deleteNoteBtn');
    deleteBtn.addEventListener('click', () => {
      this.deleteCurrentNote();
    });

    // Search and filter handlers for All Notes view
    const searchInput = document.getElementById('notesSearchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const sortFilter = document.getElementById('sortFilter');

    searchInput.addEventListener('input', () => {
      // Toggle clear button visibility
      if (clearSearchBtn) {
        clearSearchBtn.style.display = searchInput.value ? 'flex' : 'none';
      }
      this.filterAndDisplayNotes();
    });

    // Clear search button handler
    if (clearSearchBtn) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        clearSearchBtn.style.display = 'none';
        this.filterAndDisplayNotes();
        searchInput.focus();
      });
    }

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
        const clearSearchBtn = document.getElementById('clearSearchBtn');
        if (searchInput && searchInput === document.activeElement) {
          searchInput.value = '';
          if (clearSearchBtn) {
            clearSearchBtn.style.display = 'none';
          }
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
          message.originalThreadId,
          message.lastEmailSeen
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
              response.originalThreadId,
              response.lastEmailSeen
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

  handleThreadChange(threadId, platform, subject, account, accountEmail, originalThreadId, lastEmailSeen) {
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
    this.currentLastEmailSeen = lastEmailSeen ?? null;

    if (threadId) {
      // Persist newest-email timestamp for existing notes (fire-and-forget)
      this.maybeUpdateLastEmailSeen(threadId, this.currentLastEmailSeen);

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

  // Persist the newest-email timestamp onto an EXISTING note for this thread.
  // Only updates when the scraped value is newer than what's stored. We never
  // create a note here (saveCurrentNote handles new notes) and never trigger a
  // list re-render. Fails silently (console.debug) so scraping issues never
  // affect the rest of the UI.
  async maybeUpdateLastEmailSeen(threadId, lastEmailSeen) {
    if (!threadId || !lastEmailSeen) return;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId
      });

      const note = response && response.note;
      if (!note) return; // only track threads that already have a note

      if (lastEmailSeen > (note.lastEmailSeen || 0)) {
        await chrome.runtime.sendMessage({
          action: 'updateNoteFields',
          threadId,
          fields: { lastEmailSeen }
        });
      }
    } catch (error) {
      console.debug('maybeUpdateLastEmailSeen failed:', error && error.message);
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

        // Set archive state
        this.currentNoteArchived = !!response.note.archived;
        this.updateArchiveButtonState(true, this.currentNoteArchived);

        // Set pin state
        this.currentNotePinned = !!response.note.pinned;
        this.updatePinButtonState(true, this.currentNotePinned);

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

          // Critical: Detect direction after loading content to ensure RTL lists render correctly
          setTimeout(() => {
            this.detectAndSetTextDirection();
          }, 50);
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

        // Reset archive state
        this.currentNoteArchived = false;
        this.updateArchiveButtonState(false, false);

        // Reset pin state
        this.currentNotePinned = false;
        this.updatePinButtonState(false, false);

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
      
      // Store all notes for filtering, excluding empty/null notes
      this.allNotes = Object.entries(response.notes).filter(([threadId, noteData]) => {
        // Filter out notes with no content or null content
        return noteData && noteData.content && noteData.content.trim().length > 0;
      });

      // Apply current filters and display
      this.filterAndDisplayNotes();
      
    } catch (error) {
      console.error('Error loading all notes:', error);
      this.showErrorAllNotesState();
    }
  }

  // Returns a comparator over [threadId, noteData] entries for the given sort option.
  getSortComparator(sortFilter) {
    return (a, b) => {
      const [, noteA] = a;
      const [, noteB] = b;

      switch (sortFilter) {
        case 'oldest':
          return (noteA.lastModified || 0) - (noteB.lastModified || 0);
        case 'subject': {
          const subjectA = (noteA.subject || 'No Subject').toLowerCase();
          const subjectB = (noteB.subject || 'No Subject').toLowerCase();
          return subjectA.localeCompare(subjectB);
        }
        case 'activity':
          return ((noteB.lastEmailSeen ?? noteB.lastModified) || 0) - ((noteA.lastEmailSeen ?? noteA.lastModified) || 0);
        case 'recent':
        default:
          return (noteB.lastModified || 0) - (noteA.lastModified || 0);
      }
    };
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

    // Split into active and archived groups
    const activeNotes = filteredNotes.filter(([, noteData]) => !noteData.archived);
    const archivedNotes = filteredNotes.filter(([, noteData]) => !!noteData.archived);

    const baseComparator = this.getSortComparator(sortFilter);

    // Sort archived notes with the base comparator
    archivedNotes.sort(baseComparator);

    // Sort active notes: pinned entries first, then apply selected sort within each group
    activeNotes.sort((a, b) => {
      const pinnedA = !!a[1].pinned;
      const pinnedB = !!b[1].pinned;
      if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;
      return baseComparator(a, b);
    });

    // Display filtered notes or appropriate empty state
    if (activeNotes.length === 0 && archivedNotes.length === 0) {
      if (searchTerm) {
        this.showNoFilterResultsState(searchTerm);
      } else {
        this.showEmptyAllNotesState();
      }
    } else {
      this.displayAllNotes({ active: activeNotes, archived: archivedNotes, searchTerm });
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

  // Builds and returns the HTML string for a single note card.
  // isArchived = true adds the 'archived' class and the Archived chip.
  // searchTerm (already lowercased) drives preview windowing and highlighting.
  buildNoteCardHtml([threadId, noteData], isArchived = false, searchTerm = '') {
    const cleanContent = this.extractTextFromMarkdown(noteData.content);

    // --- Preview windowing ---
    // When searching, collapse whitespace so the 2-line CSS clamp can't hide a
    // match sitting past the note's first newlines, then window around the
    // first match. Without a search the original preview is kept byte-for-byte.
    let preview;
    if (searchTerm) {
      const flat = cleanContent.replace(/\s+/g, ' ').trim();
      const matchIdx = flat.toLowerCase().indexOf(searchTerm);
      if (matchIdx > 40) {
        // Start ~30 chars before the match, snapping forward to a word boundary.
        let start = matchIdx - 30;
        const spaceIdx = flat.lastIndexOf(' ', matchIdx - 1);
        if (spaceIdx > start) {
          start = spaceIdx + 1;
        }
        start = Math.max(0, start);
        const window = flat.substring(start, start + 100);
        const needsTail = start + 100 < flat.length;
        preview = (start > 0 ? '…' : '') + window + (needsTail ? '...' : '');
      } else {
        preview = flat.length > 100 ? flat.substring(0, 100) + '...' : flat;
      }
    } else {
      preview = cleanContent.length > 100
        ? cleanContent.substring(0, 100) + '...'
        : cleanContent;
    }

    const previewClass = this.isRtlText(cleanContent) ? 'note-preview rtl' : 'note-preview';
    const timestamp = this.formatTimestamp(new Date(noteData.lastModified || noteData.timestamp));
    const subject = noteData.subject || 'No Subject';
    const platform = noteData.platform || 'gmail';
    const originalThreadId = noteData.originalThreadId || threadId.split('_').pop();
    const safeOriginalId = this.escapeHtml(originalThreadId || '');
    const isActive = this.currentThreadId && threadId === this.currentThreadId;
    const activeClass = isActive ? ' active' : '';
    const archivedClass = isArchived ? ' archived' : '';

    const pinIconHtml = noteData.pinned
      ? `<svg class="note-pin-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <line x1="12" y1="17" x2="12" y2="22"></line>
          <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
         </svg>`
      : '';

    const archivedChipHtml = isArchived
      ? `<div class="note-platform note-archived-chip">archived</div>`
      : '';

    return `
      <div class="note-item${activeClass}${archivedClass}"
        data-thread-id="${threadId}"
        data-platform="${platform}"
        data-original-thread-id="${safeOriginalId}"
        data-account="${this.escapeHtml(noteData.account || '')}"
        data-account-email="${this.escapeHtml(noteData.accountEmail || '')}"
        data-subject="${this.escapeHtml(subject)}">
        <div class="note-header">
          <div class="note-subject">${pinIconHtml}${this.highlightMatches(subject, searchTerm)}</div>
          <div class="note-meta">
            ${archivedChipHtml}
            <div class="note-platform">${platform}</div>
            <button class="note-open-btn" title="Open email thread" aria-label="Open email thread">
              <svg class="note-open-icon" viewBox="0 0 24 24">
                <path d="M7 17L17 7" stroke-width="1.6" fill="none" stroke-linecap="round"></path>
                <polyline points="11,7 17,7 17,13" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"></polyline>
              </svg>
            </button>
            <button class="note-kebab-btn" title="Note actions" aria-label="Note actions" aria-haspopup="menu">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <circle cx="12" cy="5" r="1.5"></circle>
                <circle cx="12" cy="12" r="1.5"></circle>
                <circle cx="12" cy="19" r="1.5"></circle>
              </svg>
            </button>
          </div>
        </div>
        <div class="${previewClass}">${this.highlightMatches(preview, searchTerm)}</div>
        <div class="note-timestamp">${timestamp}</div>
      </div>
    `;
  }

  async displayAllNotes({ active, archived, searchTerm }) {
    const notesContent = document.querySelector('#allNotesView .notes-content');

    // Read persisted collapse state; default to collapsed (false = collapsed).
    // During a search we always expand regardless of the stored value.
    const isSearching = !!(searchTerm && searchTerm.length > 0);
    let archivedOpen = isSearching;
    if (!isSearching && archived.length > 0) {
      try {
        const stored = await chrome.storage.local.get(['archivedSectionOpen']);
        archivedOpen = !!stored.archivedSectionOpen;
      } catch (e) {
        // Ignore storage errors; default stays collapsed.
        console.warn('Could not read archivedSectionOpen from storage:', e);
      }
    }

    // Build the note map over ALL entries (active + archived) so handler
    // wiring works for every rendered card regardless of collapsed state.
    const noteMap = new Map([...active, ...archived]);

    // --- Active list ---
    const activeHtml = active.map(entry => this.buildNoteCardHtml(entry, false, searchTerm)).join('');

    // --- Archived section (only when there are archived notes) ---
    let archivedSectionHtml = '';
    if (archived.length > 0) {
      const chevronStyle = archivedOpen ? 'transform: rotate(90deg);' : '';
      const archivedCardsHtml = archived.map(entry => this.buildNoteCardHtml(entry, true, searchTerm)).join('');
      archivedSectionHtml = `
        <div class="archived-section-header"
          role="button"
          tabindex="0"
          aria-expanded="${archivedOpen}"
          data-searching="${isSearching}">
          <svg class="archived-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="${chevronStyle}" aria-hidden="true">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span>Archived (${archived.length})</span>
        </div>
        <div class="archived-notes-list" style="display: ${archivedOpen ? 'flex' : 'none'};">
          ${archivedCardsHtml}
        </div>
      `;
    }

    const activeCount = active.length;
    const archivedCount = archived.length;
    const noteCountLabel = `${activeCount} ${activeCount === 1 ? 'note' : 'notes'}` +
      (archivedCount > 0 ? ` · ${archivedCount} archived` : '');

    notesContent.innerHTML = `
      <div class="notes-list-header">
        <div class="notes-count">${noteCountLabel}</div>
      </div>
      <div class="notes-list">
        ${activeHtml}
        ${archivedSectionHtml}
      </div>
    `;

    // Add CSS for notes list
    this.addNotesListStyles();

    // Wire up archived section toggle
    const sectionHeader = notesContent.querySelector('.archived-section-header');
    if (sectionHeader) {
      const archivedList = notesContent.querySelector('.archived-notes-list');

      const toggle = () => {
        const nowOpen = sectionHeader.getAttribute('aria-expanded') === 'true';
        const nextOpen = !nowOpen;
        sectionHeader.setAttribute('aria-expanded', String(nextOpen));
        archivedList.style.display = nextOpen ? 'flex' : 'none';
        const chevron = sectionHeader.querySelector('.archived-chevron');
        if (chevron) {
          chevron.style.transform = nextOpen ? 'rotate(90deg)' : '';
        }
        // Only persist when not in a search context
        const searching = sectionHeader.getAttribute('data-searching') === 'true';
        if (!searching) {
          chrome.storage.local.set({ archivedSectionOpen: nextOpen }).catch(err => {
            console.warn('Could not persist archivedSectionOpen:', err);
          });
        }
      };

      sectionHeader.addEventListener('click', toggle);
      sectionHeader.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      });
    }

    // Add click/contextmenu handlers for ALL note items (active + archived).
    // Archived cards are in the DOM even when collapsed (display:none on the
    // container), so querySelectorAll picks them up correctly.
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

      const kebabBtn = item.querySelector('.note-kebab-btn');
      if (kebabBtn) {
        kebabBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          this.showNoteContextMenu(event, item, kebabBtn);
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
        border-bottom: 1px solid var(--border-color);
        margin-bottom: 6px;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }

      .notes-count {
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.06em;
        text-transform: uppercase;
        color: var(--text-muted);
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
        scrollbar-color: var(--bg-hover) transparent;
      }

      .notes-list::-webkit-scrollbar {
        width: 6px;
      }

      .notes-list::-webkit-scrollbar-thumb {
        background-color: transparent;
        border-radius: 4px;
      }

      .notes-list:hover::-webkit-scrollbar-thumb {
        background-color: var(--bg-hover);
      }
      
      .note-item {
        padding: 12px 14px;
        border: 1px solid var(--border-color);
        border-radius: 10px;
        cursor: pointer;
        transition: background-color 0.2s cubic-bezier(0.2, 0, 0, 1), border-color 0.2s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.15s cubic-bezier(0.2, 0, 0, 1);
        background: var(--bg-panel);
        width: 100%;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.03), 0 1px 2px rgba(0, 0, 0, 0.2);
      }

      .note-item:hover {
        background-color: var(--bg-hover);
        border-color: var(--text-muted);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0, 0, 0, 0.3);
        transform: translateY(-1px);
      }

      .note-item:active {
        transform: translateY(0);
      }

      .note-item.active {
        border-color: var(--accent-color);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 0 0 2px var(--accent-dim);
        background: var(--bg-hover);
      }
      
      .note-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 6px;
      }
      
      .note-subject {
        font-weight: 500;
        color: var(--text-main);
        font-size: 13px;
        flex: 1;
        truncate: ellipsis;
        overflow: hidden;
        white-space: nowrap;
      }
      
      .note-platform {
        font-size: 10px;
        font-weight: 500;
        letter-spacing: 0.03em;
        color: var(--text-muted);
        background: rgba(24, 24, 27, 0.7); /* --bg-app at 70% */
        border: 1px solid var(--border-color);
        padding: 2px 6px;
        height: 18px;
        line-height: 14px;
        border-radius: 8px;
        text-transform: capitalize;
        display: inline-flex;
        align-items: center;
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
        color: var(--text-muted);
        transition: background 0.2s cubic-bezier(0.2, 0, 0, 1), color 0.2s cubic-bezier(0.2, 0, 0, 1), transform 0.15s cubic-bezier(0.2, 0, 0, 1);
      }

      .note-open-btn:hover {
        background: var(--bg-hover);
        color: var(--accent-color);
      }

      .note-open-btn:active {
        transform: scale(0.92);
      }

      .note-open-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--accent-dim);
      }

      .note-open-icon {
        width: 16px;
        height: 16px;
        stroke: currentColor;
      }
      
      .note-preview {
        color: var(--text-muted);
        font-size: 12px;
        line-height: 1.4;
        margin-bottom: 6px;
        white-space: pre-wrap;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
      }

      .note-preview.rtl {
        direction: rtl;
        text-align: right;
      }
      
      .note-timestamp {
        color: var(--text-muted);
        font-size: 11px;
        opacity: 0.8;
      }

      /* --- Pinned indicator --- */
      .note-pin-icon {
        display: inline-block;
        vertical-align: middle;
        width: 12px;
        height: 12px;
        margin-right: 4px;
        flex-shrink: 0;
        color: var(--accent-color);
        position: relative;
        top: -1px;
      }

      /* --- Archived note card --- */
      .note-item.archived {
        opacity: 0.65;
      }

      .note-archived-chip {
        color: var(--text-muted);
        background: rgba(24, 24, 27, 0.7); /* --bg-app at 70% */
        border: 1px solid var(--border-color);
        font-style: italic;
      }

      /* --- Archived section header --- */
      .archived-section-header {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.05em;
        text-transform: uppercase;
        color: var(--text-muted);
        cursor: pointer;
        padding: 6px 4px 4px;
        border-radius: 6px;
        user-select: none;
        transition: background-color 0.15s cubic-bezier(0.2, 0, 0, 1);
        outline: none;
      }

      .archived-section-header:hover {
        background-color: var(--bg-hover);
      }

      .archived-section-header:focus-visible {
        box-shadow: 0 0 0 2px var(--accent-dim);
      }

      .archived-chevron {
        width: 13px;
        height: 13px;
        flex-shrink: 0;
        transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
      }

      /* --- Archived notes container --- */
      .archived-notes-list {
        display: flex;
        flex-direction: column;
        gap: 10px;
        padding-top: 4px;
      }

      /* --- Kebab button --- */
      .note-kebab-btn {
        border: none;
        background: transparent;
        padding: 4px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--text-muted);
        opacity: 0.35;
        transition: background 0.2s cubic-bezier(0.2, 0, 0, 1), color 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.15s cubic-bezier(0.2, 0, 0, 1), transform 0.15s cubic-bezier(0.2, 0, 0, 1);
        flex-shrink: 0;
      }

      .note-kebab-btn:hover {
        background: var(--bg-hover);
        color: var(--accent-color);
        opacity: 1;
      }

      .note-kebab-btn:active {
        transform: scale(0.92);
      }

      .note-kebab-btn:focus-visible {
        outline: none;
        box-shadow: 0 0 0 2px var(--accent-dim);
        opacity: 1;
      }

      .note-item:hover .note-kebab-btn,
      .note-item:focus-within .note-kebab-btn {
        opacity: 1;
      }

      /* --- Context menu entrance --- */
      @keyframes contextMenuIn {
        from {
          opacity: 0;
          transform: scale(0.95);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }

      /* --- Context menu surface --- */
      .note-context-menu {
        position: fixed;
        background: var(--bg-panel);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 6px 20px rgba(0, 0, 0, 0.5);
        min-width: 140px;
        font-size: 13px;
        z-index: 10002;
        padding: 4px 0;
        font-family: inherit;
        transform-origin: top;
        animation: contextMenuIn 0.12s cubic-bezier(0.2, 0, 0, 1) both;
      }

      /* --- Context menu items --- */
      .context-menu-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 12px;
        cursor: pointer;
        color: var(--text-main);
        transition: background-color 0.15s cubic-bezier(0.2, 0, 0, 1), color 0.15s cubic-bezier(0.2, 0, 0, 1);
        white-space: nowrap;
        user-select: none;
      }

      .context-menu-item:hover {
        background-color: var(--bg-hover);
        color: var(--accent-color);
      }

      .context-menu-item:focus-visible {
        outline: none;
        background-color: var(--bg-hover);
        box-shadow: inset 0 0 0 2px var(--accent-dim);
      }

      .context-menu-item svg {
        flex-shrink: 0;
        width: 14px;
        height: 14px;
      }

      .context-menu-item.destructive {
        color: var(--text-muted);
      }

      .context-menu-item.destructive:hover {
        background-color: rgba(220, 38, 38, 0.15);
        color: #f87171;
      }

      /* --- Search match highlight --- */
      .search-mark {
        background: var(--accent-dim);
        color: var(--text-main);
        border-radius: 2px;
        padding: 0 1px;
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
        this.showUndoToast('Unknown email platform. Cannot open thread.', null, { isError: true });
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
      this.showUndoToast('Unable to navigate to thread. Please try again.', null, { isError: true });
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

  showNoteContextMenu(event, noteItem, anchorEl = null) {
    // Remove any existing context menu first
    const existingMenu = document.querySelector('.note-context-menu');
    if (existingMenu) {
      existingMenu.remove();
    }

    const noteData = noteItem._noteData || {};
    const isPinned = !!noteData.pinned;
    const isArchived = !!noteData.archived;

    // SVG icons
    const pinSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="12" y1="17" x2="12" y2="22"></line>
      <path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path>
    </svg>`;
    const archiveSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="21 8 21 21 3 21 3 8"></polyline>
      <rect x="1" y="3" width="22" height="5"></rect>
      <line x1="10" y1="12" x2="14" y2="12"></line>
    </svg>`;
    const trashSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <polyline points="3 6 5 6 21 6"></polyline>
      <path d="M19 6l-1 14H6L5 6"></path>
      <path d="M10 11v6"></path>
      <path d="M14 11v6"></path>
      <path d="M9 6V4h6v2"></path>
    </svg>`;

    // Build menu items from a data array to avoid copy-pasted HTML blocks
    const items = [
      { action: 'pin',     label: isPinned  ? 'Unpin'     : 'Pin',       icon: pinSvg,     destructive: false },
      { action: 'archive', label: isArchived ? 'Unarchive' : 'Archive',   icon: archiveSvg, destructive: false },
      { action: 'delete',  label: 'Delete',                                icon: trashSvg,   destructive: true  },
    ];

    const contextMenu = document.createElement('div');
    contextMenu.className = 'note-context-menu';
    contextMenu.setAttribute('role', 'menu');

    items.forEach(({ action, label, icon, destructive }) => {
      const item = document.createElement('div');
      item.className = 'context-menu-item' + (destructive ? ' destructive' : '');
      item.setAttribute('role', 'menuitem');
      item.setAttribute('tabindex', '-1');
      item.innerHTML = icon + `<span>${label}</span>`;
      item.addEventListener('click', () => this._handleContextMenuAction(action, contextMenu, noteItem));
      contextMenu.appendChild(item);
    });

    // Initial off-screen placement so we can measure
    contextMenu.style.top = '-9999px';
    contextMenu.style.left = '-9999px';
    document.body.appendChild(contextMenu);

    // Determine raw position
    let rawTop, rawLeft;
    if (anchorEl) {
      const rect = anchorEl.getBoundingClientRect();
      rawTop = rect.bottom + 4;
      rawLeft = rect.right - contextMenu.offsetWidth;
    } else {
      rawTop = event.clientY;
      rawLeft = event.clientX;
    }

    // Clamp to viewport
    const menuW = contextMenu.offsetWidth;
    const menuH = contextMenu.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const top  = Math.min(rawTop,  vh - menuH - 4);
    const left = Math.max(4, Math.min(rawLeft, vw - menuW - 4));

    contextMenu.style.top  = `${top}px`;
    contextMenu.style.left = `${left}px`;

    // --- Cleanup helpers ---
    const removeMenu = () => {
      contextMenu.remove();
      document.removeEventListener('click', outsideClick);
      document.removeEventListener('keydown', escapeKey);
      const notesList = document.querySelector('.notes-list');
      if (notesList) {
        notesList.removeEventListener('scroll', removeMenu);
      }
    };

    const outsideClick = (e) => {
      if (!contextMenu.contains(e.target)) {
        removeMenu();
      }
    };

    const escapeKey = (e) => {
      if (e.key === 'Escape') {
        removeMenu();
      }
    };

    // Let menu-item clicks run the full cleanup instead of a bare .remove()
    contextMenu._cleanup = removeMenu;

    // Attach on next tick so the triggering click doesn't immediately close the menu
    setTimeout(() => {
      document.addEventListener('click', outsideClick);
      document.addEventListener('keydown', escapeKey);
      const notesList = document.querySelector('.notes-list');
      if (notesList) {
        notesList.addEventListener('scroll', removeMenu, { once: true });
      }
    }, 0);
  }

  async _handleContextMenuAction(action, menuEl, noteItem) {
    if (menuEl._cleanup) {
      menuEl._cleanup();
    } else {
      menuEl.remove();
    }

    if (action === 'delete') {
      await this.deleteNoteFromList(noteItem);
      return;
    }

    // Pin / Archive toggle
    const threadId = noteItem.getAttribute('data-thread-id');
    const noteData = noteItem._noteData || {};
    let fields;

    if (action === 'pin') {
      fields = { pinned: !noteData.pinned };
    } else if (action === 'archive') {
      fields = { archived: !noteData.archived };
    } else {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateNoteFields',
        threadId,
        fields,
      });

      if (response && response.success) {
        this.loadAllNotesView();

        // Show undo toast only when archiving (not unarchiving, not pinning)
        if (action === 'archive' && fields.archived === true) {
          this.showUndoToast('Note archived', async () => {
            const undoResp = await chrome.runtime.sendMessage({
              action: 'updateNoteFields',
              threadId,
              fields: { archived: false }
            });
            if (undoResp && undoResp.success) {
              this.loadAllNotesView();
            }
          });
        }
      } else {
        console.error('Failed to update note fields:', response?.error);
      }
    } catch (err) {
      console.error('Error updating note fields:', err);
    }
  }

  async deleteNoteFromList(noteItem) {
    const threadId = noteItem.getAttribute('data-thread-id');

    if (!threadId) {
      console.error('No thread ID found for note item');
      return;
    }

    // Keep note data for potential restore
    const savedNote = noteItem._noteData || null;

    try {
      console.log('Deleting note with thread ID:', threadId);

      const response = await chrome.runtime.sendMessage({
        action: 'deleteNote',
        threadId
      });

      if (response.success) {
        console.log('Note deleted successfully from list view');

        // Remove the item from the list with animation
        noteItem.style.transition = 'all 0.3s ease';
        noteItem.style.opacity = '0';
        noteItem.style.transform = 'translateX(-20px)';

        setTimeout(() => {
          this.loadAllNotesView();
        }, 300);

        // Show undo toast if we have data to restore
        if (savedNote) {
          this.showUndoToast('Note deleted', async () => {
            const restoreResp = await chrome.runtime.sendMessage({
              action: 'restoreNote',
              threadId,
              noteData: savedNote
            });
            if (restoreResp && restoreResp.success) {
              this.loadAllNotesView();
            }
          });
        }
      } else {
        console.error('Failed to delete note:', response.error);
      }
    } catch (error) {
      console.error('Error deleting note from list:', error);
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

    // Set archive state
    this.currentNoteArchived = !!noteData.archived;
    this.updateArchiveButtonState(true, this.currentNoteArchived);

    // Set pin state
    this.currentNotePinned = !!noteData.pinned;
    this.updatePinButtonState(true, this.currentNotePinned);

    const content = noteData.content || '';
    if (this.milkdownEditor) {
      try {
        await this.milkdownEditor.setMarkdown(content);
        // Critical: Detect direction after loading content
        setTimeout(() => {
          this.detectAndSetTextDirection();
        }, 50);
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

    // Set timeout for auto-save (1 second - very fast!)
    this.saveTimeout = setTimeout(() => {
      this.saveCurrentNote();
    }, 1000);

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

      // If content is empty, delete the note instead of saving
      if (!content) {
        const response = await chrome.runtime.sendMessage({
          action: 'deleteNote',
          threadId: this.currentThreadId
        });

        if (response.success) {
          this.updateSaveStatus('saved', 'Note cleared');

          // Note no longer exists - reset archive state
          this.currentNoteArchived = false;
          this.updateArchiveButtonState(false, false);

          // Reset pin state
          this.currentNotePinned = false;
          this.updatePinButtonState(false, false);

          // Clear last updated timestamp
          const lastUpdated = document.getElementById('lastUpdated');
          lastUpdated.textContent = '';

          // Refresh All Notes list if it's loaded
          if (this.allNotes) {
            this.loadAllNotesView();
          }

          setTimeout(() => {
            this.updateSaveStatus('ready', 'Ready');
          }, 2000);
        } else {
          this.updateSaveStatus('error', 'Clear failed');
          setTimeout(() => {
            this.updateSaveStatus('ready', 'Ready');
          }, 3000);
        }
        return;
      }

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

        // A note now exists for this thread; persist the newest-email
        // timestamp if we have one (fire-and-forget, no list re-render).
        if (this.currentLastEmailSeen) {
          this.maybeUpdateLastEmailSeen(this.currentThreadId, this.currentLastEmailSeen);
        }

        // Update last modified timestamp
        const lastUpdated = document.getElementById('lastUpdated');
        lastUpdated.textContent = this.formatTimestamp(new Date());

        // Enable archive button if it was previously disabled (new note)
        this.updateArchiveButtonState(true, this.currentNoteArchived);

        // Enable pin button if it was previously disabled (new note)
        this.updatePinButtonState(true, this.currentNotePinned);

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

    // Snapshot the thread ID and current view before the async gap
    const threadId = this.currentThreadId;

    try {
      // Fetch the full note before deleting so we can restore it on undo
      const getNoteResponse = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId
      });
      const savedNote = getNoteResponse && getNoteResponse.note ? getNoteResponse.note : null;

      this.updateSaveStatus('saving', 'Deleting...');

      const response = await chrome.runtime.sendMessage({
        action: 'deleteNote',
        threadId
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

        // Note no longer exists - reset archive state
        this.currentNoteArchived = false;
        this.updateArchiveButtonState(false, false);

        // Reset pin state
        this.currentNotePinned = false;
        this.updatePinButtonState(false, false);

        this.updateSaveStatus('saved', 'Note deleted');

        // Return to ready state after 2 seconds
        setTimeout(() => {
          this.updateSaveStatus('ready', 'Ready');
        }, 2000);

        // Refresh all notes list
        if (this.allNotes) {
          this.loadAllNotesView();
        }

        // Show undo toast if we have note data to restore
        if (savedNote) {
          this.showUndoToast('Note deleted', async () => {
            const restoreResp = await chrome.runtime.sendMessage({
              action: 'restoreNote',
              threadId,
              noteData: savedNote
            });
            if (restoreResp && restoreResp.success) {
              // Reload the thread view if we're still looking at the same thread
              if (this.currentView === 'thread' && this.currentThreadId === threadId) {
                await this.loadThreadNotes();
                this.updateArchiveButtonState(true, !!savedNote.archived);
                this.updatePinButtonState(true, !!savedNote.pinned);
              }
              // Always refresh the list
              if (this.allNotes) {
                this.loadAllNotesView();
              }
            }
          });
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

  updateArchiveButtonState(noteExists, archived) {
    const archiveBtn = document.getElementById('archiveNoteBtn');
    const archivedChip = document.getElementById('threadArchivedChip');

    if (!archiveBtn) return;

    archiveBtn.disabled = !noteExists;

    if (archived) {
      archiveBtn.classList.add('active');
      archiveBtn.title = 'Unarchive note';
      if (archivedChip) {
        archivedChip.style.display = 'inline-block';
      }
    } else {
      archiveBtn.classList.remove('active');
      archiveBtn.title = 'Archive note';
      if (archivedChip) {
        archivedChip.style.display = 'none';
      }
    }
  }

  async toggleArchiveCurrentNote() {
    if (!this.currentThreadId) return;

    const threadId = this.currentThreadId;
    const wasArchived = this.currentNoteArchived;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateNoteFields',
        threadId,
        fields: { archived: !wasArchived }
      });

      if (response && response.success) {
        this.currentNoteArchived = !!response.noteData?.archived;
        this.updateArchiveButtonState(true, this.currentNoteArchived);

        // Refresh All Notes data if loaded
        if (this.allNotes) {
          this.loadAllNotesView();
        }

        // Show undo toast only when the note was just archived
        if (this.currentNoteArchived) {
          this.showUndoToast('Note archived', async () => {
            const undoResp = await chrome.runtime.sendMessage({
              action: 'updateNoteFields',
              threadId,
              fields: { archived: false }
            });
            if (undoResp && undoResp.success) {
              this.currentNoteArchived = false;
              this.updateArchiveButtonState(true, false);
              if (this.allNotes) {
                this.loadAllNotesView();
              }
            }
          });
        }
      } else {
        console.error('Failed to update archive state:', response?.error);
      }
    } catch (error) {
      console.error('Error toggling archive:', error);
    }
  }

  updatePinButtonState(noteExists, pinned) {
    const pinBtn = document.getElementById('pinNoteBtn');
    if (!pinBtn) return;

    pinBtn.disabled = !noteExists;

    if (pinned) {
      pinBtn.classList.add('active');
      pinBtn.title = 'Unpin note';
    } else {
      pinBtn.classList.remove('active');
      pinBtn.title = 'Pin note';
    }
  }

  async togglePinCurrentNote() {
    if (!this.currentThreadId) return;

    const threadId = this.currentThreadId;
    const wasPinned = this.currentNotePinned;

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'updateNoteFields',
        threadId,
        fields: { pinned: !wasPinned }
      });

      if (response && response.success) {
        this.currentNotePinned = !!response.noteData?.pinned;
        this.updatePinButtonState(true, this.currentNotePinned);

        // Refresh All Notes data if loaded
        if (this.allNotes) {
          this.loadAllNotesView();
        }
      } else {
        console.error('Failed to update pin state:', response?.error);
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    }
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

  // Returns an HTML string with search match segments wrapped in <mark>.
  // XSS-safe: computes match offsets on raw text first, then escapes each
  // segment individually, so escaping never shifts the offsets.
  highlightMatches(text, searchTerm) {
    if (!searchTerm) return this.escapeHtml(text);

    const lowerText = text.toLowerCase();
    const termLen = searchTerm.length;
    const parts = [];
    let cursor = 0;

    let idx = lowerText.indexOf(searchTerm, cursor);
    while (idx !== -1) {
      // Non-matching segment before this match
      if (idx > cursor) {
        parts.push(this.escapeHtml(text.slice(cursor, idx)));
      }
      // Matching segment
      parts.push(`<mark class="search-mark">${this.escapeHtml(text.slice(idx, idx + termLen))}</mark>`);
      cursor = idx + termLen;
      idx = lowerText.indexOf(searchTerm, cursor);
    }

    // Remaining tail after last match
    if (cursor < text.length) {
      parts.push(this.escapeHtml(text.slice(cursor)));
    }

    return parts.join('');
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
      this.refreshStorageUsage();
    } else {
      settingsPanel.style.display = 'none';
      settingsToggle.classList.remove('active');
    }
  }

  async refreshStorageUsage() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getStorageUsage' });

      const fill = document.getElementById('storageMeterFill');
      const text = document.getElementById('storageUsageText');

      if (!response?.usage) {
        if (text) {
          text.textContent = 'Usage unavailable';
        }
        if (fill) {
          fill.style.width = '0%';
        }
        return;
      }

      const { used, quota, percentage } = response.usage;

      const usedKB = (used / 1024).toFixed(1);
      const quotaKB = Math.round(quota / 1024);
      const pct = Math.round(percentage);

      if (text) {
        text.textContent = `${usedKB} KB of ${quotaKB} KB used (${pct}%)`;
      }

      if (fill) {
        fill.style.width = `${Math.min(pct, 100)}%`;

        fill.classList.remove('warn', 'danger');
        if (pct >= 90) {
          fill.classList.add('danger');
        } else if (pct >= 80) {
          fill.classList.add('warn');
        }
      }
    } catch (error) {
      console.error('Error refreshing storage usage:', error);
      const text = document.getElementById('storageUsageText');
      if (text) {
        text.textContent = 'Usage unavailable';
      }
      const fill = document.getElementById('storageMeterFill');
      if (fill) {
        fill.style.width = '0%';
      }
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

  // Single-instance undo toast. If a toast is already visible the previous
  // one is dismissed (without running its undo callback) before the new one
  // appears.
  showUndoToast(message, onUndo = null, { duration = 5000, isError = false } = {}) {
    this.hideUndoToast();

    const toast = document.getElementById('undoToast');
    if (!toast) return;

    // Clear previous content
    toast.innerHTML = '';
    toast.className = 'undo-toast' + (isError ? ' error' : '');

    const msgSpan = document.createElement('span');
    msgSpan.textContent = message;
    toast.appendChild(msgSpan);

    if (onUndo) {
      const undoBtn = document.createElement('button');
      undoBtn.className = 'undo-btn';
      undoBtn.textContent = 'Undo';
      undoBtn.addEventListener('click', () => {
        this.hideUndoToast();
        onUndo();
      });
      toast.appendChild(undoBtn);
    }

    toast.style.display = 'flex';

    this._undoToastTimer = setTimeout(() => {
      this.hideUndoToast();
    }, duration);
  }

  hideUndoToast() {
    if (this._undoToastTimer) {
      clearTimeout(this._undoToastTimer);
      this._undoToastTimer = null;
    }
    const toast = document.getElementById('undoToast');
    if (toast) {
      toast.style.display = 'none';
    }
  }

  focusEditor() {
    try {
      if (this.milkdownEditor && this.milkdownEditor.focus) {
        this.milkdownEditor.focus();
      } else if (this.fallbackEditor) {
        this.fallbackEditor.focus();
      } else {
        // Try to find ProseMirror editor directly
        const prosemirror = document.querySelector('.ProseMirror');
        if (prosemirror) {
          prosemirror.focus();
        }
      }
    } catch (error) {
      console.log('Could not focus editor:', error);
    }
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
        rootElement.classList.add('rtl-content');
        rootElement.classList.remove('ltr-content');

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
        rootElement.classList.add('ltr-content');
        rootElement.classList.remove('rtl-content');

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
