# Gmail Notes Add-on - Comprehensive Migration Plan

**Date**: December 27, 2025
**From**: Chrome Extension (Side Panel) → Google Workspace Add-on
**Target**: Fresh repository with complete architecture redesign

---

## Table of Contents
1. [Repository Strategy](#repository-strategy)
2. [Architecture Comparison](#architecture-comparison)
3. [Technical Implementation Plan](#technical-implementation-plan)
4. [Feature Mapping](#feature-mapping)
5. [Data Storage Strategy](#data-storage-strategy)
6. [UI/UX Design](#uiux-design)
7. [Development Timeline](#development-timeline)
8. [Deployment Strategy](#deployment-strategy)
9. [Testing Plan](#testing-plan)
10. [Known Challenges & Solutions](#known-challenges--solutions)

---

## 1. Repository Strategy

### **Decision: Fresh Repository (Not Fork)**

**Why NOT fork:**
- Completely different codebase structure
- Different technology stack (Apps Script vs Chrome Extension APIs)
- No shared code between repos
- Clean git history for new project
- Different CI/CD requirements

**Why fresh repo:**
- ✅ Clean slate for Apps Script architecture
- ✅ Independent version history
- ✅ Simpler for contributors to understand
- ✅ No Chrome extension baggage in git history
- ✅ Can reference old repo in docs without coupling

### **Repository Setup**

**New repo name**: `gmail-notes-addon`

**Initial structure**:
```
gmail-notes-addon/
├── .gitignore
├── README.md
├── LICENSE                    # Copy from old repo
├── .clasp.json               # Clasp (Apps Script CLI) config
├── appsscript.json           # Add-on manifest
│
├── src/                      # Server-side Apps Script
│   ├── Code.js              # Main entry point
│   ├── Storage.js           # Notes CRUD operations
│   ├── GmailContext.js      # Gmail API interactions
│   └── Utils.js             # Helper functions
│
├── ui/                       # Client-side HTML/CSS/JS
│   ├── Sidebar.html         # Main notes editor
│   ├── Styles.html          # CSS styles
│   └── Client.js.html       # Client-side JavaScript
│
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md
│   ├── SETUP.md
│   ├── API.md
│   └── DEPLOYMENT.md
│
├── tests/                    # Unit tests (Apps Script testing)
│   └── Storage.test.js
│
└── assets/                   # Icons, images
    └── icon.png
```

### **What to Reference from Old Repo**

Create `MIGRATION_NOTES.md` in new repo documenting:
- Link to Chrome extension repo
- Key learnings from Chrome extension development
- UX decisions that worked well
- Problems we're solving (split pane detection, auto-close, etc.)
- Why we migrated

---

## 2. Architecture Comparison

### **Chrome Extension (Old)**

```
┌─────────────────────────────────────────────┐
│           Browser (Chrome)                   │
│  ┌────────────────────────────────────────┐ │
│  │  Background Service Worker             │ │
│  │  - Message routing                     │ │
│  │  - Storage management                  │ │
│  └────────────────────────────────────────┘ │
│                    ↕                         │
│  ┌────────────────────────────────────────┐ │
│  │  Content Scripts (gmail-sidebar.js)    │ │
│  │  - DOM scraping for thread ID          │ │
│  │  - URL monitoring                      │ │
│  └────────────────────────────────────────┘ │
│                    ↕                         │
│  ┌────────────────────────────────────────┐ │
│  │  Side Panel (sidebar.html)             │ │
│  │  - Milkdown editor                     │ │
│  │  - All Notes view                      │ │
│  └────────────────────────────────────────┘ │
│                    ↕                         │
│  ┌────────────────────────────────────────┐ │
│  │  Chrome Storage Sync                   │ │
│  │  - 8KB per item limit                  │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### **Google Workspace Add-on (New)**

```
┌──────────────────────────────────────────────────┐
│              Gmail (Web Interface)               │
│  ┌─────────────────────────────────────────────┐│
│  │  Contextual Sidebar (Right Panel)           ││
│  │  ┌─────────────────────────────────────────┐││
│  │  │  Sidebar.html (iframe)                  │││
│  │  │  - Simple textarea or contenteditable  │││
│  │  │  - Lightweight UI                       │││
│  │  └─────────────────────────────────────────┘││
│  │                    ↕                         ││
│  │  Apps Script triggers contextual events     ││
│  └─────────────────────────────────────────────┘│
│                      ↕                           │
│  ┌─────────────────────────────────────────────┐│
│  │  Google Apps Script (Server-side)           ││
│  │  ┌─────────────────────────────────────────┐││
│  │  │  Code.js                                │││
│  │  │  - onGmailMessageOpen()                 │││
│  │  │  - onGmailCompose()                     │││
│  │  └─────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────┐││
│  │  │  Storage.js                             │││
│  │  │  - PropertiesService API                │││
│  │  │  - 500KB per property limit             │││
│  │  └─────────────────────────────────────────┘││
│  │  ┌─────────────────────────────────────────┐││
│  │  │  GmailContext.js                        │││
│  │  │  - Gmail API integration                │││
│  │  │  - Thread metadata access               │││
│  │  └─────────────────────────────────────────┘││
│  └─────────────────────────────────────────────┘│
└──────────────────────────────────────────────────┘
```

### **Key Architectural Differences**

| Aspect | Chrome Extension | Workspace Add-on |
|--------|-----------------|------------------|
| **Runtime** | Client-side (browser) | Server-side (Google Cloud) + Client UI |
| **Thread Detection** | URL parsing + DOM scraping | Gmail API context (guaranteed) |
| **Split Pane** | ❌ Fails (URL doesn't change) | ✅ Works (event-driven) |
| **Storage** | Chrome Sync (8KB/item) | PropertiesService (500KB/property) |
| **UI Framework** | Full HTML/CSS/JS freedom | HTML in iframe + CSP restrictions |
| **Triggers** | User clicks, URL changes | Gmail events (message open, compose) |
| **Offline** | ✅ Works | ❌ Requires internet |
| **Cross-browser** | Chrome only | ✅ Any browser with Gmail |
| **Mobile** | ❌ No | ✅ Works in Gmail mobile app |

---

## 3. Technical Implementation Plan

### **Phase 1: Core Infrastructure (Day 1-2)**

#### **3.1. Apps Script Project Setup**

**File**: `appsscript.json`
```json
{
  "timeZone": "America/New_York",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Gmail",
        "version": "v1",
        "serviceId": "gmail"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "gmail": {
    "name": "Gmail Notes",
    "logoUrl": "https://your-domain.com/icon.png",
    "contextualTriggers": [
      {
        "unconditional": {},
        "onTriggerFunction": "onGmailMessageOpen"
      }
    ],
    "primaryColor": "#4285f4",
    "secondaryColor": "#ffffff",
    "openLinkUrlPrefixes": [
      "https://mail.google.com"
    ],
    "universalActions": [
      {
        "label": "All Notes",
        "openLink": "https://script.google.com/macros/..."
      }
    ],
    "useLocaleFromApp": true
  }
}
```

**OAuth Scopes Required**:
```json
"oauthScopes": [
  "https://www.googleapis.com/auth/gmail.addons.current.message.readonly",
  "https://www.googleapis.com/auth/script.storage",
  "https://www.googleapis.com/auth/gmail.readonly"
]
```

#### **3.2. Development Environment**

**Tools needed**:
1. **clasp** (Command Line Apps Script Projects)
   ```bash
   npm install -g @google/clasp
   clasp login
   clasp create --type standalone --title "Gmail Notes Add-on"
   ```

2. **Development workflow**:
   ```bash
   # Local development
   clasp push          # Push code to Apps Script
   clasp open          # Open in Apps Script editor
   clasp logs          # View execution logs
   ```

3. **Testing**:
   - Use Apps Script built-in debugger
   - Gmail test environment (add-on testing mode)
   - Unit tests with `GasT` framework

#### **3.3. Entry Point - Code.js**

```javascript
/**
 * Main entry point - triggered when user opens a Gmail message
 * @param {Object} e - Event object from Gmail
 * @returns {Card} - Card UI to display
 */
function onGmailMessageOpen(e) {
  console.log('Gmail message opened', e);

  // Extract context from Gmail
  const messageId = e.messageMetadata.messageId;
  const threadId = e.gmail.threadId;
  const subject = e.messageMetadata.subject;
  const accessToken = e.gmail.accessToken;

  // Get or create note for this thread
  const note = Storage.getNote(threadId);

  // Build and return the sidebar UI
  return buildSidebar({
    threadId: threadId,
    subject: subject,
    note: note,
    messageId: messageId
  });
}

/**
 * Build the sidebar card UI
 */
function buildSidebar(context) {
  // Option A: Use Google's Card framework (simpler, limited)
  return buildCardUI(context);

  // Option B: Use HTML Service (full control, iframe restrictions)
  // return buildHtmlUI(context);
}

/**
 * Handle save action from UI
 */
function saveNote(threadId, content) {
  const result = Storage.saveNote(threadId, content);

  if (result.success) {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Note saved'))
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(CardService.newNotification()
        .setText('Save failed: ' + result.error))
      .build();
  }
}
```

---

### **Phase 2: Storage Implementation (Day 2-3)**

#### **3.4. Storage.js - Notes CRUD**

**Storage Options Analysis**:

| Option | Pros | Cons | Limit |
|--------|------|------|-------|
| **PropertiesService** | Simple key-value, fast | 500KB total | 500KB |
| **ScriptDB** (deprecated) | - | No longer available | - |
| **Spreadsheet** | Unlimited, queryable | Slower, requires Drive API | ~5M cells |
| **Drive Files** | Unlimited | Complex, slow | Quota-based |

**Decision**: Use **PropertiesService** for fast access, with Spreadsheet backup for unlimited storage.

**Implementation**:

```javascript
/**
 * Storage.js - Note storage and retrieval
 */

const STORAGE_VERSION = '1.0';
const MAX_NOTES_IN_PROPERTIES = 100; // Keep recent notes fast
const PROPERTIES_KEY_PREFIX = 'note_';

class NotesStorage {

  constructor() {
    this.properties = PropertiesService.getUserProperties();
    this.spreadsheetId = this._getOrCreateSpreadsheet();
  }

  /**
   * Get note for a thread
   * @param {string} threadId - Gmail thread ID
   * @returns {Object|null} - Note object or null
   */
  getNote(threadId) {
    const key = PROPERTIES_KEY_PREFIX + threadId;
    const stored = this.properties.getProperty(key);

    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse note:', e);
        return null;
      }
    }

    // Fallback to spreadsheet for older notes
    return this._getFromSpreadsheet(threadId);
  }

  /**
   * Save note for a thread
   * @param {string} threadId
   * @param {string} content
   * @param {Object} metadata - subject, timestamp, etc.
   * @returns {Object} - {success: boolean, error?: string}
   */
  saveNote(threadId, content, metadata = {}) {
    const note = {
      threadId: threadId,
      content: content,
      subject: metadata.subject || '',
      lastModified: new Date().toISOString(),
      version: STORAGE_VERSION,
      ...metadata
    };

    const key = PROPERTIES_KEY_PREFIX + threadId;

    try {
      // Save to Properties for fast access
      this.properties.setProperty(key, JSON.stringify(note));

      // Also save to spreadsheet for backup
      this._saveToSpreadsheet(note);

      return { success: true };
    } catch (e) {
      console.error('Save failed:', e);
      return { success: false, error: e.message };
    }
  }

  /**
   * Delete note
   */
  deleteNote(threadId) {
    const key = PROPERTIES_KEY_PREFIX + threadId;
    this.properties.deleteProperty(key);
    this._deleteFromSpreadsheet(threadId);
    return { success: true };
  }

  /**
   * Get all notes (for "All Notes" view)
   * @returns {Array} - Array of note objects
   */
  getAllNotes() {
    const allProps = this.properties.getProperties();
    const notes = [];

    for (const [key, value] of Object.entries(allProps)) {
      if (key.startsWith(PROPERTIES_KEY_PREFIX)) {
        try {
          notes.push(JSON.parse(value));
        } catch (e) {
          console.error('Failed to parse note:', key);
        }
      }
    }

    // Sort by lastModified descending
    notes.sort((a, b) =>
      new Date(b.lastModified) - new Date(a.lastModified)
    );

    return notes;
  }

  /**
   * Get or create backup spreadsheet
   * @private
   */
  _getOrCreateSpreadsheet() {
    const scriptProps = PropertiesService.getScriptProperties();
    let spreadsheetId = scriptProps.getProperty('BACKUP_SPREADSHEET_ID');

    if (!spreadsheetId) {
      // Create new spreadsheet
      const ss = SpreadsheetApp.create('Gmail Notes Backup');
      spreadsheetId = ss.getId();
      scriptProps.setProperty('BACKUP_SPREADSHEET_ID', spreadsheetId);

      // Set up headers
      const sheet = ss.getActiveSheet();
      sheet.appendRow(['Thread ID', 'Subject', 'Content', 'Last Modified', 'Created']);
    }

    return spreadsheetId;
  }

  /**
   * Save to spreadsheet backup
   * @private
   */
  _saveToSpreadsheet(note) {
    try {
      const ss = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = ss.getActiveSheet();

      // Check if note exists
      const data = sheet.getDataRange().getValues();
      let rowIndex = -1;

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === note.threadId) {
          rowIndex = i + 1;
          break;
        }
      }

      const row = [
        note.threadId,
        note.subject,
        note.content,
        note.lastModified,
        note.created || note.lastModified
      ];

      if (rowIndex > 0) {
        // Update existing
        sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
      } else {
        // Append new
        sheet.appendRow(row);
      }
    } catch (e) {
      console.error('Spreadsheet save failed:', e);
      // Don't fail the whole save operation
    }
  }

  /**
   * Get from spreadsheet (for old notes not in Properties)
   * @private
   */
  _getFromSpreadsheet(threadId) {
    try {
      const ss = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = ss.getActiveSheet();
      const data = sheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === threadId) {
          return {
            threadId: data[i][0],
            subject: data[i][1],
            content: data[i][2],
            lastModified: data[i][3],
            created: data[i][4]
          };
        }
      }
    } catch (e) {
      console.error('Spreadsheet read failed:', e);
    }

    return null;
  }

  /**
   * Delete from spreadsheet
   * @private
   */
  _deleteFromSpreadsheet(threadId) {
    try {
      const ss = SpreadsheetApp.openById(this.spreadsheetId);
      const sheet = ss.getActiveSheet();
      const data = sheet.getDataRange().getValues();

      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === threadId) {
          sheet.deleteRow(i + 1);
          break;
        }
      }
    } catch (e) {
      console.error('Spreadsheet delete failed:', e);
    }
  }
}

// Singleton instance
const Storage = new NotesStorage();
```

---

### **Phase 3: Gmail Context Integration (Day 3-4)**

#### **3.5. GmailContext.js - Gmail API Wrapper**

```javascript
/**
 * GmailContext.js - Gmail API integration
 */

class GmailContextManager {

  /**
   * Get full thread details from Gmail API
   * @param {string} threadId
   * @returns {Object} - Thread metadata
   */
  getThreadDetails(threadId) {
    try {
      const thread = Gmail.Users.Threads.get('me', threadId);

      return {
        id: thread.id,
        snippet: thread.snippet,
        historyId: thread.historyId,
        messages: thread.messages.map(msg => ({
          id: msg.id,
          threadId: msg.threadId,
          labelIds: msg.labelIds,
          snippet: msg.snippet,
          internalDate: msg.internalDate,
          from: this._extractHeader(msg, 'From'),
          to: this._extractHeader(msg, 'To'),
          subject: this._extractHeader(msg, 'Subject'),
          date: this._extractHeader(msg, 'Date')
        }))
      };
    } catch (e) {
      console.error('Failed to get thread details:', e);
      return null;
    }
  }

  /**
   * Get thread subject (from first message)
   * @param {string} threadId
   * @returns {string}
   */
  getThreadSubject(threadId) {
    try {
      const thread = Gmail.Users.Threads.get('me', threadId, {
        format: 'metadata',
        metadataHeaders: ['Subject']
      });

      if (thread.messages && thread.messages.length > 0) {
        return this._extractHeader(thread.messages[0], 'Subject');
      }
    } catch (e) {
      console.error('Failed to get subject:', e);
    }

    return 'Email Thread';
  }

  /**
   * Extract header value from message
   * @private
   */
  _extractHeader(message, headerName) {
    if (!message.payload || !message.payload.headers) {
      return '';
    }

    const header = message.payload.headers.find(
      h => h.name.toLowerCase() === headerName.toLowerCase()
    );

    return header ? header.value : '';
  }

  /**
   * Check if thread is in a specific label
   */
  hasLabel(threadId, labelName) {
    try {
      const thread = Gmail.Users.Threads.get('me', threadId);
      const labels = thread.messages[0].labelIds || [];

      // Get all user labels
      const allLabels = Gmail.Users.Labels.list('me').labels;
      const targetLabel = allLabels.find(l => l.name === labelName);

      if (targetLabel) {
        return labels.includes(targetLabel.id);
      }
    } catch (e) {
      console.error('Failed to check label:', e);
    }

    return false;
  }
}

const GmailContext = new GmailContextManager();
```

---

### **Phase 4: UI Implementation (Day 4-6)**

#### **3.6. UI Approach Decision**

**Two options for UI**:

**Option A: Card Service (Google's framework)**
- ✅ Pros: Simple, consistent, works on mobile
- ❌ Cons: Limited customization, no rich text editor

**Option B: HTML Service (Custom HTML)**
- ✅ Pros: Full control, can add text formatting
- ❌ Cons: CSP restrictions, iframe issues, mobile compatibility

**Decision**: **Start with Option A (Cards)**, add Option B later if needed.

#### **3.7. Card UI Implementation**

```javascript
/**
 * Build Card-based UI for sidebar
 */
function buildCardUI(context) {
  const { threadId, subject, note } = context;

  // Card header
  const header = CardService.newCardHeader()
    .setTitle('Thread Notes')
    .setSubtitle(truncate(subject, 40));

  // Note input section
  const noteSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextInput()
        .setFieldName('noteContent')
        .setTitle('Your Note')
        .setValue(note ? note.content : '')
        .setMultiline(true)
        .setHint('Type your private note here...')
    );

  // Action buttons
  const buttonSection = CardService.newCardSection()
    .addWidget(
      CardService.newButtonSet()
        .addButton(
          CardService.newTextButton()
            .setText('Save')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('handleSave')
                .setParameters({ threadId: threadId })
            )
            .setTextButtonStyle(CardService.TextButtonStyle.FILLED)
        )
        .addButton(
          CardService.newTextButton()
            .setText('Delete')
            .setOnClickAction(
              CardService.newAction()
                .setFunctionName('handleDelete')
                .setParameters({ threadId: threadId })
            )
        )
    );

  // Footer with metadata
  const footer = CardService.newFixedFooter()
    .setPrimaryButton(
      CardService.newTextButton()
        .setText('All Notes')
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName('showAllNotes')
        )
    );

  // Build card
  const card = CardService.newCardBuilder()
    .setHeader(header)
    .addSection(noteSection)
    .addSection(buttonSection)
    .setFixedFooter(footer);

  // Add last modified info if note exists
  if (note && note.lastModified) {
    const metaSection = CardService.newCardSection()
      .addWidget(
        CardService.newTextParagraph()
          .setText('<font color="#666"><i>Last updated: ' +
                   formatTimestamp(note.lastModified) + '</i></font>')
      );
    card.addSection(metaSection);
  }

  return card.build();
}

/**
 * Handle save button click
 */
function handleSave(e) {
  const threadId = e.parameters.threadId;
  const content = e.formInput.noteContent;

  // Get subject from Gmail
  const subject = GmailContext.getThreadSubject(threadId);

  // Save note
  const result = Storage.saveNote(threadId, content, { subject });

  if (result.success) {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification()
          .setText('✓ Note saved')
          .setType(CardService.NotificationType.INFO)
      )
      .setStateChanged(true)
      .build();
  } else {
    return CardService.newActionResponseBuilder()
      .setNotification(
        CardService.newNotification()
          .setText('✗ Save failed: ' + result.error)
          .setType(CardService.NotificationType.ERROR)
      )
      .build();
  }
}

/**
 * Handle delete button click
 */
function handleDelete(e) {
  const threadId = e.parameters.threadId;

  Storage.deleteNote(threadId);

  return CardService.newActionResponseBuilder()
    .setNotification(
      CardService.newNotification()
        .setText('Note deleted')
    )
    .setNavigation(
      CardService.newNavigation()
        .updateCard(buildCardUI({ threadId, subject: '', note: null }))
    )
    .build();
}

/**
 * Show "All Notes" view
 */
function showAllNotes() {
  const notes = Storage.getAllNotes();

  const header = CardService.newCardHeader()
    .setTitle('All Notes')
    .setSubtitle(notes.length + ' saved notes');

  const listSection = CardService.newCardSection();

  if (notes.length === 0) {
    listSection.addWidget(
      CardService.newTextParagraph()
        .setText('No notes yet. Open an email thread and add a note!')
    );
  } else {
    notes.slice(0, 20).forEach(note => {
      listSection.addWidget(
        CardService.newDecoratedText()
          .setTopLabel(note.subject || 'No subject')
          .setText(truncate(note.content, 60))
          .setBottomLabel(formatTimestamp(note.lastModified))
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName('openThread')
              .setParameters({ threadId: note.threadId })
          )
      );
    });
  }

  const card = CardService.newCardBuilder()
    .setHeader(header)
    .addSection(listSection)
    .build();

  return CardService.newActionResponseBuilder()
    .setNavigation(
      CardService.newNavigation()
        .pushCard(card)
    )
    .build();
}

/**
 * Open Gmail thread (external link)
 */
function openThread(e) {
  const threadId = e.parameters.threadId;
  const url = 'https://mail.google.com/mail/u/0/#inbox/' + threadId;

  return CardService.newActionResponseBuilder()
    .setOpenLink(
      CardService.newOpenLink()
        .setUrl(url)
        .setOpenAs(CardService.OpenAs.FULL_SIZE)
        .setOnClose(CardService.OnClose.NOTHING)
    )
    .build();
}
```

---

### **Phase 5: Advanced Features (Day 6-7)**

#### **3.8. RTL Text Support**

**Challenge**: Card framework doesn't have RTL control.

**Solution**: Use HTML Service for text input.

```javascript
/**
 * Build HTML-based sidebar with RTL support
 */
function buildHtmlUI(context) {
  const template = HtmlService.createTemplateFromFile('ui/Sidebar');

  template.threadId = context.threadId;
  template.subject = context.subject;
  template.noteContent = context.note ? context.note.content : '';
  template.lastModified = context.note ? context.note.lastModified : null;

  const html = template.evaluate()
    .setTitle('Thread Notes')
    .setWidth(300);

  return html;
}
```

**File**: `ui/Sidebar.html`
```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <?!= include('ui/Styles'); ?>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Thread Notes</h2>
      <div class="subject" title="<?= subject ?>">
        <?= subject.substring(0, 40) ?>
      </div>
    </div>

    <div class="editor-wrapper">
      <textarea
        id="noteContent"
        class="note-editor"
        dir="auto"
        placeholder="Type your private note here..."
      ><?= noteContent ?></textarea>
    </div>

    <div class="actions">
      <button id="saveBtn" class="btn btn-primary">Save</button>
      <button id="deleteBtn" class="btn btn-secondary">Delete</button>
    </div>

    <?php if (lastModified) { ?>
    <div class="meta">
      Last updated: <span id="lastModified"><?= formatTimestamp(lastModified) ?></span>
    </div>
    <?php } ?>
  </div>

  <?!= include('ui/Client.js'); ?>
</body>
</html>
```

**File**: `ui/Styles.html`
```html
<style>
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: 'Google Sans', Roboto, Arial, sans-serif;
    font-size: 14px;
    color: #202124;
    background: #fff;
  }

  .container {
    padding: 16px;
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .header {
    margin-bottom: 16px;
  }

  .header h2 {
    font-size: 18px;
    font-weight: 500;
    margin-bottom: 4px;
  }

  .subject {
    font-size: 12px;
    color: #5f6368;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .editor-wrapper {
    flex: 1;
    margin-bottom: 16px;
  }

  .note-editor {
    width: 100%;
    height: 100%;
    padding: 12px;
    border: 1px solid #dadce0;
    border-radius: 8px;
    font-family: inherit;
    font-size: 14px;
    line-height: 1.5;
    resize: none;
    outline: none;
  }

  .note-editor:focus {
    border-color: #1a73e8;
    box-shadow: 0 0 0 1px #1a73e8;
  }

  /* RTL support - browser handles this automatically with dir="auto" */
  .note-editor[dir="rtl"] {
    text-align: right;
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
  }

  .btn {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-primary {
    background: #1a73e8;
    color: white;
  }

  .btn-primary:hover {
    background: #1765cc;
  }

  .btn-secondary {
    background: #f1f3f4;
    color: #202124;
  }

  .btn-secondary:hover {
    background: #e8eaed;
  }

  .meta {
    font-size: 12px;
    color: #5f6368;
    font-style: italic;
  }
</style>
```

**File**: `ui/Client.js.html`
```html
<script>
  const threadId = '<?= threadId ?>';

  // Auto-save on input (debounced)
  let saveTimeout;
  const editor = document.getElementById('noteContent');

  editor.addEventListener('input', () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      saveNote();
    }, 1000); // 1 second auto-save
  });

  // Save button
  document.getElementById('saveBtn').addEventListener('click', () => {
    saveNote();
  });

  // Delete button
  document.getElementById('deleteBtn').addEventListener('click', () => {
    if (confirm('Delete this note?')) {
      google.script.run
        .withSuccessHandler(() => {
          editor.value = '';
          showNotification('Note deleted');
        })
        .withFailureHandler((error) => {
          showNotification('Delete failed: ' + error.message);
        })
        .deleteNote(threadId);
    }
  });

  function saveNote() {
    const content = editor.value;

    google.script.run
      .withSuccessHandler(() => {
        showNotification('Saved');
        updateLastModified();
      })
      .withFailureHandler((error) => {
        showNotification('Save failed: ' + error.message);
      })
      .saveNoteFromClient(threadId, content);
  }

  function showNotification(message) {
    // Simple notification (you could make this fancier)
    const notification = document.createElement('div');
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 16px;
      right: 16px;
      background: #323232;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 1000;
    `;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.remove();
    }, 2000);
  }

  function updateLastModified() {
    const meta = document.querySelector('.meta');
    if (meta) {
      const now = new Date().toLocaleString();
      meta.innerHTML = 'Last updated: <span>' + now + '</span>';
    }
  }
</script>
```

**Server-side handler**:
```javascript
/**
 * Save note from client-side (HTML UI)
 */
function saveNoteFromClient(threadId, content) {
  const subject = GmailContext.getThreadSubject(threadId);
  return Storage.saveNote(threadId, content, { subject });
}

/**
 * Delete note from client-side
 */
function deleteNote(threadId) {
  return Storage.deleteNote(threadId);
}
```

---

## 4. Feature Mapping

### **Chrome Extension → Workspace Add-on**

| Feature | Chrome Extension | Workspace Add-on | Implementation |
|---------|-----------------|------------------|----------------|
| **Thread detection** | URL parsing | Gmail API context | `onGmailMessageOpen(e)` |
| **Split pane support** | ❌ Broken | ✅ Works | Event-driven triggers |
| **Auto-save** | 1-3 second timeout | Same (client-side) | `setTimeout()` in Client.js |
| **All Notes view** | Sidebar tab | Card navigation | `showAllNotes()` function |
| **Search notes** | Client-side filter | Server-side filter | `getAllNotes()` with query |
| **Export/Import** | JSON download | Spreadsheet export | Built-in to storage |
| **Delete note** | Right-click menu | Delete button | `deleteNote()` |
| **RTL support** | Milkdown detection | Native `dir="auto"` | HTML textarea attribute |
| **Keyboard shortcuts** | Ctrl+S | Not supported | N/A (Cards don't support) |
| **Offline mode** | ✅ Works | ❌ No | Apps Script requires internet |

### **Features NOT Ported** (by design)

- ❌ Milkdown rich text editor (too heavy, Cards are simpler)
- ❌ Custom keyboard shortcuts (not supported in Cards)
- ❌ Settings panel (use Add-on configuration instead)
- ❌ Platform switching (Gmail-only by design)
- ❌ Manual sync (auto-synced by Google)

---

## 5. Data Storage Strategy

### **Storage Architecture**

```
┌─────────────────────────────────────────────┐
│         PropertiesService (Fast)             │
│  ┌─────────────────────────────────────┐   │
│  │ note_<threadId1>: {json}            │   │
│  │ note_<threadId2>: {json}            │   │
│  │ ...up to 100 most recent notes      │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
                    │
                    │ Backup
                    ↓
┌─────────────────────────────────────────────┐
│      Google Spreadsheet (Unlimited)         │
│  ┌─────────────────────────────────────┐   │
│  │ Thread ID │ Subject │ Content │ ... │   │
│  │ abc123    │ Re:...  │ Note... │ ... │   │
│  │ xyz789    │ FW:...  │ Note... │ ... │   │
│  │ ...all notes ever created           │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### **Storage Limits**

| Storage Type | Limit | Notes |
|--------------|-------|-------|
| PropertiesService | 500 KB total | ~100 notes @ 5KB each |
| Spreadsheet | ~5M cells | Effectively unlimited |
| Single note | ~5 KB recommended | Larger notes go to spreadsheet only |

### **Data Structure**

```javascript
{
  "threadId": "18e2f8a4b3c1d2e5",
  "subject": "Re: Project Update",
  "content": "Note content here...",
  "lastModified": "2025-12-27T10:30:00.000Z",
  "created": "2025-12-20T14:22:00.000Z",
  "version": "1.0",
  "metadata": {
    "labels": ["INBOX", "IMPORTANT"],
    "participants": ["user@example.com"],
    "messageCount": 5
  }
}
```

---

## 6. UI/UX Design

### **Sidebar Layout (Card-based)**

```
┌───────────────────────────────────┐
│  Gmail Notes               [×]    │ ← Header
├───────────────────────────────────┤
│  Re: Project Update...            │ ← Subject (truncated)
├───────────────────────────────────┤
│  ┌─────────────────────────────┐ │
│  │ Your Note                   │ │ ← Text input
│  │                             │ │
│  │ [Type here...]              │ │
│  │                             │ │
│  │                             │ │
│  │                             │ │
│  └─────────────────────────────┘ │
├───────────────────────────────────┤
│  [Save]           [Delete]        │ ← Actions
├───────────────────────────────────┤
│  Last updated: 2 mins ago         │ ← Metadata
├───────────────────────────────────┤
│  [All Notes]                      │ ← Footer
└───────────────────────────────────┘
```

### **All Notes View**

```
┌───────────────────────────────────┐
│  All Notes                 [←]    │
│  12 saved notes                   │
├───────────────────────────────────┤
│  ┌─────────────────────────────┐ │
│  │ 📧 Re: Project Update       │ │
│  │ Note about the meeting...   │ │
│  │ 2 hours ago                 │ │
│  └─────────────────────────────┘ │
│  ┌─────────────────────────────┐ │
│  │ 📧 FW: Budget Approval      │ │
│  │ Remember to follow up...    │ │
│  │ Yesterday                   │ │
│  └─────────────────────────────┘ │
│  ...                              │
└───────────────────────────────────┘
```

### **Design Principles**

1. **Simplicity over features** - Card UI is minimal, focus on core functionality
2. **Fast interaction** - Auto-save in 1 second, instant feedback
3. **Mobile-friendly** - Cards work on Gmail mobile app
4. **Consistent with Gmail** - Use Google's design language (Google Sans font, Material colors)
5. **Accessibility** - Proper labels, keyboard navigation where possible

---

## 7. Development Timeline

### **Week 1: Core Functionality**

**Day 1 (4 hours)**:
- [ ] Set up Apps Script project
- [ ] Configure `appsscript.json`
- [ ] Create basic project structure
- [ ] Implement `Code.js` entry point
- [ ] Test basic Card rendering

**Day 2 (6 hours)**:
- [ ] Implement `Storage.js` (PropertiesService)
- [ ] Create spreadsheet backup system
- [ ] Write CRUD operations
- [ ] Test storage with sample data
- [ ] Add error handling

**Day 3 (6 hours)**:
- [ ] Implement `GmailContext.js`
- [ ] Enable Gmail API advanced service
- [ ] Test thread detection in split pane
- [ ] Add subject extraction
- [ ] Handle edge cases (drafts, deleted threads)

**Day 4 (6 hours)**:
- [ ] Build Card UI (`buildCardUI`)
- [ ] Implement save/delete handlers
- [ ] Add notifications
- [ ] Test in Gmail test environment
- [ ] Debug any Card rendering issues

### **Week 2: Advanced Features & Polish**

**Day 5 (6 hours)**:
- [ ] Implement "All Notes" view
- [ ] Add sorting/filtering
- [ ] Thread navigation from All Notes
- [ ] Test with 50+ notes

**Day 6 (6 hours)**:
- [ ] Build HTML UI option (for RTL)
- [ ] Implement auto-save in client
- [ ] Add RTL text detection
- [ ] Style UI to match Gmail

**Day 7 (4 hours)**:
- [ ] Testing across scenarios
- [ ] Fix bugs
- [ ] Performance optimization
- [ ] Write documentation

**Day 8 (4 hours)**:
- [ ] Prepare for deployment
- [ ] Create demo video
- [ ] Set up OAuth consent screen
- [ ] Submit for review (if going public)

### **Total Estimated Time: 42-48 hours**

---

## 8. Deployment Strategy

### **8.1. Development Deployment (Immediate)**

```bash
# Push to Apps Script
clasp push

# Test in Gmail
# Visit: https://mail.google.com/mail/
# Click add-on icon in right sidebar
```

**No approval needed** - Works immediately for developer account.

### **8.2. Private/Internal Deployment**

For testing with select users:

1. **Deploy as test deployment**:
   ```bash
   clasp deploy --description "Internal testing v1.0"
   ```

2. **Share with testers**:
   - Go to Apps Script project → Deploy → Test deployments
   - Add tester email addresses
   - They get immediate access

**No approval needed** - Up to 100 testers.

### **8.3. Public Deployment (Optional)**

If you want to publish on Workspace Marketplace:

**Step 1: OAuth Consent Screen**
- Go to Google Cloud Console
- Configure OAuth consent screen
- Add scopes: `gmail.addons.current.message.readonly`, `script.storage`
- Submit for verification

**Step 2: Create Cloud Project**
- Enable Gmail API
- Set up OAuth 2.0 credentials
- Configure redirect URIs

**Step 3: Marketplace Listing**
- Create developer account ($5 fee)
- Fill out listing form:
  - Screenshots (4-5 required)
  - Description (100-500 words)
  - Support email/URL
  - Privacy policy URL
  - Terms of service URL
- Submit for review

**Timeline**: 2-4 weeks for approval.

### **8.4. Recommended Approach**

1. **Start with development deployment** (you only)
2. **Test thoroughly** for 1-2 weeks
3. **Add 5-10 beta testers** (private deployment)
4. **Collect feedback** and iterate
5. **Decide on public launch** later

---

## 9. Testing Plan

### **9.1. Unit Tests**

Use `GasT` framework for Apps Script testing:

```javascript
/**
 * tests/Storage.test.js
 */

function testSaveAndGetNote() {
  const testThreadId = 'test_thread_123';
  const testContent = 'Test note content';

  // Save
  const saveResult = Storage.saveNote(testThreadId, testContent, {
    subject: 'Test Subject'
  });

  GasT.assert.isTrue(saveResult.success, 'Save should succeed');

  // Get
  const note = Storage.getNote(testThreadId);

  GasT.assert.isNotNull(note, 'Note should exist');
  GasT.assert.equals(note.content, testContent, 'Content should match');
  GasT.assert.equals(note.threadId, testThreadId, 'Thread ID should match');

  // Cleanup
  Storage.deleteNote(testThreadId);
}

function testDeleteNote() {
  const testThreadId = 'test_thread_456';

  // Create note
  Storage.saveNote(testThreadId, 'Delete me', { subject: 'Test' });

  // Delete
  const deleteResult = Storage.deleteNote(testThreadId);
  GasT.assert.isTrue(deleteResult.success, 'Delete should succeed');

  // Verify deleted
  const note = Storage.getNote(testThreadId);
  GasT.assert.isNull(note, 'Note should be deleted');
}

function testGetAllNotes() {
  // Create multiple test notes
  Storage.saveNote('thread_1', 'Note 1', { subject: 'Test 1' });
  Storage.saveNote('thread_2', 'Note 2', { subject: 'Test 2' });

  const allNotes = Storage.getAllNotes();

  GasT.assert.isTrue(allNotes.length >= 2, 'Should have at least 2 notes');

  // Cleanup
  Storage.deleteNote('thread_1');
  Storage.deleteNote('thread_2');
}
```

Run tests:
```bash
clasp run testSaveAndGetNote
clasp run testDeleteNote
clasp run testGetAllNotes
```

### **9.2. Integration Tests**

**Gmail Context Tests**:

1. **Regular thread view**:
   - Open email → Add-on appears → Add note → Save → Verify stored

2. **Split pane view**:
   - Enable split pane in Gmail settings
   - Click on thread in list (URL doesn't change)
   - Add-on should still show correct thread
   - Add note → Verify correct threadId

3. **Conversation view off**:
   - Disable conversation view
   - Open individual message
   - Add-on should use threadId correctly

4. **Search results**:
   - Search for emails
   - Open from search results
   - Add note → Verify threadId

5. **Labels/folders**:
   - Access thread from different labels
   - Add-on should show same note

### **9.3. UI Tests**

**Card UI**:
- [ ] Text input renders correctly
- [ ] Save button works
- [ ] Delete button shows confirmation
- [ ] Notifications appear
- [ ] All Notes navigation works
- [ ] Back button from All Notes works

**HTML UI** (if implemented):
- [ ] Textarea renders with dir="auto"
- [ ] Auto-save after 1 second
- [ ] RTL text displays correctly
- [ ] Buttons are clickable
- [ ] Client-server communication works

### **9.4. Edge Cases**

- [ ] Very long notes (>5KB)
- [ ] Notes with special characters (emoji, RTL, quotes)
- [ ] Deleted threads (what happens to note?)
- [ ] Archived threads
- [ ] Threads in Trash
- [ ] Multiple Gmail accounts in same browser
- [ ] Slow network (test timeouts)
- [ ] Storage quota exceeded

### **9.5. Performance Tests**

- [ ] Load time with 100 notes
- [ ] Load time with 1000 notes
- [ ] Save time for large note (5KB)
- [ ] All Notes view render time
- [ ] Spreadsheet backup performance

### **9.6. Mobile Tests**

- [ ] Gmail app on iOS
- [ ] Gmail app on Android
- [ ] Card UI renders correctly
- [ ] Buttons are tappable
- [ ] Text input works with mobile keyboard
- [ ] RTL works on mobile

---

## 10. Known Challenges & Solutions

### **Challenge 1: CSP Restrictions in HTML Service**

**Problem**: Content Security Policy blocks inline scripts and external resources.

**Solution**:
```html
<!-- BAD: Inline script blocked -->
<script>
  function doSomething() { ... }
</script>

<!-- GOOD: Use scriptlets -->
<?!= include('ui/Client.js'); ?>

<!-- BAD: External CDN blocked -->
<script src="https://cdn.example.com/lib.js"></script>

<!-- GOOD: Include library locally -->
<?!= include('lib/library.js'); ?>
```

### **Challenge 2: State Management Between Server/Client**

**Problem**: Card UI is server-rendered, HTML UI is client-side. How to maintain state?

**Solution**: Use `google.script.run` for server communication:

```javascript
// Client-side (HTML UI)
google.script.run
  .withSuccessHandler(function(result) {
    console.log('Server returned:', result);
  })
  .withFailureHandler(function(error) {
    console.error('Server error:', error);
  })
  .serverSideFunction(param1, param2);

// Server-side (Code.js)
function serverSideFunction(param1, param2) {
  // Process and return
  return { success: true, data: ... };
}
```

### **Challenge 3: Testing Contextual Triggers**

**Problem**: Hard to test `onGmailMessageOpen` locally.

**Solution**: Use Gmail test environment:
1. Deploy as test deployment
2. Install in Gmail (add-on test mode)
3. Open emails and check logs via `clasp logs`

### **Challenge 4: Quota Limits**

**Problem**: Apps Script has execution time limits (6 min for custom functions).

**Solution**:
- Keep operations fast (<1 second)
- Use batch operations for All Notes view
- Implement pagination if needed

### **Challenge 5: Mobile Keyboard for RTL**

**Problem**: Mobile keyboards might not trigger dir="auto" correctly.

**Solution**: Detect first character and set direction explicitly:

```javascript
editor.addEventListener('input', function() {
  const firstChar = this.value.trim().charAt(0);
  const rtlPattern = /[\u0590-\u05FF\u0600-\u06FF]/;

  if (rtlPattern.test(firstChar)) {
    this.setAttribute('dir', 'rtl');
  } else if (firstChar) {
    this.setAttribute('dir', 'ltr');
  }
});
```

### **Challenge 6: Thread ID Persistence**

**Problem**: Gmail thread IDs can change if thread is moved/modified.

**Solution**: Store multiple identifiers:
```javascript
{
  threadId: "primary_id",
  messageId: "first_message_id",
  subject: "email_subject",
  participants: ["user@example.com"]
}
```

If threadId lookup fails, search by subject + participants.

### **Challenge 7: Large Notes Performance**

**Problem**: 5KB note takes time to load from PropertiesService.

**Solution**: Implement lazy loading:
```javascript
// Store note metadata separately
{
  "note_meta_threadId": {
    threadId: "...",
    subject: "...",
    hasContent: true,
    contentSize: 5000,
    lastModified: "..."
  },
  "note_content_threadId": "actual large content..."
}
```

Load metadata for All Notes view, load content only when opening specific note.

---

## 11. Migration Checklist

### **Pre-Development**

- [ ] Create GitHub repo: `gmail-notes-addon`
- [ ] Set up local development environment
- [ ] Install clasp: `npm install -g @google/clasp`
- [ ] Create Apps Script project: `clasp create`
- [ ] Enable Gmail API in Cloud Console
- [ ] Configure OAuth consent screen

### **Development Phase**

- [ ] Implement `Code.js` entry point
- [ ] Implement `Storage.js` with PropertiesService
- [ ] Implement `GmailContext.js` for Gmail API
- [ ] Build Card-based UI
- [ ] Add save/delete functionality
- [ ] Implement All Notes view
- [ ] Add auto-save (1 second)
- [ ] Build HTML UI for RTL support
- [ ] Write unit tests
- [ ] Write documentation

### **Testing Phase**

- [ ] Test in regular Gmail view
- [ ] Test in split pane mode
- [ ] Test with conversation view off
- [ ] Test RTL languages (Hebrew, Arabic)
- [ ] Test on mobile (iOS/Android)
- [ ] Load test with 100+ notes
- [ ] Test edge cases (deleted threads, etc.)

### **Deployment Phase**

- [ ] Deploy as test deployment
- [ ] Test with own account
- [ ] Add 5-10 beta testers
- [ ] Collect feedback
- [ ] Iterate on issues
- [ ] (Optional) Submit for Marketplace review

### **Documentation Phase**

- [ ] Write README.md
- [ ] Write ARCHITECTURE.md
- [ ] Write SETUP.md (for developers)
- [ ] Write USER_GUIDE.md
- [ ] Record demo video
- [ ] Create screenshots

### **Post-Launch**

- [ ] Monitor logs for errors
- [ ] Track usage metrics
- [ ] Respond to user feedback
- [ ] Plan v2.0 features
- [ ] Archive Chrome extension repo (mark as deprecated)

---

## 12. Success Metrics

### **Technical Metrics**

- [ ] Load time < 2 seconds
- [ ] Save time < 500ms
- [ ] All Notes view renders in < 3 seconds (100 notes)
- [ ] 99% uptime (depends on Google infrastructure)
- [ ] Zero data loss

### **UX Metrics**

- [ ] Works in split pane mode (primary requirement)
- [ ] Auto-close when leaving Gmail (solved by design)
- [ ] Auto-save within 1-2 seconds
- [ ] RTL text displays correctly
- [ ] Mobile-friendly UI

### **Adoption Metrics** (if public)

- [ ] 100 installs in first month
- [ ] 500 installs in 6 months
- [ ] 4+ star rating on Marketplace
- [ ] <5% uninstall rate

---

## 13. Future Enhancements (Post-MVP)

**v2.0 Features**:
- [ ] Tags/labels for notes
- [ ] Rich text formatting (bold, italic, lists)
- [ ] Note templates
- [ ] Reminders/follow-up dates
- [ ] Search within notes
- [ ] Export to Google Docs

**v3.0 Features**:
- [ ] AI-powered note suggestions (using Google AI)
- [ ] Automatic thread summaries
- [ ] Note sharing with team members
- [ ] Integration with Google Tasks

---

## 14. Questions to Resolve Before Starting

1. **Storage preference**: PropertiesService + Spreadsheet backup OK? Or prefer Drive files?

2. **UI preference**: Start with Card Service or jump straight to HTML Service?

3. **OAuth scopes**: Comfortable requesting `gmail.readonly` or minimize to just `gmail.addons.current.message.readonly`?

4. **Public vs Private**: Planning to publish on Marketplace eventually, or keep private?

5. **Branding**: Need custom icon/logo for add-on? (I can use simple placeholder for now)

---

## 15. Final Recommendation

**Proceed with fresh repository and Google Workspace Add-on approach.**

**Why:**
- ✅ Solves split pane detection (your main pain point)
- ✅ Solves auto-close problem (Gmail-only by design)
- ✅ Better long-term architecture
- ✅ Works on mobile
- ✅ Simpler codebase (no DOM scraping)

**When to start:**
- Confirm you're comfortable with ~40 hours of development
- Confirm OAuth approval process is acceptable
- Confirm Gmail-only is sufficient (no Outlook needed)

**Next immediate steps:**
1. I create fresh repo structure
2. You review this plan and approve/adjust
3. I start building in phases
4. You test each phase
5. Iterate until production-ready

---

**Ready to proceed?** Let me know if you want me to:
- Create the fresh repo now
- Adjust any part of this plan
- Answer specific technical questions
- Start building immediately

This is a complete greenfield project with clear requirements and architecture. Should take 1-2 weeks of focused development.
