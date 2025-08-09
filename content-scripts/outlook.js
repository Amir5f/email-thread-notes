// Outlook content script for Email Thread Notes extension
// This will be implemented in Phase 2

console.log('Email Thread Notes: Outlook support coming in Phase 2');

// Placeholder for Outlook integration
class OutlookThreadDetector {
  constructor() {
    console.log('Outlook thread detection initialized (placeholder)');
  }
}

// Initialize when on Outlook
if (window.location.href.includes('outlook.office365.com') || 
    window.location.href.includes('outlook.live.com')) {
  setTimeout(() => {
    new OutlookThreadDetector();
  }, 1500);
}