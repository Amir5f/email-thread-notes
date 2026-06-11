// Milkdown Editor Initialization for Email Thread Notes
// This file contains the Milkdown initialization code to replace Quill

// Import from bundled version (no bare imports, CSP-compatible)
import { Editor, rootCtx, defaultValueCtx, editorViewCtx, prosePluginsCtx, commonmark, nord, listener, listenerCtx, Plugin, PluginKey, inputRules, InputRule } from '../lib/milkdown-bundle.js';

// ProseMirror plugin: open links with Ctrl/Cmd+click.
// Implemented at the DOM level because handleClickOn only receives element
// nodes (the paragraph), never the text node that carries the link mark.
function linkClickPlugin() {
  return new Plugin({
    key: new PluginKey('linkClick'),
    props: {
      handleDOMEvents: {
        click(view, event) {
          if (!event.ctrlKey && !event.metaKey) return false;
          const anchor = event.target?.closest?.('a');
          if (!anchor || !view.dom.contains(anchor)) return false;
          const href = anchor.getAttribute('href') || '';
          // Security: only open http(s) URLs — markdown can carry javascript: hrefs
          if (!/^https?:\/\//i.test(href)) return false;
          event.preventDefault();
          try {
            if (typeof chrome !== 'undefined' && chrome.tabs?.create) {
              chrome.tabs.create({ url: href });
            } else {
              window.open(href, '_blank', 'noopener');
            }
          } catch (e) {
            console.error('Could not open link:', e);
          }
          return true;
        }
      }
    }
  });
}

// Input rule: typing a bare URL followed by a space turns it into a link.
function typedUrlPlugin() {
  return inputRules({
    rules: [
      new InputRule(/(?:^|\s)(https?:\/\/[^\s]+)\s$/i, (state, match, start, end) => {
        const linkType = state.schema.marks.link;
        if (!linkType) return null;
        const url = match[1];
        // The trailing \s is the just-typed char, not yet in the doc,
        // so the URL's last character sits exactly at `end`.
        const urlStart = end - url.length;
        if (urlStart < start) return null;
        const tr = state.tr;
        tr.addMark(urlStart, end, linkType.create({ href: url }));
        tr.insertText(' ', end);
        // Keep typing after the space outside the link mark
        tr.removeStoredMark(linkType);
        return tr;
      })
    ]
  });
}

// ProseMirror plugin: auto-link pasted URLs
function pasteLinkPlugin() {
  return new Plugin({
    key: new PluginKey('pasteLink'),
    props: {
      handlePaste(view, event) {
        try {
          const text = event.clipboardData?.getData('text/plain')?.trim();
          if (!text) return false;
          // Only act when the pasted text is a single bare URL
          if (!/^https?:\/\/\S+$/i.test(text)) return false;

          const { state, dispatch } = view;
          const schema = state.schema;
          // Guard: link mark must exist in schema
          if (!schema.marks.link) return false;

          const url = text;
          const { from, to, empty } = state.selection;
          const tr = state.tr;

          if (!empty) {
            // Wrap selected text in a link mark
            tr.addMark(from, to, schema.marks.link.create({ href: url }));
          } else {
            // Insert the URL as linked text at cursor
            tr.replaceSelectionWith(
              schema.text(url, [schema.marks.link.create({ href: url })]),
              false
            );
          }
          dispatch(tr);
          return true;
        } catch (e) {
          console.error('pasteLinkPlugin error:', e);
          return false; // Fall back to default paste
        }
      }
    }
  });
}

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

          // Register ProseMirror plugins for link click, paste-to-link and type-to-link
          ctx.update(prosePluginsCtx, (plugins) => [
            ...plugins,
            linkClickPlugin(),
            pasteLinkPlugin(),
            typedUrlPlugin(),
          ]);

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
