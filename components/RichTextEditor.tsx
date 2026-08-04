import React, { useRef, useEffect, useState } from 'react';
import { 
  Bold, Italic, Underline, List, ListOrdered, Heading2, Heading3, 
  Code, Eye, RemoveFormatting, AlignLeft, AlignCenter, AlignRight, FileText
} from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = 'Rédigez ou collez le texte ici...',
  className = ''
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isHtmlMode, setIsHtmlMode] = useState<boolean>(false);
  const [htmlValue, setHtmlValue] = useState<string>(value || '');
  const isUpdatingRef = useRef<boolean>(false);

  // Sync value from prop into editor DOM
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (editorRef.current.innerHTML !== (value || '')) {
        editorRef.current.innerHTML = value || '';
      }
    }
    setHtmlValue(value || '');
  }, [value, isHtmlMode]);

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true;
      const html = editorRef.current.innerHTML;
      setHtmlValue(html);
      onChange(html);
      setTimeout(() => {
        isUpdatingRef.current = false;
      }, 0);
    }
  };

  const execCmd = (command: string, arg: string | undefined = undefined) => {
    if (isHtmlMode) return;
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      editorRef.current.focus();
      handleInput();
    }
  };

  const handleHtmlChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setHtmlValue(val);
    onChange(val);
  };

  return (
    <div className={`flex flex-col border border-slate-200 rounded-2xl bg-white overflow-hidden shadow-sm ${className}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-1 p-2 bg-slate-50 border-b border-slate-200 text-slate-700">
        <div className="flex flex-wrap items-center gap-1">
          {!isHtmlMode && (
            <>
              <button
                type="button"
                onClick={() => execCmd('formatBlock', '<h2>')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors flex items-center gap-1 text-xs font-bold px-2"
                title="Titre H2"
              >
                <Heading2 size={16} /> H2
              </button>
              <button
                type="button"
                onClick={() => execCmd('formatBlock', '<h3>')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors flex items-center gap-1 text-xs font-bold px-2"
                title="Titre H3"
              >
                <Heading3 size={16} /> H3
              </button>
              <button
                type="button"
                onClick={() => execCmd('formatBlock', '<p>')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors text-xs font-semibold px-2"
                title="Paragraphe"
              >
                P
              </button>

              <div className="w-[1px] h-5 bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => execCmd('bold')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Gras"
              >
                <Bold size={16} />
              </button>
              <button
                type="button"
                onClick={() => execCmd('italic')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Italique"
              >
                <Italic size={16} />
              </button>
              <button
                type="button"
                onClick={() => execCmd('underline')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Souligné"
              >
                <Underline size={16} />
              </button>

              <div className="w-[1px] h-5 bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => execCmd('insertUnorderedList')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Liste à puces"
              >
                <List size={16} />
              </button>
              <button
                type="button"
                onClick={() => execCmd('insertOrderedList')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Liste numérotée"
              >
                <ListOrdered size={16} />
              </button>

              <div className="w-[1px] h-5 bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => execCmd('justifyLeft')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Aligner à gauche"
              >
                <AlignLeft size={16} />
              </button>
              <button
                type="button"
                onClick={() => execCmd('justifyCenter')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Centrer"
              >
                <AlignCenter size={16} />
              </button>
              <button
                type="button"
                onClick={() => execCmd('justifyRight')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Aligner à droite"
              >
                <AlignRight size={16} />
              </button>

              <div className="w-[1px] h-5 bg-slate-300 mx-1" />

              <button
                type="button"
                onClick={() => execCmd('removeFormat')}
                className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-700 transition-colors"
                title="Effacer la mise en forme"
              >
                <RemoveFormatting size={16} />
              </button>
            </>
          )}
        </div>

        {/* Toggle HTML source vs Visual */}
        <button
          type="button"
          onClick={() => setIsHtmlMode(!isHtmlMode)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors ${
            isHtmlMode 
              ? 'bg-slate-900 text-white' 
              : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
          }`}
          title={isHtmlMode ? "Basculer vers l'éditeur visuel" : "Voir/Modifier le code HTML source"}
        >
          {isHtmlMode ? <Eye size={14} /> : <Code size={14} />}
          <span>{isHtmlMode ? 'Mode Visuel' : 'Code HTML'}</span>
        </button>
      </div>

      {/* Editor Body */}
      {isHtmlMode ? (
        <textarea
          value={htmlValue}
          onChange={handleHtmlChange}
          className="w-full h-80 p-4 font-mono text-xs text-slate-800 bg-slate-900 text-emerald-400 outline-none resize-y"
          placeholder="Code HTML..."
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          className="w-full min-h-[320px] max-h-[500px] overflow-y-auto p-4 text-sm text-slate-800 outline-none prose prose-slate max-w-none focus:ring-0"
          data-placeholder={placeholder}
          style={{ minHeight: '320px' }}
        />
      )}
    </div>
  );
};
