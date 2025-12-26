# Testing Documentation

## Overview

This project uses Playwright for end-to-end and integration testing of the Email Thread Notes Chrome extension. The testing setup is based on the [Composio webapp-testing skill](https://github.com/ComposioHQ/awesome-claude-skills/blob/master/webapp-testing/SKILL.md) adapted for JavaScript/TypeScript.

## Installation

All dependencies are already installed. Playwright and testing tools are in `devDependencies` and will **not** be included in the distributed extension.

### Dependencies
- `playwright` - Browser automation framework
- `@playwright/test` - Testing framework
- Chromium browser (downloaded to `~/Library/Caches/ms-playwright/`)

## Project Structure

```
tests/
├── e2e/                          # End-to-end tests
│   ├── gmail/
│   │   └── sidebar.spec.js      # Gmail-specific sidebar tests
│   └── outlook/
│       └── sidebar.spec.js      # Outlook-specific sidebar tests
├── integration/
│   └── editor.spec.js           # Milkdown editor integration tests
├── fixtures/
│   └── test-data.js             # Test data, mocks, and fixtures
└── utils/
    ├── extension-helper.js       # Chrome extension testing utilities
    ├── gmail-helper.js           # Gmail automation helpers
    └── outlook-helper.js         # Outlook automation helpers

scripts/
└── test-with-extension.js       # Helper script to build and run tests

playwright.config.js              # Playwright configuration
```

## Available Commands

```bash
# Run all tests
npm test

# Run tests in interactive UI mode
npm run test:ui

# Run tests with browser visible (headed mode)
npm run test:headed

# Run only Gmail tests
npm run test:gmail

# Run only Outlook tests
npm run test:outlook

# Show test report
npm run test:report
```

## Test Categories

### 1. Gmail E2E Tests (`tests/e2e/gmail/`)
Tests the extension's functionality within Gmail:
- Extension loading and injection
- Side panel opening
- Thread detection and ID extraction
- Note persistence in Gmail context

### 2. Outlook E2E Tests (`tests/e2e/outlook/`)
Tests the extension's functionality within Outlook:
- Extension loading and injection
- Side panel opening
- Conversation detection and ID extraction
- Note persistence in Outlook context

### 3. Editor Integration Tests (`tests/integration/`)
Tests the Milkdown editor in isolation:
- Editor initialization
- Text input and editing
- Markdown formatting
- Storage integration (save/retrieve notes)

## Helper Utilities

### Extension Helper (`tests/utils/extension-helper.js`)
Provides utilities for Chrome extension testing:
- `launchWithExtension()` - Launch browser with extension loaded
- `getServiceWorker()` - Access extension's service worker
- `waitForExtensionReady()` - Wait for extension to inject
- `openSidePanel()` - Open the extension's side panel
- `getStorageData()` / `setStorageData()` - Manage extension storage
- `clearStorage()` - Clear extension storage

### Gmail Helper (`tests/utils/gmail-helper.js`)
Gmail-specific automation utilities:
- `navigateToGmail()` - Navigate to Gmail and wait for load
- `openEmailBySubject()` - Search and open specific email
- `getCurrentThreadId()` - Extract thread ID from URL
- `waitForGmailView()` - Wait for specific Gmail view
- `isSidebarVisible()` - Check if extension sidebar is visible
- `getEmailCount()` - Count emails in current view

### Outlook Helper (`tests/utils/outlook-helper.js`)
Outlook-specific automation utilities:
- `navigateToOutlook()` - Navigate to Outlook and wait for load
- `openEmailBySubject()` - Search and open specific email
- `getCurrentConversationId()` - Extract conversation ID from URL
- `waitForOutlookView()` - Wait for specific Outlook view
- `isSidebarVisible()` - Check if extension sidebar is visible
- `getMessageCount()` - Count messages in current view
- `goToInbox()` - Navigate to inbox

## Test Data & Fixtures

Located in `tests/fixtures/test-data.js`:
- `testNotes` - Sample note content (simple, formatted, long, empty)
- `testThreadIds` - Valid/invalid thread IDs for Gmail and Outlook
- `testEmailData` - Mock email data
- `generateTestThreadId()` - Generate random thread ID
- `createMockNote()` - Create mock note object

## Configuration

The Playwright configuration (`playwright.config.js`) includes:
- **Timeout**: 60 seconds per test
- **Retries**: 2 on CI, 0 locally
- **Reporters**: HTML and list
- **Screenshots**: On failure only
- **Video**: On failure only
- **Projects**: Separate configurations for Gmail and Outlook tests

### Chrome Extension Loading

The extension is loaded using persistent context with these launch arguments:
```javascript
args: [
  '--disable-extensions-except=./dist',
  '--load-extension=./dist',
  '--no-sandbox',
]
```

**Note**: Extensions cannot run in headless mode, so tests run in headed mode by default.

## Next Steps (TODO)

### 1. Update Selectors
The current tests use placeholder selectors. Update these to match your actual extension UI:
- `[data-extension-trigger]` - Update to your extension's trigger button
- `[data-side-panel]` - Update to your side panel container
- `[data-extension-sidebar]` - Update to your sidebar element
- `.milkdown` - Verify this matches your Milkdown editor class

### 2. Authentication Handling
Tests currently assume you're already logged into Gmail/Outlook. Consider:
- Adding test account credentials (store securely in `.env`)
- Implementing login helpers
- Using Playwright's `storageState` to save authenticated sessions
- Setting up test accounts specifically for automation

### 3. Expand Test Coverage

#### Gmail Tests
- [ ] Create/edit/delete notes in different email threads
- [ ] Test note synchronization across tabs
- [ ] Test markdown rendering in notes
- [ ] Test export functionality
- [ ] Test search/filter in notes
- [ ] Test keyboard shortcuts

#### Outlook Tests
- [ ] Same as Gmail tests but for Outlook platform
- [ ] Test platform-specific features (if any)

#### Editor Tests
- [ ] Test all markdown features (headers, lists, links, images, code blocks)
- [ ] Test editor toolbar/commands
- [ ] Test undo/redo functionality
- [ ] Test copy/paste behavior
- [ ] Test performance with large notes

#### Integration Tests
- [ ] Test data migration between storage versions
- [ ] Test conflict resolution (if multiple tabs edit same note)
- [ ] Test offline functionality
- [ ] Test error handling and recovery

### 4. CI/CD Integration
- Set up GitHub Actions workflow for automated testing
- Configure test environments
- Add test coverage reporting
- Add performance benchmarks

### 5. Visual Regression Testing
Consider adding visual regression tests using Playwright's screenshot comparison:
```javascript
await expect(page).toHaveScreenshot('sidebar.png');
```

## Debugging Tests

### Run specific test file
```bash
npx playwright test tests/e2e/gmail/sidebar.spec.js
```

### Run specific test by name
```bash
npx playwright test -g "should load extension in Gmail"
```

### Debug mode (with Playwright Inspector)
```bash
npx playwright test --debug
```

### View trace for failed tests
```bash
npx playwright show-trace test-results/path-to-trace.zip
```

## Best Practices

1. **Always clean up**: Use `test.afterEach()` to close contexts and clear storage
2. **Use meaningful selectors**: Prefer data attributes over CSS classes
3. **Add wait conditions**: Use `waitForSelector()` and `waitForLoadState()`
4. **Isolate tests**: Each test should be independent and not rely on others
5. **Handle flakiness**: Add appropriate timeouts and retry logic
6. **Log meaningful info**: Use `console.log()` to track test progress
7. **Keep tests focused**: One test should verify one behavior

## Troubleshooting

### Extension not loading
- Ensure `npm run build` completes successfully before running tests
- Check that extension files exist in the project root
- Verify `manifest.json` is valid

### Tests timing out
- Increase timeout in `playwright.config.js`
- Check if selectors match your actual DOM
- Verify network conditions (slow loading)

### Authentication failures
- Manually log in to Gmail/Outlook once
- Save the storage state for reuse
- Check if 2FA is required

### Flaky tests
- Add explicit waits (`waitForSelector`, `waitForLoadState`)
- Use `toBeVisible()` instead of checking element existence
- Increase retry count in config

## Resources

- [Playwright Documentation](https://playwright.dev/)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Chrome Extension Testing](https://playwright.dev/docs/chrome-extensions)
- [Composio Webapp Testing Skill](https://github.com/ComposioHQ/awesome-claude-skills/blob/master/webapp-testing/SKILL.md)
