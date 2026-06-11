// Gmail content script for sidebar architecture - Thread detection only
class GmailSidebarConnector {
  constructor() {
    this.currentThreadId = null;
    this.currentSubject = null;
    this.currentAccount = null;
    this.currentAccountEmail = null;
    this.currentAccountIndex = null;
    this.extensionEnabled = true;
    this._tsLogged = false; // throttle timestamp-scrape failure logging (reset per thread)
    this._tsRetryTimeout = null; // pending lazy-render retry for timestamp scrape
    this.init();
  }

  async init() {
    console.log('Gmail Sidebar Connector initialized');
    
    // Check if extension is enabled
    await this.checkExtensionState();
    
    // Detect current Gmail account
    this.detectCurrentAccount();
    
    // Setup message listener
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
  }

  detectCurrentThread() {
    if (!this.extensionEnabled) return;

    const threadId = this.getThreadIdFromUrl();
    const subject = this.getCurrentThreadSubject();

    console.log('🔍 detectCurrentThread:', {
      detectedThreadId: threadId,
      currentThreadId: this.currentThreadId,
      changed: threadId !== this.currentThreadId,
      url: window.location.href
    });

    if (threadId && threadId !== this.currentThreadId) {
      console.log('✅ THREAD CHANGED:', this.currentThreadId, '->', threadId);
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
        platform: 'gmail',
        subject: subject,
        account: this.currentAccount,
        accountEmail: this.currentAccountEmail,
        lastEmailSeen: lastEmailSeen
      });

      // Gmail renders conversations lazily; if the scrape came back empty,
      // retry once after a short delay and send a follow-up if it succeeds
      // and we're still on the same thread.
      if (lastEmailSeen === null) {
        this._tsRetryTimeout = setTimeout(() => {
          this._tsRetryTimeout = null;
          if (this.currentThreadId !== threadId) return;
          const retryTs = this.getLastEmailTimestamp();
          if (retryTs !== null && this.currentThreadId === threadId) {
            this.notifySidebar('threadChanged', {
              threadId: this.getAccountSpecificThreadId(threadId),
              originalThreadId: threadId,
              platform: 'gmail',
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
      console.log('SUBJECT UPDATED:', this.currentSubject, '->', subject);
      this.currentSubject = subject;

      this.notifySidebar('threadChanged', {
        threadId: this.getAccountSpecificThreadId(threadId),
        originalThreadId: threadId,
        platform: 'gmail',
        subject: subject,
        account: this.currentAccount,
        accountEmail: this.currentAccountEmail,
        lastEmailSeen: this.getLastEmailTimestamp()
      });

    } else if (!threadId && this.currentThreadId) {
      // No thread detected
      console.log('No thread detected');
      this.currentThreadId = null;
      this.currentSubject = null;
      
      this.notifySidebar('threadChanged', {
        threadId: null,
        platform: 'gmail'
      });
    }
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

  getAccountSpecificThreadId(threadId) {
    return `${this.currentAccount}_${threadId}`;
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

  // Scrape the newest message's timestamp (epoch ms) from the open conversation.
  // Resilience over precision: returns null on any failure and never throws.
  getLastEmailTimestamp() {
    try {
      // Prefer date elements inside the conversation container; fall back globally.
      let dateEls = document.querySelectorAll('div[role="main"] span.g3');
      if (!dateEls.length) {
        dateEls = document.querySelectorAll('span.g3');
      }
      if (!dateEls.length) {
        this._logTimestampFailure('No span.g3 date elements found');
        return null;
      }

      // The last element is the newest message in conversation view.
      const el = dateEls[dateEls.length - 1];

      // Try title, then data-tooltip, then textContent.
      const sources = [
        el.getAttribute('title'),
        el.getAttribute('data-tooltip'),
        el.textContent
      ];

      for (const source of sources) {
        if (!source) continue;
        const parsed = Date.parse(source.trim());
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }

      this._logTimestampFailure('Could not parse any date source from newest message');
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
      // Detect Gmail account from URL
      const match = window.location.href.match(/mail\.google\.com\/mail\/u\/(\d+)/);
      const accountIndex = match ? match[1] : '0';
      
      // Try to get the actual email address
      const emailAddress = this.getGmailUserEmail();
      
      // Store both internal ID and email address
      this.currentAccount = `gmail_account_${accountIndex}`;
      this.currentAccountEmail = emailAddress;
      this.currentAccountIndex = accountIndex;
      
      console.log('Detected Gmail account:', this.currentAccount, 'Email:', emailAddress);
      
      // Notify sidebar of platform/account
      this.notifySidebar('platformChanged', {
        platform: 'Gmail',
        account: this.currentAccount,
        accountEmail: emailAddress
      });
      
    } catch (error) {
      console.error('Error detecting account:', error);
      this.currentAccount = 'gmail_account_0';
      this.currentAccountEmail = null;
      this.currentAccountIndex = '0';
    }
  }

  getGmailUserEmail() {
    try {
      // Method 1: Try to find email in Gmail's profile area
      const profileSelectors = [
        '[data-email]', // Some Gmail elements have email in data attribute
        '.gb_A', // Google account info area
        '.gb_C', // Profile information
        '[aria-label*="@"]', // Elements with email in aria-label
      ];
      
      for (const selector of profileSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          const email = this.extractEmailFromElement(element);
          if (email) return email;
        }
      }
      
      // Method 2: Try to get from page title or other sources
      const titleMatch = document.title.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (titleMatch) return titleMatch[1];
      
      // Method 3: Look for email in any text content (last resort)
      const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
      const bodyText = document.body.textContent;
      const matches = bodyText.match(emailRegex);
      
      if (matches) {
        // Filter out common non-user emails
        const userEmail = matches.find(email => 
          !email.includes('noreply') && 
          !email.includes('support') && 
          !email.includes('no-reply') &&
          email.includes('gmail.com') // Prefer gmail addresses for gmail accounts
        );
        if (userEmail) return userEmail;
        
        // Fallback to first email found
        return matches[0];
      }
      
      return null;
    } catch (error) {
      console.error('Error extracting Gmail user email:', error);
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
          platform: 'gmail',
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
          this.notifySidebar('threadChanged', { threadId: null, platform: 'gmail' });
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

// Initialize when on Gmail
if (window.location.href.includes('mail.google.com')) {
  new GmailSidebarConnector();
}