import { useState, useEffect } from 'react';
import { Copy, Check } from 'lucide-react';
import Editor, { loader } from '@monaco-editor/react';

loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@latest/min/vs',
  },
});

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

  const handleChange = (value) => {
    const nextValue = value ?? '';
    setLocalContent(nextValue);
    onChange?.(nextValue);
  };

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
        <Editor
          height="100%"
          width="100%"
          language={getLanguage(filePath)}
          value={localContent || ''}
          theme="vs-dark"
          onChange={handleChange}
          loading={(
            <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
              Loading Monaco editor...
            </div>
          )}
          options={{
            readOnly,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace',
            lineHeight: 20,
            smoothScrolling: true,
            scrollBeyondLastLine: false,
            wordWrap: 'off',
            automaticLayout: true,
            tabSize: 2,
            renderWhitespace: 'selection',
            padding: { top: 10 },
          }}
        />
      </div>
    </div>
  );
}
