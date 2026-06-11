// Outlook content script for sidebar architecture - Thread detection only
class OutlookSidebarConnector {
  constructor() {
    this.currentThreadId = null;
    this.currentSubject = null;
    this.currentAccount = null;
    this.currentAccountEmail = null;
    this.currentPlatform = this.detectPlatform();
    this.extensionEnabled = true;
    this._tsLogged = false; // throttle timestamp-scrape failure logging (reset per thread)
    this._tsRetryTimeout = null; // pending lazy-render retry for timestamp scrape
    this.init();
  }

  async init() {
    console.log('Outlook Sidebar Connector initialized for platform:', this.currentPlatform);
    
    // Check if extension is enabled
    await this.checkExtensionState();
    
    // Detect current Outlook account
    this.detectCurrentAccount();
    
    // Setup message listener
    this.setupMessageListener();
    
    if (this.extensionEnabled) {
      // Wait for Outlook to load
      setTimeout(() => {
        this.setupThreadDetection();
      }, 3000); // Outlook needs more time to load
    }
  }

  detectPlatform() {
    const hostname = window.location.hostname;
    if (hostname.includes('outlook.office365.com') || hostname.includes('outlook.office.com')) {
      return 'Outlook 365';
    } else if (hostname.includes('outlook.live.com')) {
      return 'Outlook Live';
    }
    return 'Outlook';
  }

  setupThreadDetection() {
    // Detect thread changes on URL changes
    let lastUrl = location.href;
    const checkUrlChange = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        setTimeout(() => this.detectCurrentThread(), 500);
      }
    };
    
    setInterval(checkUrlChange, 1000);
    
    // Initial detection
    this.detectCurrentThread();
  }

  detectCurrentThread() {
    if (!this.extensionEnabled) return;
    
    const threadId = this.getThreadIdFromUrl();
    const subject = this.getCurrentThreadSubject();
    
    if (threadId && threadId !== this.currentThreadId) {
      console.log('OUTLOOK THREAD CHANGED:', this.currentThreadId, '->', threadId);
      this.currentThreadId = threadId;
      this.currentSubject = subject;

      // Reset per-thread timestamp logging and cancel any pending retry
      this._tsLogged = false;
      if (this._tsRetryTimeout) {
        clearTimeout(this._tsRetryTimeout);
        this._tsRetryTimeout = null;
      }

      const lastEmailSeen = this.getLastEmailTimestamp();

      // Notify sidebar of thread change
      this.notifySidebar('threadChanged', {
        threadId: this.getAccountSpecificThreadId(threadId),
        originalThreadId: threadId,
        platform: 'outlook',
        subject: subject,
        account: this.currentAccount,
        accountEmail: this.currentAccountEmail,
        lastEmailSeen: lastEmailSeen
      });

      // Outlook also renders conversations lazily; if the scrape came back
      // empty, retry once after a short delay and send a follow-up if it
      // succeeds and we're still on the same thread.
      if (lastEmailSeen === null) {
        this._tsRetryTimeout = setTimeout(() => {
          this._tsRetryTimeout = null;
          if (this.currentThreadId !== threadId) return;
          const retryTs = this.getLastEmailTimestamp();
          if (retryTs !== null && this.currentThreadId === threadId) {
            this.notifySidebar('threadChanged', {
              threadId: this.getAccountSpecificThreadId(threadId),
              originalThreadId: threadId,
              platform: 'outlook',
              subject: this.currentSubject,
              account: this.currentAccount,
              accountEmail: this.currentAccountEmail,
              lastEmailSeen: retryTs
            });
          }
        }, 1500);
      }

    } else if (threadId && threadId === this.currentThreadId && subject !== this.currentSubject) {
      // Same thread but subject changed (page loaded more content)
      console.log('OUTLOOK SUBJECT UPDATED:', this.currentSubject, '->', subject);
      this.currentSubject = subject;

      this.notifySidebar('threadChanged', {
        threadId: this.getAccountSpecificThreadId(threadId),
        originalThreadId: threadId,
        platform: 'outlook',
        subject: subject,
        account: this.currentAccount,
        accountEmail: this.currentAccountEmail,
        lastEmailSeen: this.getLastEmailTimestamp()
      });

    } else if (!threadId && this.currentThreadId) {
      // No thread detected
      console.log('No Outlook thread detected');
      this.currentThreadId = null;
      this.currentSubject = null;
      
      this.notifySidebar('threadChanged', {
        threadId: null,
        platform: 'outlook'
      });
    }
  }

  getThreadIdFromUrl() {
    const url = window.location.href;
    console.log('=== OUTLOOK URL PARSING ===');
    console.log('Full URL:', url);
    
    // Outlook URL patterns for thread/conversation detection
    const patterns = [
      // Primary Outlook 365 patterns (most specific first)
      /\/mail\/inbox\/id\/([A-Za-z0-9%._=-]+)/,
      /\/mail\/.*\/id\/([A-Za-z0-9%._=-]+)/,
      /\/mail\/.*\/conversationId\/([A-Za-z0-9%._=-]+)/,
      
      // Query parameter patterns
      /[?&]itemId=([A-Za-z0-9%._=-]+)/,
      /[?&]convId=([A-Za-z0-9%._=-]+)/,
      /[?&]id=([A-Za-z0-9%._=-]+)/,
      
      // Outlook Live patterns  
      /\/mail\/[^\/]*\/([A-Za-z0-9%._=-]{30,})/,
      
      // General patterns for long IDs
      /\/([A-Za-z0-9%._=-]{30,})(?:[\/\?]|$)/,
    ];
    
    for (let i = 0; i < patterns.length; i++) {
      const pattern = patterns[i];
      const match = url.match(pattern);
      if (match) {
        let threadId = match[1];
        // Keep URL encoding for proper ID preservation
        console.log(`Found Outlook thread ID with pattern ${i}:`, threadId);
        
        // Validate that this looks like a proper Outlook ID
        if (threadId.length >= 20) {
          return threadId;
        }
      }
    }
    
    console.log('No Outlook thread ID found in URL');
    return null;
  }

  getAccountSpecificThreadId(threadId) {
    return `${this.currentAccount}_${threadId}`;
  }

  getCurrentThreadSubject() {
    console.log('=== OUTLOOK SUBJECT DETECTION ===');
    
    // Try multiple selectors to find the email subject in Outlook
    const selectors = [
      // Primary Outlook subject selectors (most specific first)
      'span[data-subject]',
      '[data-automation-id="SubjectLine"]',
      '[data-automation-id="ConversationTitle"]',
      
      // Message header subject selectors
      '.ms-MessageHeader h1',
      '.ms-MessageHeader h2',
      '.ms-MessageHeader .ms-font-weight-semibold',
      
      // Reading pane subject selectors
      '.ReadingPaneContent h1',
      '.ReadingPaneContent h2:first-of-type',
      '.ConversationReadingPane h1',
      '.ConversationReadingPane h2:first-of-type',
      
      // Conversation view selectors
      '.ms-ConversationHeader h1',
      '.ms-ConversationHeader h2',
      '.ms-ConversationHeader [role="heading"]',
      
      // General subject selectors with filters
      'h1:not([aria-hidden="true"]):not(.ms-nav-header)',
      'h2:not([aria-hidden="true"]):not(.ms-nav-header)',
      
      // Fallback selectors
      '[aria-label*="Subject" i]:not([aria-hidden="true"])',
      '.allowTextSelection[title]:not([aria-hidden="true"])',
    ];
    
    for (let i = 0; i < selectors.length; i++) {
      const selector = selectors[i];
      console.log(`Trying selector ${i}: ${selector}`);
      
      const elements = document.querySelectorAll(selector);
      console.log(`Found ${elements.length} elements`);
      
      for (const element of elements) {
        if (element && element.textContent && element.textContent.trim()) {
          const text = element.textContent.trim();
          console.log(`Checking text: "${text}"`);
          
          // More comprehensive filtering to avoid UI elements
          if (this.isValidSubjectText(text)) {
            console.log(`✓ Valid subject found: "${text}"`);
            // Return truncated subject
            let subject = text;
            if (subject.length > 40) {
              subject = subject.substring(0, 40) + '...';
            }
            return subject;
          } else {
            console.log(`✗ Invalid subject text: "${text}"`);
          }
        }
      }
    }
    
    console.log('No valid subject found');
    return null;
  }

  isValidSubjectText(text) {
    console.log(`Validating subject text: "${text}"`);
    
    // Skip very short text
    if (text.length < 3) {
      console.log('✗ Too short');
      return false;
    }
    
    // Skip if text is only numbers or special characters
    if (!/[a-zA-Z\u0590-\u05FF\u0600-\u06FF\u4e00-\u9fff]/.test(text)) {
      console.log('✗ No letters found');
      return false;
    }
    
    // List of common UI elements to filter out (in multiple languages)
    const uiElements = [
      // English UI elements
      'outlook', 'microsoft', 'menu', 'navigation', 'toolbar', 'sidebar', 'panel',
      'search', 'filter', 'sort', 'new', 'reply', 'forward', 'delete', 'move',
      'inbox', 'sent', 'drafts', 'folder', 'settings', 'calendar', 'contacts',
      'compose', 'attach', 'send', 'save', 'print', 'home', 'view',
      
      // Hebrew UI elements
      'חלונית ניווט', 'תפריט', 'חיפוש', 'מיון', 'תיקיה', 'דואר נכנס', 'טיוטות',
      'הגדרות', 'יומן', 'אנשי קשר', 'חדש', 'מחק', 'העבר', 'השב', 'העבר הלאה',
      'חלונית', 'ניווט', 'תפריט ראשי', 'בית', 'צפייה',
      
      // Other common patterns
      'loading', 'טוען', 'please wait', 'אנא המתן', 'close', 'סגור'
    ];
    
    const lowerText = text.toLowerCase();
    
    // Check against UI elements list
    for (const uiElement of uiElements) {
      if (lowerText.includes(uiElement.toLowerCase()) || text.includes(uiElement)) {
        console.log(`✗ Contains UI element: ${uiElement}`);
        return false;
      }
    }
    
    // Skip if element is likely a UI control (contains common control text)
    if (lowerText.match(/^(button|link|tab|close|minimize|maximize|×|✕)$/)) {
      console.log('✗ Looks like UI control');
      return false;
    }
    
    // Skip if text looks like a date or time
    if (text.match(/^\d{1,2}\/\d{1,2}\/\d{2,4}$/) || text.match(/^\d{1,2}:\d{2}$/)) {
      console.log('✗ Looks like date/time');
      return false;
    }
    
    // Accept if text looks like an email subject (reasonable length, contains letters)
    const isValid = text.length >= 3 && text.length <= 200;
    console.log(`${isValid ? '✓' : '✗'} Final validation: ${isValid}`);
    return isValid;
  }

  // Scrape the newest message's timestamp (epoch ms) from the open conversation.
  // Outlook's date markup is hard to pin down, so we collect candidate
  // [title] elements, scan from the end, and take the first parseable date.
  // Resilience over precision: returns null on any failure and never throws.
  getLastEmailTimestamp() {
    try {
      // Gather candidate date-bearing elements (titles often hold full datetimes).
      const candidates = [
        ...document.querySelectorAll('div[data-convid] span[title]'),
        ...document.querySelectorAll('[role="main"] span[title]')
      ];

      if (!candidates.length) {
        this._logTimestampFailure('No span[title] date candidates found');
        return null;
      }

      // Cap the scan at the last 30 candidates for performance.
      const start = Math.max(0, candidates.length - 30);

      // Iterate from the END; first parseable title wins (newest message).
      for (let i = candidates.length - 1; i >= start; i--) {
        const title = candidates[i].getAttribute('title');
        if (!title) continue;
        const parsed = Date.parse(title.trim());
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }

      this._logTimestampFailure('No parseable date title among candidates');
      return null;
    } catch (error) {
      this._logTimestampFailure('Error scraping timestamp: ' + (error && error.message));
      return null;
    }
  }

  // Log a timestamp-scrape failure at most once per thread (console.debug).
  _logTimestampFailure(reason) {
    if (this._tsLogged) return;
    this._tsLogged = true;
    console.debug('getLastEmailTimestamp:', reason);
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
      // Try to get Outlook account info
      const emailAddress = this.getOutlookUserEmail();
      
      // Create account identifier
      this.currentAccount = `outlook_account_0`; // Simplified for now
      this.currentAccountEmail = emailAddress;
      
      console.log('Detected Outlook account:', this.currentAccount, 'Email:', emailAddress);
      
      // Notify sidebar of platform/account
      this.notifySidebar('platformChanged', {
        platform: this.currentPlatform,
        account: this.currentAccount,
        accountEmail: emailAddress
      });
      
    } catch (error) {
      console.error('Error detecting Outlook account:', error);
      this.currentAccount = 'outlook_account_0';
      this.currentAccountEmail = null;
    }
  }

  getOutlookUserEmail() {
    try {
      // Try various methods to get user email from Outlook
      const selectors = [
        // Outlook 365 selectors
        '[data-automation-id="userEmail"]',
        '.ms-Persona-primaryText',
        '.UserTile [title*="@"]',
        
        // Profile/account selectors
        '[aria-label*="@"]',
        '[title*="@"]',
        
        // General email pattern in page
        '*[data-email]'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const email = this.extractEmailFromElement(element);
          if (email) return email;
        }
      }
      
      // Try to find email in page content
      const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
      const pageText = document.body.textContent;
      const matches = pageText.match(emailRegex);
      
      if (matches) {
        // Filter out common non-user emails and find user email
        const userEmail = matches.find(email => 
          !email.includes('noreply') && 
          !email.includes('support') && 
          !email.includes('no-reply') &&
          !email.includes('microsoft.com') &&
          (email.includes('outlook.com') || email.includes('hotmail.com') || email.includes('live.com'))
        );
        if (userEmail) return userEmail;
        
        // Return first reasonable email found
        return matches[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting Outlook user email:', error);
      return null;
    }
  }

  extractEmailFromElement(element) {
    try {
      // Check data attributes
      if (element.dataset.email) return element.dataset.email;
      
      // Check aria-label
      if (element.getAttribute('aria-label')) {
        const ariaLabel = element.getAttribute('aria-label');
        const emailMatch = ariaLabel.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (emailMatch) return emailMatch[1];
      }
      
      // Check title attribute
      if (element.title) {
        const titleMatch = element.title.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (titleMatch) return titleMatch[1];
      }
      
      // Check text content
      if (element.textContent) {
        const textMatch = element.textContent.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
        if (textMatch) return textMatch[1];
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
  
  setupMessageListener() {
    // Listen for messages from sidebar
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === 'getCurrentThread') {
        // Respond with current thread info
        sendResponse({
          threadId: this.currentThreadId ? this.getAccountSpecificThreadId(this.currentThreadId) : null,
          originalThreadId: this.currentThreadId,
          platform: 'outlook',
          subject: this.getCurrentThreadSubject(),
          account: this.currentAccount,
          accountEmail: this.currentAccountEmail,
          lastEmailSeen: this.getLastEmailTimestamp()
        });
      } else if (message.action === 'getUpdatedSubject') {
        // Get fresh subject for current thread
        const subject = this.getCurrentThreadSubject();
        sendResponse({
          threadId: this.currentThreadId ? this.getAccountSpecificThreadId(this.currentThreadId) : null,
          subject: subject
        });
      } else if (message.action === 'toggleExtension') {
        this.extensionEnabled = message.enabled;
        console.log('Extension toggled:', this.extensionEnabled);
        
        if (this.extensionEnabled) {
          // Re-detect current thread
          this.detectCurrentThread();
        } else {
          // Clear current thread
          this.currentThreadId = null;
          this.currentSubject = null;
          this.notifySidebar('threadChanged', { threadId: null, platform: 'outlook' });
        }
        
        sendResponse({ success: true });
      }
    });
  }

  notifySidebar(action, data) {
    try {
      // Send message to sidebar (runtime messaging will route to sidebar)
      chrome.runtime.sendMessage({
        action: action,
        ...data
      }).catch(error => {
        // Sidebar might not be open, which is fine
        console.log('Could not notify sidebar:', error.message);
      });
    } catch (error) {
      console.log('Error notifying sidebar:', error);
    }
  }
}

// Initialize when on Outlook
const currentHost = window.location.hostname;
if (currentHost.includes('outlook.office365.com') || 
    currentHost.includes('outlook.office.com') || 
    currentHost.includes('outlook.live.com')) {
  new OutlookSidebarConnector();
}