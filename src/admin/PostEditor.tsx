import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { postContentHtml, safeContentUrl, sanitizePostHtml, saveRichText } from '../content/postContent';
import '../content/postContent.css';

export function PostEditor({ value, onChange, disabled }: {
  value: string; onChange: (value: string) => void; disabled: boolean;
}) {
  const change = useRef(onChange);
  change.current = onChange;
  const [tool, setTool] = useState<'link' | 'image' | null>(null);
  const [url, setUrl] = useState(''), [alt, setAlt] = useState(''), [error, setError] = useState('');
  const [initialContent] = useState(() => postContentHtml(value));
  const editor = useEditor({
    extensions: [StarterKit.configure({
      heading: { levels: [1, 2, 3, 4, 5, 6] },
      link: { openOnClick: false, isAllowedUri: url => safeContentUrl(url), HTMLAttributes: { rel: 'noopener noreferrer', target: null } },
    }), Image.configure({ allowBase64: false })],
    content: initialContent,
    editorProps: {
      attributes: { class: 'post-content', role: 'textbox', 'aria-label': 'Post content', 'aria-multiline': 'true', 'aria-describedby': 'post-content-help' },
      transformPastedHTML: sanitizePostHtml,
    },
    onUpdate: ({ editor }) => change.current(saveRichText(editor.getHTML())),
  });
  // Formatting controls reflect selection changes as well as content changes.
  useEditorState({ editor, selector: ({ editor }) => editor?.state });
  useEffect(() => { editor?.setEditable(!disabled, false); }, [editor, disabled]);
  if (!editor) return <p role="status">Loading editor…</p>;
  function showTool(next: 'link' | 'image') {
    setTool(next); setError(''); setAlt('');
    setUrl(next === 'link' ? String(editor?.getAttributes('link').href ?? '') : '');
  }
  function applyUrl() {
    const candidate = url.trim();
    if (!safeContentUrl(candidate, tool === 'image')) {
      setError(tool === 'image' ? 'Enter an HTTPS image URL.' : 'Enter a full https://, http:// or mailto: link.'); return;
    }
    if (tool === 'image') editor!.chain().focus().setImage({ src: candidate, alt }).run();
    else if (editor!.state.selection.empty && !editor!.isActive('link'))
      editor!.chain().focus().insertContent({ type: 'text', text: candidate, marks: [{ type: 'link', attrs: { href: candidate } }] }).run();
    else editor!.chain().focus().extendMarkRange('link').setLink({ href: candidate }).run();
    setTool(null); setError('');
  }
  const buttons = [
    { label: 'Bold', active: editor.isActive('bold'), run: () => editor.chain().focus().toggleBold().run() },
    { label: 'Italic', active: editor.isActive('italic'), run: () => editor.chain().focus().toggleItalic().run() },
    { label: 'Underline', active: editor.isActive('underline'), run: () => editor.chain().focus().toggleUnderline().run() },
    { label: 'Strikethrough', active: editor.isActive('strike'), run: () => editor.chain().focus().toggleStrike().run() },
    { label: 'Bullet list', active: editor.isActive('bulletList'), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered list', active: editor.isActive('orderedList'), run: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Blockquote', active: editor.isActive('blockquote'), run: () => editor.chain().focus().toggleBlockquote().run() },
  ];
  return <div className="cms-field">
    <span id="post-content-label">Content</span>
    <div className="cms-rich-editor" role="group" aria-labelledby="post-content-label">
      <div className="cms-rich-toolbar" role="group" aria-label="Content formatting">
        <label>Style <select aria-label="Text style" disabled={disabled}
          value={editor.isActive('heading') ? String(editor.getAttributes('heading').level) : 'paragraph'}
          onChange={e => { const level = Number(e.target.value); if (level) editor.chain().focus().setHeading({ level: level as 1 | 2 | 3 }).run(); else editor.chain().focus().setParagraph().run(); }}>
          <option value="paragraph">Paragraph</option>{[1, 2, 3].map(level => <option key={level} value={level}>Heading {level}</option>)}
          {[4, 5, 6].filter(level => editor.isActive('heading', { level })).map(level => <option key={level} value={level}>Heading {level} (existing)</option>)}
        </select></label>
        {buttons.map(button => <button key={button.label} type="button" disabled={disabled} aria-pressed={button.active} onClick={button.run}>{button.label}</button>)}
        <button type="button" disabled={disabled} aria-pressed={editor.isActive('link')} onClick={() => showTool('link')}>Link</button>
        <button type="button" disabled={disabled || !editor.isActive('link')} onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}>Remove link</button>
        <button type="button" disabled={disabled} onClick={() => showTool('image')}>Image</button>
        <button type="button" disabled={disabled || !editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>Undo</button>
        <button type="button" disabled={disabled || !editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>Redo</button>
      </div>
      {tool && <div className="cms-rich-url" role="group" aria-label={tool === 'image' ? 'Insert image' : 'Edit link'}>
        <label className="cms-field">{tool === 'image' ? 'Image URL (HTTPS)' : 'Link URL'}<input autoFocus value={url} disabled={disabled} onChange={e => setUrl(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); } if (e.key === 'Escape') setTool(null); }} /></label>
        {tool === 'image' && <label className="cms-field">Image description (alt text)<input value={alt} disabled={disabled} onChange={e => setAlt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyUrl(); } }} /></label>}
        <div className="cms-actions"><button type="button" disabled={disabled} onClick={applyUrl}>Apply {tool}</button><button type="button" disabled={disabled} onClick={() => setTool(null)}>Cancel</button></div>
        {error && <p role="alert">{error}</p>}
      </div>}
      <EditorContent editor={editor} />
    </div>
    <small id="post-content-help">Select text to format it. Images use externally hosted HTTPS URLs. Existing Markdown is preserved until you edit the body.</small>
    {value.length > 100000 && <p role="alert">Content exceeds the 100,000-character storage limit. Shorten it before saving.</p>}
  </div>;
}
