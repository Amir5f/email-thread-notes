# Chrome Side Panel Testing Guide

## Phase 1 Implementation Testing

### Prerequisites
1. Chrome version 114+ (required for Side Panel API)
2. Extension loaded in developer mode
3. Access to Gmail and/or Outlook accounts

### Test Plan

#### Test 1: Extension Loading
**Expected Behavior:**
- Extension loads without console errors
- Side panel permission is granted
- Background script initializes properly

**Steps:**
1. Load extension in Chrome developer mode
2. Check console for any errors
3. Verify manifest.json is valid
4. Confirm side panel permission in extension details

**Success Criteria:**
- No console errors during load
- Extension appears in Chrome extensions list
- Side panel API is available

#### Test 2: Side Panel Opening
**Expected Behavior:**
- Clicking extension icon opens side panel on email domains
- Side panel shows "All Notes" view by default
- "Thread Notes" button is disabled initially

**Steps:**
1. Navigate to mail.google.com
2. Click extension icon in toolbar
3. Verify side panel opens
4. Check initial UI state

**Success Criteria:**
- Side panel opens and displays correctly
- UI matches design expectations
- Button states are correct

#### Test 3: Gmail Thread Detection
**Expected Behavior:**
- Opening a Gmail conversation enables "Thread Notes" button
- Platform indicator shows "Gmail"
- Thread ID is detected and communicated to sidebar

**Steps:**
1. Open Gmail in Chrome
2. Open side panel
3. Navigate to a Gmail conversation
4. Watch for thread detection in console
5. Verify "Thread Notes" button becomes enabled

**Success Criteria:**
- Console logs show thread detection
- "Thread Notes" button enabled
- Platform indicator updated
- No JavaScript errors

#### Test 4: Outlook Thread Detection
**Expected Behavior:**
- Opening an Outlook conversation enables "Thread Notes" button
- Platform indicator shows appropriate Outlook variant
- Thread ID is detected for Outlook

**Steps:**
1. Open Outlook (outlook.office365.com, outlook.office.com, or outlook.live.com)
2. Open side panel
3. Navigate to an Outlook conversation
4. Watch for thread detection in console
5. Verify "Thread Notes" button becomes enabled

**Success Criteria:**
- Console logs show Outlook thread detection
- "Thread Notes" button enabled
- Platform indicator shows Outlook variant
- No JavaScript errors

#### Test 5: Content Script to Sidebar Communication
**Expected Behavior:**
- Content scripts send thread change messages to sidebar
- Sidebar receives and processes messages correctly
- Platform changes are communicated

**Steps:**
1. Open side panel
2. Navigate between email threads
3. Switch between Gmail and Outlook
4. Monitor console logs for message passing

**Success Criteria:**
- Console shows successful message passing
- Sidebar updates in response to content script messages
- No message passing errors

### Known Issues to Watch For

#### Chrome Side Panel API Issues
- **Version Compatibility**: Ensure Chrome 114+
- **Permission Errors**: Check for side panel permission issues
- **API Availability**: Verify chrome.sidePanel exists

#### Content Script Issues
- **Script Injection**: Ensure content scripts load on email domains
- **Thread Detection**: URL parsing may fail on new Gmail/Outlook layouts
- **Message Passing**: Runtime errors may prevent communication

#### Sidebar Issues
- **Message Handling**: Sidebar may not receive content script messages
- **UI State**: Button states may not update correctly
- **Cross-Origin**: Sidebar isolation may cause communication issues

### Debugging Tips

#### Console Monitoring
Monitor these console outputs:
```
Gmail Sidebar Connector initialized
Outlook Sidebar Connector initialized  
Email Notes Sidebar initialized
THREAD CHANGED: null -> [thread-id]
Sidebar: Thread changed
```

#### Extension DevTools
1. Right-click extension icon → "Inspect popup" (for sidebar)
2. Use Chrome Developer Tools → Extensions tab
3. Monitor background script logs

#### Message Flow Verification
Expected message flow:
```
Content Script → Background Script → Sidebar
- threadChanged message
- platformChanged message
- getCurrentThread request/response
```

### Success Criteria for Phase 1

#### Functional Requirements
- ✅ Side panel opens on email domains
- ✅ Thread detection works for Gmail
- ✅ Thread detection works for Outlook
- ✅ Dual button interface functions
- ✅ Message passing between content scripts and sidebar
- ✅ Platform indicators work correctly

#### Technical Requirements
- ✅ No console errors during normal operation
- ✅ Chrome Side Panel API integration working
- ✅ Content scripts simplified (no UI injection)
- ✅ Manifest V3 compliance maintained
- ✅ Extension loads in Chrome 114+

### Next Steps After Phase 1

Once basic thread detection and sidebar communication is verified:

1. **Phase 2**: Feature Parity Migration
   - Port CRUD operations to sidebar
   - Implement thread notes view
   - Add All Notes list functionality

2. **Phase 3**: Code Cleanup
   - Remove overlay approach files
   - Add sidebar-specific features
   - Comprehensive testing

### Test Environment Setup

#### Recommended Test Accounts
- Gmail: Personal or test account
- Outlook 365: Work/school account if available
- Outlook Live: Personal Microsoft account

#### Browser Configuration
- Chrome 114+ (stable channel recommended)
- Developer mode enabled
- Extension developer tools access
- Console logging enabled

### Debugging Commands

#### Check Chrome Version
```javascript
chrome.runtime.getManifest().version
navigator.userAgent
```

#### Check Side Panel API
```javascript
typeof chrome.sidePanel
chrome.sidePanel.setPanelBehavior
```

#### Monitor Message Passing
```javascript
chrome.runtime.onMessage.addListener((msg, sender, response) => {
  console.log('Message received:', msg, 'from:', sender);
});
```

---

**Testing Status**: Ready for Phase 1 verification
**Expected Duration**: 30-60 minutes for comprehensive testing
**Critical Success Factor**: Thread detection working reliably on both platforms