# Implementation Plan - Milkdown + UI Redesign

## Phase 1: Preparation ✅
- [x] Install Milkdown packages
- [x] Copy Milkdown to lib folder
- [x] Create mockups and get approval

## Phase 2: Update HTML (sidebar.html)

### Changes Needed:
1. **Remove Quill.js script tag** → Add Milkdown CSS
2. **Replace emojis with SVG icons** (settings, save, delete, mail)
3. **Update CSS** with new design (colors, animations, spacing)
4. **Simplify header** (new tab design)
5. **Remove toolbar container** (Milkdown handles this)
6. **Add SVG icon definitions**

## Phase 3: Update JavaScript (sidebar.js)

### Major Changes:
1. **Remove Quill initialization** (`initQuillEditor`)
2. **Add Milkdown initialization** (`initMilkdownEditor`)
3. **Update RTL detection** to work with Milkdown
4. **Update save/load** methods for Milkdown API
5. **Add mutation observer** for RTL auto-detection
6. **Keep all existing** note management logic

### Functions to Update:
- `initMilkdownEditor()` - NEW
- `detectAndSetTextDirection()` - UPDATE (Milkdown root)
- `loadNoteToEditor()` - UPDATE (Milkdown API)
- `saveCurrentNote()` - UPDATE (Milkdown API)
- `handleEditorChange()` - UPDATE (Milkdown events)

## Phase 4: CSS Updates

### New Styles:
1. **Color palette** (Indigo #6366f1 instead of Blue)
2. **Animations** (slideDown, fadeIn, slideUp, pulse)
3. **Hover effects** (lift, rotate, shadow)
4. **Remove borders** → Add subtle shadows
5. **Better typography** (Inter font, line heights)
6. **Card-based layouts** for All Notes

## Phase 5: SVG Icons

### Icons Needed:
- Settings (gear with rotation animation)
- Mail (envelope)
- Save (floppy disk)
- Delete (trash can)
- Search (magnifying glass)

## Phase 6: Testing

1. **Hebrew RTL** - Test with עברית
2. **English LTR** - Test with English
3. **Mixed text** - Test both
4. **Save/Load** - Verify persistence
5. **All Notes view** - Check list/search
6. **Export/Import** - Verify backup works

## Phase 7: Version Update

- Update manifest.json to 2.3.0
- Update todos.md
- Test in Chrome

---

## Estimated Time: 3-4 hours

### Breakdown:
- HTML updates: 30 min
- CSS updates: 45 min
- JavaScript (Milkdown integration): 1.5 hours
- RTL detection: 30 min
- Testing: 30 min
- Polish & fixes: 15 min

---

## Files to Modify:

1. `src/sidebar.html` - Full redesign
2. `src/sidebar.js` - Milkdown integration
3. `manifest.json` - Version bump
4. `todos.md` - Documentation

## Files to Keep:
- `src/background.js` - No changes needed
- `src/gmail-sidebar.js` - No changes needed
- `src/outlook-sidebar.js` - No changes needed

---

Ready to proceed!
