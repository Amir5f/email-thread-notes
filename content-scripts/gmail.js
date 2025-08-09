// Gmail content script for Email Thread Notes extension

class GmailThreadDetector {
  constructor() {
    this.currentThreadId = null;
    this.notesPanel = null;
    this.observer = null;
    this.init();
  }

  init() {
    // Wait for Gmail to load
    if (this.isGmailLoaded()) {
      this.setupThreadDetection();
    } else {
      // Wait for Gmail interface to load
      const checkGmail = setInterval(() => {
        if (this.isGmailLoaded()) {
          clearInterval(checkGmail);
          this.setupThreadDetection();
        }
      }, 1000);
    }
  }

  isGmailLoaded() {
    // Check for Gmail's main container
    return document.querySelector('[role="main"]') !== null && 
           document.querySelector('[data-thread-id]') !== null;
  }

  setupThreadDetection() {
    // Initial thread detection
    this.detectCurrentThread();
    
    // Set up observer for URL changes and DOM updates
    this.setupUrlObserver();
    this.setupDomObserver();
    
    // Listen for Gmail's navigation events
    this.setupNavigationListener();
  }

  setupUrlObserver() {
    // Watch for URL changes (Gmail uses pushState for navigation)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(() => this.detectCurrentThread(), 500);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  setupDomObserver() {
    // Watch for changes in the main Gmail container
    const mainContainer = document.querySelector('[role="main"]');
    if (mainContainer) {
      this.observer = new MutationObserver((mutations) => {
        let shouldRedetect = false;
        mutations.forEach((mutation) => {
          // Check if thread-related elements changed
          if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
            const hasThreadChanges = Array.from(mutation.addedNodes).some(node => 
              node.nodeType === 1 && (
                node.querySelector && node.querySelector('[data-thread-id]') ||
                node.getAttribute && node.getAttribute('data-thread-id')
              )
            );
            if (hasThreadChanges) {
              shouldRedetect = true;
            }
          }
        });
        
        if (shouldRedetect) {
          setTimeout(() => this.detectCurrentThread(), 200);
        }
      });
      
      this.observer.observe(mainContainer, {
        childList: true,
        subtree: true
      });
    }
  }

  setupNavigationListener() {
    // Listen for Gmail's custom navigation events
    window.addEventListener('popstate', () => {
      setTimeout(() => this.detectCurrentThread(), 300);
    });

    // Add keyboard shortcut (Ctrl/Cmd + Shift + N)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
        e.preventDefault();
        this.toggleNotesPanel();
      }
    });

    // Add notes button to Gmail interface
    this.addNotesButton();
    
    // Add floating action button as fallback
    this.addFloatingButton();
  }

  toggleNotesPanel() {
    if (!this.currentThreadId) {
      console.log('No thread detected');
      return;
    }

    if (this.notesPanel && this.notesPanel.classList.contains('visible')) {
      this.hideNotesPanel();
    } else {
      this.showNotesPanel(this.currentThreadId);
    }
  }

  addNotesButton() {
    // Only add button in conversation view, not in inbox list view
    const addButton = () => {
      // Remove existing button if it exists
      const existingButton = document.querySelector('.gmail-notes-button');
      if (existingButton) {
        existingButton.remove();
      }

      // Only show button when viewing a specific conversation (not in inbox list)
      const isInConversationView = window.location.hash.includes('/') && 
                                  !window.location.hash.includes('#inbox') &&
                                  !window.location.hash.includes('#search') &&
                                  !window.location.hash.includes('#label');
      
      if (!isInConversationView) {
        console.log('Not in conversation view - skipping toolbar button');
        return;
      }

      // Look for conversation-specific toolbars (avoid inbox toolbars)
      const toolbarSelectors = [
        // Conversation view specific toolbars
        '.nH .ar .G-Ni', // Main conversation toolbar
        '.adn .ar .G-Ni', // Alternative conversation toolbar
        '.if .ar .G-Ni', // Another conversation toolbar
      ];

      let toolbar = null;
      for (const selector of toolbarSelectors) {
        const candidate = document.querySelector(selector);
        if (candidate && this.isToolbarVisible(candidate) && this.isConversationToolbar(candidate)) {
          toolbar = candidate;
          break;
        }
      }

      if (toolbar) {
        const notesButton = document.createElement('div');
        notesButton.className = 'gmail-notes-button';
        notesButton.innerHTML = '📝';
        notesButton.title = 'Add notes to this conversation (Ctrl+Shift+N)';
        
        // Compact button styling to avoid conflicts
        notesButton.style.cssText = `
          cursor: pointer;
          padding: 8px 10px;
          border-radius: 4px;
          margin: 0 2px;
          background: #f8f9fa;
          border: 1px solid #dadce0;
          font-size: 16px;
          color: #3c4043;
          display: inline-block;
          user-select: none;
          white-space: nowrap;
          position: relative;
          z-index: 99;
          line-height: 16px;
          min-width: auto;
          text-align: center;
          vertical-align: middle;
        `;

        // Event listeners
        notesButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.toggleNotesPanel();
        });

        notesButton.addEventListener('mouseenter', () => {
          notesButton.style.backgroundColor = '#e8eaed';
        });

        notesButton.addEventListener('mouseleave', () => {
          notesButton.style.backgroundColor = '#f8f9fa';
        });

        // Insert at the beginning of toolbar to avoid covering other buttons
        toolbar.insertBefore(notesButton, toolbar.firstChild);
      }
    };

    // Add button with proper timing
    setTimeout(addButton, 1000);
    setTimeout(addButton, 3000);
    
    // Reduced frequency checking to avoid performance issues
    const checkForToolbar = setInterval(addButton, 5000);

    // Clean up after reasonable time
    setTimeout(() => {
      clearInterval(checkForToolbar);
    }, 30000);
  }

  isConversationToolbar(toolbar) {
    // Check if toolbar is part of a conversation view, not inbox
    return toolbar.closest('.adn, .if') !== null || 
           toolbar.closest('[data-thread-id]') !== null ||
           (!toolbar.closest('.ae4') && !toolbar.closest('.TO')); // Not in inbox list
  }

  isToolbarVisible(toolbar) {
    return toolbar && 
           toolbar.offsetWidth > 0 && 
           toolbar.offsetHeight > 0 && 
           getComputedStyle(toolbar).display !== 'none';
  }

  isButtonClickable(button) {
    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const elementAtPoint = document.elementFromPoint(centerX, centerY);
    return elementAtPoint === button || button.contains(elementAtPoint);
  }

  addFloatingButton() {
    // Add a floating action button that's always accessible
    if (document.querySelector('.gmail-floating-notes-button')) return;

    const floatingButton = document.createElement('div');
    floatingButton.className = 'gmail-floating-notes-button';
    floatingButton.innerHTML = '📝';
    floatingButton.title = 'Add notes to this conversation (Ctrl+Shift+N)';
    
    floatingButton.style.cssText = `
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
      transition: all 0.2s ease;
      user-select: none;
    `;

    // Enhanced interactions
    floatingButton.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleNotesPanel();
    });

    floatingButton.addEventListener('mouseenter', () => {
      floatingButton.style.transform = 'scale(1.1)';
      floatingButton.style.boxShadow = '0 6px 16px rgba(0,0,0,0.3)';
    });

    floatingButton.addEventListener('mouseleave', () => {
      floatingButton.style.transform = 'scale(1)';
      floatingButton.style.boxShadow = '0 4px 12px rgba(0,0,0,0.2)';
    });

    // Show/hide based on thread detection
    floatingButton.style.display = this.currentThreadId ? 'flex' : 'none';

    document.body.appendChild(floatingButton);
  }

  detectCurrentThread() {
    const threadId = this.extractThreadId();
    
    console.log('=== DETECT CURRENT THREAD ===');
    console.log('URL:', window.location.href);
    console.log('Hash:', window.location.hash);
    console.log('Extracted thread ID:', threadId);
    console.log('Current stored thread ID:', this.currentThreadId);
    console.log('Are they different?', threadId !== this.currentThreadId);
    
    // FORCE thread change detection for debugging
    if (threadId) {
      if (threadId !== this.currentThreadId) {
        console.log('THREAD CHANGED:', this.currentThreadId, '->', threadId);
        this.currentThreadId = threadId;
        this.onThreadChange(threadId);
      } else {
        console.log('NO THREAD CHANGE DETECTED - SAME ID:', threadId);
        // TEMP: Force show what extractThreadId is doing for this "same" thread
        console.log('Re-running extractThreadId to debug...');
        this.extractThreadId(); // This will show all the debug logs
      }
    } else if (!threadId && this.currentThreadId) {
      console.log('NO THREAD DETECTED - clearing current thread');
      this.currentThreadId = null;
      this.hideNotesPanel();
    } else {
      console.log('NO THREAD ID EXTRACTED AT ALL');
    }
  }

  extractThreadId() {
    // REVERTED TO ORIGINAL WORKING METHOD - conversation mode only
    const hash = window.location.hash;
    console.log('Current URL hash:', hash);
    
    // Method 1: Check URL for thread ID (most reliable)
    const urlMatch = hash.match(/thread-([a-f\d]+)/);
    if (urlMatch) {
      console.log('Thread ID from URL:', urlMatch[1]);
      return urlMatch[1];
    }

    // Method 2: Look for thread ID in DOM attributes
    const threadElement = document.querySelector('[data-thread-id]');
    if (threadElement) {
      const threadId = threadElement.getAttribute('data-thread-id');
      console.log('Thread ID from DOM data-thread-id:', threadId);
      return this.cleanThreadId(threadId);
    }

    // Method 3: Look for conversation view elements
    const convElement = document.querySelector('[data-legacy-thread-id]');
    if (convElement) {
      const threadId = convElement.getAttribute('data-legacy-thread-id');
      console.log('Thread ID from legacy-thread-id:', threadId);
      return this.cleanThreadId(threadId);
    }

    // Method 4: Extract from Gmail's internal structure
    const messageElements = document.querySelectorAll('[data-message-id]');
    if (messageElements.length > 0) {
      const firstMessage = messageElements[0];
      const threadContext = firstMessage.closest('[data-thread-id]');
      if (threadContext) {
        const threadId = threadContext.getAttribute('data-thread-id');
        console.log('Thread ID from message context:', threadId);
        return this.cleanThreadId(threadId);
      }
    }

    // Method 5: Generate ID from URL hash as fallback
    if (hash) {
      const fallbackId = this.generateThreadId(hash);
      console.log('Thread ID from URL hash fallback:', fallbackId);
      return fallbackId;
    }

    console.log('No thread ID found');
    return null;
  }

  cleanThreadId(rawId) {
    // Remove Gmail's prefixes and format the thread ID
    return rawId.replace(/^#?thread-[a-z]:/, '').replace(/^#?conversation-/, '');
  }

  generateThreadId(text) {
    // Better hash function to generate more unique thread IDs
    let hash1 = 0;
    let hash2 = 0;
    
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash1 = ((hash1 << 5) - hash1) + char;
      hash1 = hash1 & hash1; // Convert to 32-bit integer
      
      hash2 = char + (hash2 << 6) + (hash2 << 16) - hash2;
      hash2 = hash2 & hash2;
    }
    
    // Combine both hashes and add length for extra uniqueness
    const combined = Math.abs(hash1) + Math.abs(hash2) + text.length;
    return combined.toString(16);
  }

  async onThreadChange(threadId) {
    console.log('Gmail thread changed to:', threadId);
    
    // Handle panel visibility and content when thread changes
    if (this.notesPanel && this.notesPanel.classList.contains('visible')) {
      const currentThread = this.notesPanel.getAttribute('data-current-thread');
      if (currentThread !== threadId) {
        console.log('Thread changed from', currentThread, 'to', threadId);
        
        // Option 1: Close panel when thread changes (cleaner UX)
        this.hideNotesPanel();
        
        // Option 2: Uncomment below to auto-refresh panel with new thread's notes
        /*
        console.log('Auto-updating panel for new thread:', threadId);
        const noteData = await this.loadNotesForThread(threadId);
        await this.updateNotesPanel(threadId, noteData);
        */
      }
    }
    
    // Update floating button visibility
    const floatingButton = document.querySelector('.gmail-floating-notes-button');
    if (floatingButton) {
      floatingButton.style.display = threadId ? 'flex' : 'none';
    }
  }

  async loadNotesForThread(threadId) {
    try {
      console.log('Loading notes for thread:', threadId);
      const response = await chrome.runtime.sendMessage({
        action: 'getNote',
        threadId: threadId
      });
      
      console.log('Notes loaded for thread', threadId, ':', response.note);
      return response.note;
    } catch (error) {
      console.error('Error loading notes for thread', threadId, ':', error);
      return null;
    }
  }

  async showNotesPanel(threadId) {
    console.log('=== SHOWING NOTES PANEL ===');
    console.log('Current thread ID:', threadId);
    console.log('Current URL:', window.location.hash);
    
    // Check if panel exists and is for a different thread - if so, recreate it
    if (this.notesPanel) {
      const currentPanelThread = this.notesPanel.getAttribute('data-current-thread');
      console.log('Existing panel thread ID:', currentPanelThread);
      
      if (currentPanelThread && currentPanelThread !== threadId) {
        console.log('Thread changed - recreating panel');
        this.notesPanel.remove();
        this.notesPanel = null;
      }
    }
    
    // Create or update notes panel
    if (!this.notesPanel) {
      console.log('Creating new notes panel');
      this.createNotesPanel();
    }
    
    // Force clear the panel before loading new content
    const textarea = this.notesPanel.querySelector('.email-notes-textarea');
    const timestamp = this.notesPanel.querySelector('.email-notes-timestamp');
    const threadSubject = this.notesPanel.querySelector('.thread-subject');
    
    console.log('Clearing panel content...');
    textarea.value = '';
    timestamp.textContent = '';
    threadSubject.textContent = 'Loading...';
    this.notesPanel.setAttribute('data-current-thread', '');
    
    // Load existing note for this thread
    const existingNote = await this.loadNotesForThread(threadId);
    console.log('Loaded note for thread', threadId, ':', existingNote);
    
    // Update panel content
    await this.updateNotesPanel(threadId, existingNote);
    
    // Show panel
    this.notesPanel.classList.add('visible');
    
    // Position panel appropriately
    this.positionNotesPanel();
  }

  createNotesPanel() {
    // Remove existing panel if any
    if (this.notesPanel) {
      this.notesPanel.remove();
    }

    // Create panel HTML
    this.notesPanel = document.createElement('div');
    this.notesPanel.className = 'email-notes-panel';
    this.notesPanel.innerHTML = `
      <div class="email-notes-header">
        <div class="email-notes-title-section">
          <h4 class="email-notes-title">📝 Thread Notes</h4>
          <div class="email-notes-thread-info">
            <span class="thread-subject">Loading...</span>
          </div>
        </div>
        <button class="email-notes-close" title="Close notes">×</button>
      </div>
      <div class="email-notes-content">
        <textarea 
          class="email-notes-textarea" 
          placeholder="Type your private notes here... Notes save automatically as you type."
          maxlength="5000"
        ></textarea>
        <div class="email-notes-help">
          💡 <strong>Auto-saves:</strong> Notes save automatically after you stop typing for 1 second
        </div>
      </div>
      <div class="email-notes-footer">
        <div class="email-notes-save-status">
          <span class="status-indicator">●</span>
          <span class="status-text">Ready to type</span>
        </div>
        <span class="email-notes-timestamp"></span>
      </div>
    `;

    // Add to page
    document.body.appendChild(this.notesPanel);

    // Setup event listeners
    this.setupPanelEventListeners();
  }

  setupPanelEventListeners() {
    const textarea = this.notesPanel.querySelector('.email-notes-textarea');
    const closeButton = this.notesPanel.querySelector('.email-notes-close');
    const statusIndicator = this.notesPanel.querySelector('.status-indicator');
    const statusText = this.notesPanel.querySelector('.status-text');

    // Auto-save functionality with better visual feedback
    let saveTimeout;
    let isTyping = false;
    
    textarea.addEventListener('input', () => {
      if (!isTyping) {
        isTyping = true;
        statusIndicator.style.color = '#fbbf24'; // Yellow for typing
        statusText.textContent = 'Typing...';
      }
      
      // Clear previous timeout
      clearTimeout(saveTimeout);
      
      // Set new timeout for auto-save
      saveTimeout = setTimeout(async () => {
        await this.saveCurrentNote();
        isTyping = false;
      }, 1000); // Save after 1 second of no typing
    });

    // Show immediate feedback when user starts typing
    textarea.addEventListener('focus', () => {
      if (statusText.textContent === 'Ready to type') {
        statusText.textContent = 'Start typing to add notes...';
      }
    });

    // Close button
    closeButton.addEventListener('click', () => {
      this.hideNotesPanel();
    });

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (this.notesPanel && 
          this.notesPanel.classList.contains('visible') && 
          !this.notesPanel.contains(e.target) &&
          !this.isClickOnEmailThread(e.target)) {
        this.hideNotesPanel();
      }
    });

    // Prevent panel from losing focus when clicking inside
    this.notesPanel.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  isClickOnEmailThread(element) {
    // Check if click is on email thread elements that should keep panel open
    return element.closest('[data-thread-id]') !== null ||
           element.closest('.nH') !== null ||
           element.closest('[role="main"]') !== null;
  }

  async updateNotesPanel(threadId, noteData) {
    console.log('=== UPDATING NOTES PANEL ===');
    console.log('Thread ID:', threadId);
    console.log('Note data:', noteData);
    
    const textarea = this.notesPanel.querySelector('.email-notes-textarea');
    const timestamp = this.notesPanel.querySelector('.email-notes-timestamp');
    const statusIndicator = this.notesPanel.querySelector('.status-indicator');
    const statusText = this.notesPanel.querySelector('.status-text');
    const threadSubject = this.notesPanel.querySelector('.thread-subject');
    
    // Set current thread ID
    this.notesPanel.setAttribute('data-current-thread', threadId);
    console.log('Set panel thread ID to:', threadId);
    
    // Update thread information in header (just the subject)
    const currentSubject = this.getCurrentThreadSubject();
    threadSubject.textContent = currentSubject || 'Gmail Conversation';
    threadSubject.title = currentSubject || 'No subject available';
    console.log('Set panel subject to:', currentSubject);
    
    // Update textarea content and status
    if (noteData && noteData.content) {
      // Force clear first, then set content
      textarea.value = '';
      textarea.textContent = '';
      
      // Set new content
      textarea.value = noteData.content;
      textarea.textContent = noteData.content;
      
      // Force DOM update
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      
      console.log('Set textarea content to:', noteData.content);
      console.log('Textarea actual value:', textarea.value);
      
      // Update timestamp
      const date = new Date(noteData.lastModified || noteData.timestamp);
      timestamp.textContent = `Last saved: ${this.formatTimestamp(date)}`;
      
      // Show that there's existing content
      statusIndicator.style.color = '#6b7280';
      statusText.textContent = 'Edit and auto-save will update';
    } else {
      // Force clear
      textarea.value = '';
      textarea.textContent = '';
      timestamp.textContent = '';
      
      console.log('No note data - cleared textarea');
      console.log('Textarea actual value after clear:', textarea.value);
      
      // Show ready state for new note
      statusIndicator.style.color = '#6b7280';
      statusText.textContent = 'Ready to type';
    }
    
    // Focus textarea
    setTimeout(() => {
      textarea.focus();
      // Place cursor at end if there's existing content
      if (textarea.value.length > 0) {
        textarea.selectionStart = textarea.selectionEnd = textarea.value.length;
      }
    }, 100);
  }

  getCurrentThreadSubject() {
    // Try to find subject in the currently active conversation area
    const activeConversation = document.querySelector('.adn, .if') || document.querySelector('[role="main"]');
    
    if (activeConversation) {
      // Look for subject within the active conversation first
      const subjectSelectors = [
        '.hP', // Main subject line
        '.bog', // Alternative subject selector
        '.a1f', // Another Gmail subject selector
        'h2', // Subject as h2
      ];

      for (const selector of subjectSelectors) {
        const element = activeConversation.querySelector(selector);
        if (element && element.textContent.trim()) {
          let subject = element.textContent.trim();
          // Limit length for display
          if (subject.length > 40) {
            subject = subject.substring(0, 40) + '...';
          }
          console.log('Found subject in active conversation:', subject);
          return subject;
        }
      }
    }

    // Fallback to general document search
    const fallbackSelectors = [
      '.nH[role="main"] .hP',
      '.nH[role="main"] .bog', 
      '.hP', 
      '.bog',
      '.a1f'
    ];

    for (const selector of fallbackSelectors) {
      const element = document.querySelector(selector);
      if (element && element.textContent.trim()) {
        let subject = element.textContent.trim();
        if (subject.length > 40) {
          subject = subject.substring(0, 40) + '...';
        }
        console.log('Found subject in fallback:', subject);
        return subject;
      }
    }

    console.log('No subject found');
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

  async saveCurrentNote() {
    const textarea = this.notesPanel.querySelector('.email-notes-textarea');
    const statusIndicator = this.notesPanel.querySelector('.status-indicator');
    const statusText = this.notesPanel.querySelector('.status-text');
    const timestamp = this.notesPanel.querySelector('.email-notes-timestamp');
    const threadId = this.notesPanel.getAttribute('data-current-thread');

    if (!threadId) return;

    try {
      statusIndicator.style.color = '#3b82f6'; // Blue for saving
      statusText.textContent = 'Saving...';
      
      const content = textarea.value.trim();
      
      if (content) {
        // Save note
        console.log('Saving note for thread:', threadId, 'Content length:', content.length);
        const response = await chrome.runtime.sendMessage({
          action: 'saveNote',
          threadId: threadId,
          content: content,
          platform: 'gmail'
        });

        console.log('Save response for thread', threadId, ':', response);

        if (response.success) {
          statusIndicator.style.color = '#10b981'; // Green for saved
          statusText.textContent = '✓ Saved automatically';
          timestamp.textContent = `Last saved: ${this.formatTimestamp(new Date())}`;
          
          // Add visual indicator to Gmail thread
          this.addThreadIndicator(threadId);
          
          // Show success briefly, then return to ready state
          setTimeout(() => {
            statusIndicator.style.color = '#6b7280'; // Gray for ready
            statusText.textContent = 'Ready (auto-saves as you type)';
          }, 2000);
          
        } else {
          statusIndicator.style.color = '#ef4444'; // Red for error
          statusText.textContent = 'Error saving - try again';
          console.error('Failed to save note:', response.error);
          
          setTimeout(() => {
            statusIndicator.style.color = '#6b7280';
            statusText.textContent = 'Ready to type';
          }, 3000);
        }
      } else {
        // Delete note if content is empty
        const response = await chrome.runtime.sendMessage({
          action: 'deleteNote',
          threadId: threadId
        });

        if (response.success) {
          statusIndicator.style.color = '#f59e0b'; // Orange for deletion
          statusText.textContent = 'Note deleted (was empty)';
          timestamp.textContent = '';
          
          // Remove visual indicator
          this.removeThreadIndicator(threadId);
          
          setTimeout(() => {
            statusIndicator.style.color = '#6b7280';
            statusText.textContent = 'Ready to type';
          }, 2000);
        }
      }
      
    } catch (error) {
      console.error('Error saving note:', error);
      statusIndicator.style.color = '#ef4444';
      statusText.textContent = 'Connection error - check extension';
      
      setTimeout(() => {
        statusIndicator.style.color = '#6b7280';
        statusText.textContent = 'Ready to type';
      }, 3000);
    }
  }

  positionNotesPanel() {
    if (!this.notesPanel) return;

    // Get Gmail's main container
    const mainContainer = document.querySelector('[role="main"]');
    if (!mainContainer) return;

    const containerRect = mainContainer.getBoundingClientRect();
    const panelWidth = 300;
    const margin = 20;

    // Position on the right side of the main container
    const left = Math.min(
      containerRect.right + margin,
      window.innerWidth - panelWidth - margin
    );
    
    const top = Math.max(
      containerRect.top + margin,
      margin
    );

    this.notesPanel.style.left = `${left}px`;
    this.notesPanel.style.top = `${top}px`;
    this.notesPanel.style.position = 'fixed';
  }

  addThreadIndicator(threadId) {
    // Add visual indicator to show thread has notes
    const threadElements = document.querySelectorAll(`[data-thread-id="${threadId}"]`);
    threadElements.forEach(element => {
      if (!element.querySelector('.gmail-notes-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'gmail-notes-indicator';
        indicator.title = 'This thread has notes';
        
        // Find a good place to insert the indicator
        const titleElement = element.querySelector('.bog') || 
                           element.querySelector('.hP') ||
                           element.querySelector('.a1f');
        
        if (titleElement) {
          titleElement.appendChild(indicator);
        }
      }
    });
  }

  removeThreadIndicator(threadId) {
    // Remove visual indicator when note is deleted
    const indicators = document.querySelectorAll(`[data-thread-id="${threadId}"] .gmail-notes-indicator`);
    indicators.forEach(indicator => indicator.remove());
  }

  hideNotesPanel() {
    if (this.notesPanel) {
      this.notesPanel.classList.remove('visible');
    }
  }
}

// Initialize Gmail thread detector when script loads
if (window.location.href.includes('mail.google.com')) {
  // Wait a bit for Gmail to fully load
  setTimeout(() => {
    new GmailThreadDetector();
  }, 1500);
}