// Milkdown Editor Initialization for Email Thread Notes
// This file contains the Milkdown initialization code to replace Quill

// Import from bundled version (no bare imports, CSP-compatible)
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, commonmark, nord, listener, listenerCtx } from '../lib/milkdown-bundle.js';

export async function initMilkdownEditor(container, initialContent = '', onChange) {
  try {
    console.log('🚀 initMilkdownEditor() called from milkdown-init.js');
    console.log('  - Container:', container);
    console.log('  - Initial content length:', initialContent?.length || 0);

    if (!container) {
      throw new Error('Editor container not found');
    }

    // Count existing milkdown instances in this container
    const existingInstances = container.querySelectorAll('.milkdown');
    if (existingInstances.length > 0) {
      console.error(`❌ CRITICAL: Found ${existingInstances.length} existing Milkdown instances! This should not happen.`);
    }

    // Create Milkdown editor
    console.log('📝 Creating Milkdown Editor instance...');
    const editor = await Editor.make()
      .config((ctx) => {
        ctx.set(rootCtx, container);
        ctx.set(defaultValueCtx, initialContent);

        // Set up change listener
        ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
          if (onChange && markdown !== prevMarkdown) {
            onChange(markdown);
          }
        });
      })
      .config(nord)
      .use(commonmark)
      .use(listener)
      .create();

    console.log('✅ Milkdown editor created successfully');

    // Verify the editor was created
    const milkdownDiv = container.querySelector('.milkdown');
    if (milkdownDiv) {
      console.log('✅ .milkdown div found in container');
    } else {
      console.error('❌ .milkdown div NOT found after creation!');
    }

    return {
      editor,

      // Get markdown content
      getMarkdown() {
        try {
          if (!editor || !editor.ctx) {
            return '';
          }
          const view = editor.ctx.get(editorViewCtx);
          if (!view || !view.state || !view.state.doc) {
            return '';
          }
          return view.state.doc.textContent || '';
        } catch (error) {
          // Silently return empty if editor isn't ready yet
          return '';
        }
      },

      // Set markdown content
      async setMarkdown(markdown) {
        try {
          // Wait for editor to be fully ready with retry logic
          let retries = 0;
          const maxRetries = 10;

          // Milkdown doesn't allow empty text nodes - use single space for empty content
          const content = markdown && markdown.trim() ? markdown : ' ';

          while (retries < maxRetries) {
            try {
              await editor.action((ctx) => {
                const view = ctx.get(editorViewCtx);
                const state = view.state;
                const tr = state.tr.replaceWith(0, state.doc.content.size,
                  state.schema.text(content));
                view.dispatch(tr);
              });
              console.log('✅ Markdown content set successfully');
              return; // Success!
            } catch (error) {
              if (retries < maxRetries - 1) {
                // Wait and retry
                await new Promise(resolve => setTimeout(resolve, 50));
                retries++;
                console.log(`⏳ Retry ${retries}/${maxRetries} setting markdown...`);
              } else {
                throw error; // Final retry failed
              }
            }
          }
        } catch (error) {
          console.error('❌ Error setting markdown after retries:', error);
          console.warn('⚠️ Editor may not be ready - content may not display correctly');
        }
      },

      // Get editor root element for RTL detection
      getEditorRoot() {
        return container.querySelector('.milkdown');
      },

      // Destroy editor
      async destroy() {
        try {
          await editor.destroy();
        } catch (error) {
          console.error('Error destroying editor:', error);
        }
      },

      // Focus editor
      focus() {
        try {
          const view = editor.ctx.get(editorViewCtx);
          view.focus();
        } catch (error) {
          console.error('Error focusing editor:', error);
        }
      }
    };

  } catch (error) {
    console.error('❌ Failed to initialize Milkdown:', error);
    throw error;
  }
}
