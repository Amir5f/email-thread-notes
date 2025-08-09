# Email Thread Notes - Chrome Extension PRD

## Product Overview

### Vision Statement
Create a privacy-focused Chrome extension that allows users to attach private, persistent notes to email threads in both Gmail and Outlook web clients, enabling better email management and context retention without affecting the original email content or visibility to other recipients.

### Problem Statement
Users frequently need to keep track of internal notes, context, and follow-up items related to specific email conversations. Current solutions either:
- Require forwarding emails to self with notes (clutters inbox)
- Use external note-taking apps (lacks email context integration)
- Rely on email labels/categories (limited and visible to others)
- Use corporate add-ins (restricted by admin policies)

### Solution Summary
A lightweight Chrome extension that:
- Detects email threads in Gmail and Outlook web interfaces
- Provides a discrete notes panel for each conversation
- Stores all data locally using Chrome's storage API
- Maintains notes persistence across browser sessions and updates
- Works independently of corporate email policies

## Core Features

### 1. Multi-Platform Thread Detection
- **Gmail Support**: Detect conversation threads in Gmail web interface
- **Outlook Support**: Detect conversation threads in Outlook web (outlook.office365.com, outlook.live.com)
- **Thread Identification**: Generate unique identifiers for email conversations across platforms

### 2. Notes Management
- **Add Notes**: Simple text input for adding notes to any email thread
- **Edit Notes**: Modify existing notes with auto-save functionality  
- **Delete Notes**: Remove notes with confirmation
- **Timestamp Tracking**: Auto-timestamp note creation and modifications
- **Rich Text Support**: Basic formatting (bold, italic, lists) in later versions

### 3. User Interface
- **Discrete Integration**: Non-intrusive panel that integrates with existing email UI
- **Expandable/Collapsible**: Notes panel can be hidden/shown as needed
- **Visual Indicators**: Show when threads have associated notes
- **Responsive Design**: Works across different screen sizes and email layouts

### 4. Data Storage & Privacy
- **Flexible Storage Options**: Support both local-only and cloud sync storage
- **Platform-Specific Preferences**: Configure storage per email platform (e.g., Outlook local, Gmail synced)
- **Local Storage Fallback**: All data always cached locally using chrome.storage.local API
- **Optional Cloud Sync**: Integration with Google Drive, iCloud Drive, for cross-device sync
- **Privacy-First Design**: Users control what data syncs vs stays local
- **Data Export**: Allow users to export their notes for backup
- **Data Import**: Allow users to import previously exported notes
- **Storage Management**: Handle both local and cloud storage limits gracefully
- **Sync Conflict Resolution**: Handle conflicts when same note edited on multiple devices

### 6. Cloud Storage & Sync (Optional)
- **Multi-Provider Support**: Google Drive, iCloud Drive integration
- **Selective Sync**: Choose which platforms sync (e.g., Gmail syncs, Outlook stays local)
- **Real-time Sync**: Background synchronization across devices
- **Offline Capability**: Full functionality when cloud storage unavailable  
- **Sync Status Indicators**: Clear indication of sync status and conflicts
- **Conflict Resolution**: User-friendly conflict resolution when same note edited on multiple devices
- **Privacy Controls**: Granular control over what data is synced to which services
- **Gmail Integration**: Work with Gmail's conversation view and threading system
- **Outlook Integration**: Compatible with Outlook web's interface patterns
- **Cross-Platform Consistency**: Same user experience regardless of email platform

## Technical Requirements

### Browser Compatibility
- **Chrome**: Version 88+ (Manifest V3 support)
- **Edge**: Chromium-based Edge versions
- **Potential Firefox**: Consider for future versions

### Performance Requirements
- **Load Time**: Extension should not noticeably impact email loading speed
- **Memory Usage**: Minimal memory footprint (<10MB)
- **Storage Efficiency**: Compress notes data to maximize storage capacity
- **UI Responsiveness**: Notes panel should appear/hide within 100ms

### Security & Privacy
- **Hybrid Storage Model**: Local storage for privacy-sensitive data, optional cloud for personal data
- **Minimal Cloud Permissions**: Request only essential cloud storage permissions when enabled
- **Data Encryption**: Encrypt all cloud-stored data using AES-256
- **No Telemetry**: No usage tracking or analytics
- **User Control**: Granular privacy settings for what data syncs where
- **OAuth Security**: Secure authentication for cloud storage providers

## User Experience Design

### Visual Design Principles
- **Native Integration**: Match the look and feel of host email platform
- **Minimalist**: Clean, uncluttered interface
- **Accessible**: Meet WCAG 2.1 AA standards
- **Consistent**: Same interaction patterns across Gmail and Outlook

### User Flows
1. **First Time Setup**: Simple onboarding explaining functionality and setting up sync settings
2. **Adding Notes**: Click thread → Notes panel appears → Type note → Auto-save
3. **Viewing Notes**: Visual indicator shows threads with notes → Click to expand
4. **Managing Notes**: Edit, delete, or export notes through simple controls

## Success Metrics

### User Engagement
- **Adoption Rate**: Installation and active usage
- **Note Creation**: Number of notes created per user per week
- **Retention**: Users still active after 30 days

### Performance Metrics
- **Load Time Impact**: <100ms delay on email loading
- **Crash Rate**: <0.1% of sessions
- **Storage Efficiency**: >90% of available storage utilized effectively

## Development Phases

### Phase 1: Core Foundation (Weeks 1-2)
- Basic Chrome extension structure
- Gmail thread detection
- Simple notes storage and retrieval (local only)
- Basic UI integration

### Phase 2: Outlook Integration (Week 3)
- Outlook web thread detection
- Cross-platform storage consistency
- UI adaptations for Outlook interface

### Phase 3: Enhanced Features (Week 4)
- Advanced UI features (indicators, search)
- Data export/import functionality
- Settings and preferences management

### Phase 4: Cloud Storage Integration (Week 5)
- Optional cloud storage providers integration
- Platform-specific storage preferences
- Sync conflict resolution
- Privacy controls and encryption

### Phase 5: Polish & Testing (Week 6)
- Comprehensive testing across platforms and storage modes
- Performance optimization
- User experience refinements
- Documentation and installation guide

## Risk Assessment

### Technical Risks
- **DOM Changes**: Email platforms may update their HTML structure
- **Platform Limitations**: Chrome extension API restrictions
- **Storage Limits**: Chrome extension storage quotas

### Mitigation Strategies
- **Robust Selectors**: Use multiple fallback strategies for DOM element detection
- **Version Compatibility**: Test across multiple Chrome versions
- **Storage Monitoring**: Implement storage usage monitoring and cleanup

## Success Criteria

### Minimum Viable Product (MVP)
- ✅ Works on both Gmail and Outlook web
- ✅ Can add, edit, and delete notes
- ✅ Notes persist across browser sessions
- ✅ Non-intrusive user interface
- ✅ Local storage with privacy controls
- ✅ Platform-specific storage preferences

### Full Success
- ✅ Seamless user experience across platforms and storage modes
- ✅ Optional cloud sync with multiple provider support
- ✅ Advanced features (search, export, indicators, encryption)
- ✅ Performance impact <100ms even with cloud sync
- ✅ Robust conflict resolution and sync reliability
- ✅ Positive user feedback and adoption

---

# Chronological Action Items for Development

## Phase 1: Foundation & Gmail Integration

### Action 1.1: Project Setup & Basic Structure
**Duration**: 2 hours
**Dependencies**: None

**Deliverables**:
- Create extension directory structure
- Implement manifest.json with basic configuration
- Set up development environment with hot reload
- Create basic HTML/CSS for notes panel

**Acceptance Criteria**:
- Extension loads in Chrome developer mode
- Manifest V3 structure is properly configured
- Basic file structure is established
- Can toggle extension on/off

### Action 1.2: Gmail Thread Detection System
**Duration**: 4 hours  
**Dependencies**: Action 1.1

**Deliverables**:
- Content script that runs on Gmail pages
- Thread ID extraction logic for Gmail conversations
- URL-based and DOM-based thread identification
- Thread change detection system

**Acceptance Criteria**:
- Accurately identifies unique Gmail conversation threads
- Detects when user switches between conversations
- Handles both conversation view and individual email view
- Generates consistent thread IDs across page reloads

### Action 1.3: Basic Local Storage Implementation
**Duration**: 3 hours
**Dependencies**: Action 1.2

**Deliverables**:
- Chrome storage API integration
- Data structure for storing thread-note associations
- Basic CRUD operations (Create, Read, Update, Delete)
- Error handling for storage operations

**Acceptance Criteria**:
- Can save notes associated with Gmail thread IDs
- Notes persist across browser restarts
- Handles storage errors gracefully
- Data structure is efficient and extensible

### Action 1.4: Basic Notes UI for Gmail
**Duration**: 4 hours
**Dependencies**: Actions 1.2, 1.3

**Deliverables**:
- Notes panel injection into Gmail interface
- Simple textarea for note input
- Save/cancel buttons with basic interactions
- CSS styling that matches Gmail's design language

**Acceptance Criteria**:
- Notes panel appears in appropriate location in Gmail
- UI doesn't conflict with existing Gmail functionality
- Notes are automatically saved on user input
- Panel can be shown/hidden as needed

### Action 1.5: Gmail Integration Testing & Refinement
**Duration**: 2 hours
**Dependencies**: Actions 1.1-1.4

**Deliverables**:
- Comprehensive testing across different Gmail views
- Bug fixes for edge cases
- Performance optimization for Gmail
- Documentation of Gmail-specific implementation details

**Acceptance Criteria**:
- Works reliably in Gmail conversation view
- Works in Gmail individual message view
- No noticeable performance impact on Gmail loading
- Handles Gmail interface updates gracefully

## Phase 2: Outlook Integration

### Action 2.1: Outlook Thread Detection System
**Duration**: 4 hours
**Dependencies**: Action 1.5 (Gmail foundation complete)

**Deliverables**:
- Outlook-specific content script
- Thread ID extraction for Outlook conversations
- Support for both outlook.office365.com and outlook.live.com
- Unified thread ID system across platforms

**Acceptance Criteria**:
- Accurately identifies Outlook conversation threads
- Works on both Outlook web versions
- Thread IDs are consistent across platform switches
- Handles Outlook's conversation threading properly

### Action 2.2: Cross-Platform Storage Architecture
**Duration**: 3 hours
**Dependencies**: Actions 1.3, 2.1

**Deliverables**:
- Platform-agnostic storage layer
- Migration system for existing Gmail-only data
- Data structure that supports multiple email platforms
- Storage key naming convention for cross-platform notes

**Acceptance Criteria**:
- Same note can be accessed from Gmail or Outlook if same conversation
- No data conflicts between platforms
- Storage is efficiently organized
- Supports future platform additions

### Action 2.3: Outlook UI Integration
**Duration**: 4 hours
**Dependencies**: Actions 1.4, 2.1

**Deliverables**:
- Notes panel design for Outlook interface
- Outlook-specific CSS and styling
- UI positioning logic for Outlook's layout
- Consistent user experience across platforms

**Acceptance Criteria**:
- Notes panel integrates naturally with Outlook web interface
- Visual consistency with Outlook's design language
- Same functionality as Gmail implementation
- Responsive to different Outlook layout configurations

### Action 2.4: Platform Detection & Switching Logic
**Duration**: 2 hours
**Dependencies**: Actions 2.1, 2.2, 2.3

**Deliverables**:
- Automatic platform detection system
- Seamless switching between Gmail and Outlook
- Platform-specific feature toggles
- Unified extension popup/options interface

**Acceptance Criteria**:
- Extension automatically adapts to current email platform
- No manual configuration required from user
- Smooth experience when switching between Gmail and Outlook tabs
- Common functionality works identically on both platforms

## Phase 3: Enhanced Features

### Action 3.1: Visual Indicators System
**Duration**: 3 hours
**Dependencies**: Phase 2 complete

**Deliverables**:
- Visual indicators showing which threads have notes
- Icon/badge system for both Gmail and Outlook
- Hover previews of note content
- Customizable indicator preferences

**Acceptance Criteria**:
- Clear visual indication of threads with existing notes
- Indicators don't interfere with email platform functionality
- Hover preview shows first 100 characters of notes
- Users can customize indicator display preferences

### Action 3.2: Advanced Notes Features
**Duration**: 4 hours
**Dependencies**: Phase 2 complete

**Deliverables**:
- Note search functionality across all threads
- Basic rich text formatting (bold, italic, lists)
- Character count and note statistics
- Auto-save with draft status indication

**Acceptance Criteria**:
- Can search through all notes across all threads
- Basic formatting works and persists correctly
- Real-time character counting and save status
- No data loss during editing sessions

### Action 3.3: Data Export/Import System
**Duration**: 3 hours
**Dependencies**: Action 3.1

**Deliverables**:
- Export all notes to JSON/CSV format
- Import notes from previously exported files
- Backup and restore functionality
- Data validation for imported files

**Acceptance Criteria**:
- Clean export format that's human-readable
- Import process handles errors gracefully
- Backup includes all necessary data for full restore
- Data validation prevents corrupted imports

### Action 3.4: Settings & Preferences Management
**Duration**: 2 hours
**Dependencies**: Actions 3.1, 3.2

**Deliverables**:
- Extension options page
- Customizable settings (themes, positions, indicators)
- Keyboard shortcut configuration
- Storage usage monitoring

**Acceptance Criteria**:
- Intuitive settings interface
- All customizations persist across sessions
- Keyboard shortcuts work reliably
- Storage usage is clearly displayed with cleanup options

## Phase 4: Cloud Storage Integration

### Action 4.1: Cloud Storage Provider APIs
**Duration**: 5 hours
**Dependencies**: Phase 3 complete

**Deliverables**:
- Google Drive API integration for file storage
- OAuth authentication flow for cloud providers
- Encrypted data format for cloud storage

**Acceptance Criteria**:
- Can authenticate with Google Drive
- Encrypted notes stored securely in cloud folders
- OAuth tokens managed securely
- Graceful fallback when cloud services unavailable

### Action 4.2: Platform-Specific Storage Preferences
**Duration**: 3 hours
**Dependencies**: Actions 3.4, 4.1

**Deliverables**:
- Per-platform storage configuration (Gmail→Cloud, Outlook→Local)
- Storage preference UI in extension settings
- Migration tools for existing local data
- Storage status indicators in UI

**Acceptance Criteria**:
- Users can configure different storage per email platform
- Clear indication of where each platform's data is stored
- Smooth migration from local-only to hybrid storage
- Storage preferences persist across extension updates

### Action 4.3: Sync Engine & Conflict Resolution
**Duration**: 4 hours
**Dependencies**: Actions 4.1, 4.2

**Deliverables**:
- Real-time sync engine for cloud-enabled platforms
- Conflict detection and resolution UI
- Sync status indicators and progress feedback
- Background sync with rate limiting

**Acceptance Criteria**:
- Notes sync automatically across devices
- Clear conflict resolution when same note edited on multiple devices
- Sync status visible to user with error handling
- Efficient sync that doesn't impact performance

### Action 4.4: Privacy Controls & Data Encryption
**Duration**: 3 hours
**Dependencies**: Actions 4.1, 4.2

**Deliverables**:
- AES-256 encryption for all cloud-stored data
- Privacy settings for granular sync control
- Data anonymization options
- Local encryption key management

**Acceptance Criteria**:
- All cloud data encrypted before upload
- Users can control exactly what data syncs
- Encryption keys stored securely locally
- No readable data exposed in cloud storage

## Phase 5: Polish & Deployment

### Action 5.1: Comprehensive Cross-Platform Testing
**Duration**: 5 hours
**Dependencies**: Phase 4 complete

**Deliverables**:
- Test suite covering all storage modes (local, cloud, hybrid)
- Cross-browser compatibility verification  
- Multi-device sync testing
- Performance benchmarking with cloud sync

**Acceptance Criteria**:
- All functionality works across local and cloud storage modes
- Sync works reliably across multiple devices
- Performance impact remains <100ms even with cloud sync
- No data loss under any normal usage scenario

### Action 5.2: User Experience Optimization
**Duration**: 3 hours
**Dependencies**: Action 5.1

**Deliverables**:
- UI/UX refinements for cloud storage features
- Accessibility improvements (WCAG 2.1 AA)
- Onboarding flow for storage preferences
- Error message improvements for sync issues

**Acceptance Criteria**:
- Cloud storage setup is intuitive for non-technical users
- Clear guidance on privacy implications of each storage choice
- Smooth onboarding explaining work vs personal data separation
- Helpful error messages for sync and authentication issues

### Action 5.3: Documentation & Installation Guide  
**Duration**: 3 hours
**Dependencies**: Action 5.2

**Deliverables**:
- User setup guide including cloud storage configuration
- Privacy policy explaining data handling for each storage mode
- Troubleshooting guide for sync issues
- Developer documentation for cloud provider integrations

**Acceptance Criteria**:
- Clear setup instructions for both local-only and cloud-sync modes
- Privacy policy clearly explains what data goes where
- Troubleshooting covers common sync scenarios
- Documentation supports future cloud provider additions

### Action 5.4: Final Testing & Release Preparation
**Duration**: 2 hours
**Dependencies**: Actions 5.1, 5.2, 5.3

**Deliverables**:
- Release version packaging with optional permissions
- Final testing across storage modes and platforms
- Privacy and security audit of cloud integrations
- Release notes highlighting storage features

**Acceptance Criteria**:
- Extension packages correctly with optional cloud permissions
- Full functionality verified across local and cloud storage
- Security audit confirms no data leaks or vulnerabilities
- Release documentation covers all storage configuration options

---

## Total Estimated Timeline: 6 weeks
## Total Estimated Development Hours: 66 hours

### Phase Breakdown:
- **Phase 1 (Gmail Foundation)**: 15 hours
- **Phase 2 (Outlook Integration)**: 13 hours  
- **Phase 3 (Enhanced Features)**: 12 hours
- **Phase 4 (Cloud Storage Integration)**: 15 hours
- **Phase 5 (Polish & Deploy)**: 13 hours

### Critical Path Dependencies:
1. Phase 1 must complete before Phase 2
2. Phase 2 must complete before Phase 3
3. Phase 3 must complete before Phase 4
4. Phase 4 must complete before Phase 5
5. Each action within a phase can often be parallelized or overlapped

### Storage Architecture Summary:
- **Work Email (Outlook)**: Local storage only for maximum privacy
- **Personal Email (Gmail)**: Optional cloud sync for cross-device access
- **User Control**: Granular settings to control what syncs where
- **Privacy First**: All cloud data encrypted, local fallback always available

This breakdown provides clear, actionable development tasks that build toward a comprehensive email thread notes solution with flexible, privacy-conscious storage options.