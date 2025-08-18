# Email Thread Notes - Development Todos

## Storage System Improvements (COMPLETED)

### Core Storage Changes
- [x] **Unify file formats** - Single backup format instead of separate export/sync types
- [x] **Make all files importable** - Both manual exports and auto-sync files should import  
- [x] **Implement debounced disk writes** - Save to disk 10 seconds after user stops typing
- [x] **Add auto-backup on operations** - Write to disk on delete operations (saves use debounced)

### File System Improvements
- [x] **Keep Downloads/EmailNotes/EmailNotes/ structure** - Required for symlink limitations
- [ ] **Custom folder setting** - Let users choose folder within Downloads (Future enhancement)

### User Experience  
- [x] **Symlink setup instructions** - Document iCloud Drive and Google Drive setup
- [x] **Test data recovery** - Ensure recovery from disk if Chrome storage fails
- [x] **Update backup UI** - Show that notes are automatically stored to Downloads/EmailNotes/EmailNotes/ location

## UI/UX Improvements (COMPLETED)

### Extension Popup Cleanup
- [x] **Remove notes list from popup** - Cleaner interface without note previews
- [x] **Eliminate duplicate Export/Sync buttons** - Removed Export Notes, kept Sync Now
- [x] **Fix extension status display** - Shows "Disabled" when toggle is off
- [x] **Remove unhelpful account display** - No more "gmail_account_0" labels
- [x] **Update button text** - "Configure Sync Folder" → "Tips for syncing between devices"

### Performance & User Experience
- [x] **Reduce download notifications** - Changed debounce to 10 seconds, removed duplicate backups
- [x] **Fix duplicate download issues** - Only one backup per user action
- [x] **Improve notes counter accuracy** - Shows filtered notes with total count debug info

## Last tasks for current sprint (COMPLETED)
- [x] **Add Sync Now button** Button in the All Notes screen triggers a backup of notes immediately 
- [x] **Panel positioning and size** support dragging and expanding the size of the text box in the notes window 


## Next Priority - Testing & Validation

### Outlook Integration Testing
- [ ] **Test Outlook thread detection** - Verify thread ID extraction works on outlook.office365.com
- [ ] **Test Outlook notes functionality** - Add, edit, delete notes in Outlook interface
- [ ] **Test Outlook UI components** - Verify notes panel, buttons, and styling work correctly
- [ ] **Test cross-platform storage** - Ensure Gmail and Outlook notes are properly isolated
- [ ] **Test account detection** - Verify Outlook account identification works

##  Future feature ideas (Not now)

### High Priority
- [ ] **Add support for sending the thread to an LLM of choice for summary** Allow users to configure an API keybelonging to Claude or OpenAI, plus a default instrcutions prompt, plus the thread itself. The summary is stored in the Note of the thread. "AI Summary" never sends the summary without user trigger and doesn't include the visuals - text only. 

- [ ] **Add visual indicators in Gmail thread list** showing which conversations have notes
- [ ] **Implement basic search functionality** across all notes content
- [ ] **Gmail reading pane support** - detect threads in single message view
- [ ] **Keyboard shortcuts** for common actions (toggle panel, save, etc.)

### Medium Priority  
- [ ] **Note preview on hover** in the notes list
- [ ] **Rich text formatting** - basic bold, italic, lists
- [ ] **Undo/redo functionality** for note editing
- [ ] **Auto-backup reminders** when many notes exist without recent backup

### Low Priority
- [ ] **Dark mode support** matching Gmail's theme
- [ ] **Note templates** for common use cases
- [ ] **Tag system** for categorizing notes
- [ ] **Note history/versioning** to track changes over time

## 🚀 Next sprint Features 

### Outlook Integration (v2.0)
- [ ] **Outlook thread detection** for outlook.office365.com (and later outlook.live.com)
- [ ] **Outlook-specific UI adaptations** matching Outlook's design language
- [ ] **Platform-specific storage preferences** (e.g., Gmail synced, Outlook local-only)

### Advanced Cloud Sync (v2.1)
- [ ] **Real-time sync** instead of periodic file creation
- [ ] **Multiple cloud provider support** (Google Drive API, Dropbox API)
- [ ] **Conflict resolution UI** when same note edited on multiple devices
- [ ] **Sync status indicators** showing last sync time and any errors
- [ ] **Data encryption** for cloud-stored notes
- [ ] **Selective sync** - choose which notes to sync vs keep local

### User Experience Improvements
- [ ] **Onboarding tutorial** for first-time users
- [ ] **Better error messages** with actionable solutions
- [ ] **Accessibility improvements** (WCAG 2.1 AA compliance)
- [ ] **Mobile responsiveness** for tablets/smaller screens
- [ ] **Performance optimization** for users with many notes (>100)

## 🐛 Known Issues to Fix

### Critical
- [ ] **Thread subject detection fails** in some Gmail interface variations
- [ ] **Account detection unreliable** when switching between multiple Gmail accounts quickly

### Minor
- [ ] **Panel positioning issues** on very wide screens (>1920px)
- [ ] **Import validation** could be more user-friendly for malformed files

## 🔧 Technical Debt

### Code Quality
- [ ] **Add unit tests** for storage operations and thread detection
- [ ] **Implement proper logging** system with different levels (debug, info, error)
- [ ] **Code splitting** to reduce initial bundle size
- [ ] **TypeScript migration** for better type safety
- [ ] **ESLint configuration** with consistent code style rules

### Architecture Improvements
- [ ] **Modular content script architecture** to support multiple email platforms
- [ ] **Event-driven communication** between content script and background
- [ ] **State management system** for complex UI interactions
- [ ] **Plugin architecture** for easy feature additions
- [ ] **Better error boundary handling** for isolated failures

### Performance
- [ ] **Lazy loading** for notes list when many notes exist
- [ ] **Virtual scrolling** for very long notes lists
- [ ] **Debounced DOM queries** to reduce Gmail layout thrashing
- [ ] **Memory leak prevention** in long-running Gmail sessions

## 📋 Testing & Quality Assurance

### Manual Testing Needed
- [ ] **Multi-account Gmail testing** with different account types (personal, workspace)
- [ ] **Cross-browser testing** (Chrome, Edge, potentially Firefox)
- [ ] **Performance testing** with large datasets (100+ notes)
- [ ] **Cloud sync reliability testing** across different network conditions
- [ ] **Gmail interface variation testing** (different labs, themes, languages)

### Automated Testing
- [ ] **Unit test suite** for core functionality
- [ ] **Integration tests** for storage operations
- [ ] **E2E tests** for critical user flows
- [ ] **Performance regression tests** 
- [ ] **Security audit** for data handling and permissions

## 🚦 Release Planning

### v1.2.1 - Current Sprint Completion
**Target: This week**
- Sync Now button in All Notes screen
- Panel dragging and resizing functionality

### v2.0.0 - Outlook Integration (Next Sprint)
**Target: 2-3 weeks**
- Outlook.office365.com thread detection
- Outlook-specific UI adaptations
- Per-account export system (separate files per email address)
- Platform-specific storage preferences

### v2.1.0 - Enhanced Features  
**Target: 1 month**
- Visual indicators in Gmail thread list
- Basic search functionality across notes
- Gmail reading pane support
- Keyboard shortcuts

### v3.0.0 - Advanced Features
**Target: 2-3 months**
- AI-powered thread summaries (Claude/OpenAI integration)
- Rich text formatting
- Real-time cloud sync
- Mobile responsiveness

## 📝 Documentation Todos

- [ ] **User guide** with screenshots for setup and usage
- [ ] **Troubleshooting guide** for common sync issues
- [ ] **Privacy policy** explaining data handling
- [ ] **Developer documentation** for contributing
- [ ] **API documentation** for storage and sync systems
- [ ] **Change log** with version history and migration notes

## 🔄 Maintenance Tasks

### Regular (Monthly)
- [ ] **Dependency updates** and security patches
- [ ] **Gmail DOM selector verification** (they change frequently)
- [ ] **Storage cleanup utilities** for orphaned data
- [ ] **Performance monitoring** and optimization
- [ ] **User feedback review** and prioritization

### As Needed
- [ ] **Chrome extension store optimization** (description, screenshots)
- [ ] **Support forum management** for user questions
- [ ] **Feature request evaluation** and roadmap updates
- [ ] **Bug triage** and severity classification
- [ ] **Release notes preparation** for version updates

---

## 📊 Progress Tracking

**Current Version**: v2.1.0
**Next Milestone**: v2.2.0 (Advanced Features)
**Overall Completion**: ~65% of planned features

**Recent Completions (v2.1.0)**:
✅ Unified file format system (single backup type)
✅ Debounced disk writes (10 seconds after typing)
✅ Improved extension popup interface
✅ Eliminated duplicate Export/Sync functionality  
✅ Fixed download notification frequency
✅ Cloud sync setup documentation

**Previous Completions (v2.0.0)**:
⚠️ Outlook integration implemented (needs testing)
✅ Cross-platform storage with account isolation
✅ Unified UI components for Gmail and Outlook
⚠️ Thread detection for both platforms (Outlook untested)

**Previous Completions (v1.2.0)**:
✅ Export/Import system
✅ Auto-sync with cloud integration  
✅ Enhanced UI with status indicators
✅ Delete functionality
✅ Improved account handling
✅ Timeout error handling

**Next Up (v2.0.0)**:
🎯 Outlook.office365.com thread detection
🎯 Outlook-specific UI adaptations
🎯 Per-account export system
🎯 Platform-specific storage preferences