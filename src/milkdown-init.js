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

    // Internal state
    let editor;
    let currentMarkdown = initialContent || '';

    // Helper to create or recreate the editor
    // We recreate it to handle full content replacement properly (parsing markdown)
    const createEditor = async (content) => {
      if (editor) {
        await editor.destroy();
      }
      
      // Clear container
      container.innerHTML = '';

      editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, container);
          ctx.set(defaultValueCtx, content);

          // Set up change listener
          ctx.get(listenerCtx).markdownUpdated((ctx, markdown, prevMarkdown) => {
            currentMarkdown = markdown;
            if (onChange && markdown !== prevMarkdown) {
              onChange(markdown);
            }
          });
        })
        .config(nord)
        .use(commonmark)
        .use(listener)
        .create();
        
      return editor;
    };

    // Initial creation
    await createEditor(initialContent);

    console.log('✅ Milkdown editor created successfully');

    return {
      // Get markdown content from our internal tracker (updated by listener)
      // This ensures we get the serialized Markdown, not plain text
      getMarkdown() {
        return currentMarkdown;
      },

      // Set markdown content by recreating the editor
      // This ensures the Markdown is parsed correctly by CommonMark
      async setMarkdown(markdown) {
        try {
          const content = markdown || '';
          currentMarkdown = content;
          await createEditor(content);
          console.log('✅ Markdown content set successfully (editor recreated)');
        } catch (error) {
          console.error('❌ Error setting markdown:', error);
        }
      },

      // Get editor root element for RTL detection
      getEditorRoot() {
        return container.querySelector('.milkdown');
      },

      // Destroy editor
      async destroy() {
        if (editor) await editor.destroy();
      },

      // Focus editor
      focus() {
        try {
          if (editor && editor.ctx) {
            const view = editor.ctx.get(editorViewCtx);
            view.focus();
          }
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
