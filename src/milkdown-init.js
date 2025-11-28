// Milkdown Editor Initialization for Email Thread Notes
// This file contains the Milkdown initialization code to replace Quill

// Import from bundled version (no bare imports, CSP-compatible)
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, commonmark, nord, listener, listenerCtx } from '../lib/milkdown-bundle.js';

export async function initMilkdownEditor(container, initialContent = '', onChange) {
  try {
    console.log('Initializing Milkdown editor...');

    if (!container) {
      throw new Error('Editor container not found');
    }

    // Create Milkdown editor
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

    console.log('✅ Milkdown editor initialized successfully');

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
          await editor.action((ctx) => {
            const view = ctx.get(editorViewCtx);
            const state = view.state;
            const tr = state.tr.replaceWith(0, state.doc.content.size,
              state.schema.text(markdown || ''));
            view.dispatch(tr);
          });
        } catch (error) {
          console.error('Error setting markdown:', error);
          // Fallback: destroy and recreate
          await this.destroy();
          return await initMilkdownEditor(container, markdown, onChange);
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
