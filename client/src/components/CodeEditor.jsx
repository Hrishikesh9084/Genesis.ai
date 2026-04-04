import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';

function getLanguage(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    json: 'json', css: 'css', scss: 'css', html: 'html', htm: 'html',
    md: 'markdown', sql: 'sql', py: 'python', yml: 'yaml', yaml: 'yaml',
    env: 'bash', sh: 'bash', gitignore: 'bash',
  };
  return map[ext] || 'text';
}

export default function CodeEditor({ filePath, content, onChange, readOnly = false }) {
  const [copied, setCopied] = useState(false);
  const [localContent, setLocalContent] = useState(content);

  useEffect(() => {
    setLocalContent(content);
  }, [content]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(localContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleChange = (e) => {
    setLocalContent(e.target.value);
    onChange?.(e.target.value);
  };

  const lines = (localContent || '').split('\n');

  return (
    <div data-lenis-prevent className="flex flex-col h-full min-h-0 bg-gray-950 rounded-lg overflow-hidden border border-gray-800 ">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-400 font-mono">{filePath}</span>
          <span className="text-xs px-2 py-0.5 bg-gray-800 text-gray-500 rounded">{getLanguage(filePath)}</span>
        </div>
        <button onClick={handleCopy} className="text-gray-500 hover:text-white transition-colors p-1">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div data-lenis-prevent className="flex flex-1 min-h-0 overflow-hidden overscroll-contain">
        <div className="flex flex-col items-end py-3 px-3 bg-gray-950 border-r border-gray-800 select-none ">
          {lines.map((_, i) => (
            <span key={i} className="text-xs text-gray-600 leading-6 font-mono">{i + 1}</span>
          ))}
        </div>
        <textarea
          value={localContent}
          onChange={handleChange}
          readOnly={readOnly}
          spellCheck={false}
          className="flex-1 min-h-0 p-3 bg-transparent text-sm font-mono text-gray-200 leading-6 resize-none focus:outline-none whitespace-pre overflow-y-auto overscroll-contain"
          style={{ tabSize: 2 }}
        />
      </div>
    </div>
  );
}
