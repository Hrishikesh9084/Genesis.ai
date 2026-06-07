import { useState, useEffect, useRef } from 'react';
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

function getSharedPrefixLength(left, right) {
  const limit = Math.min(left.length, right.length);
  let index = 0;

  while (index < limit && left[index] === right[index]) {
    index += 1;
  }

  return index;
}

export default function CodeEditor({ filePath, content, onChange, readOnly = false, liveTyping = false }) {
  const [copied, setCopied] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimerRef = useRef(null);
  const lastFilePathRef = useRef(filePath);

  const clearTypingTimer = () => {
    if (typingTimerRef.current) {
      window.clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (!liveTyping) {
      clearTypingTimer();
      setIsTyping(false);
      setLocalContent(content);
      return undefined;
    }

    const targetContent = content || '';
    const fileChanged = lastFilePathRef.current !== filePath;
    lastFilePathRef.current = filePath;
    clearTypingTimer();

    if (!fileChanged && targetContent === localContent) {
      setIsTyping(false);
      return undefined;
    }

    const sharedPrefixLength = fileChanged ? 0 : getSharedPrefixLength(localContent || '', targetContent);
    const startContent = targetContent.slice(0, sharedPrefixLength);
    const remainingContent = targetContent.slice(sharedPrefixLength);
    const stepSize = Math.max(1, Math.ceil(Math.max(remainingContent.length, 1) / 120));

    setLocalContent(startContent);
    setIsTyping(remainingContent.length > 0);

    let currentLength = sharedPrefixLength;

    const typeNextChunk = () => {
      currentLength = Math.min(currentLength + stepSize, targetContent.length);
      setLocalContent(targetContent.slice(0, currentLength));

      if (currentLength < targetContent.length) {
        typingTimerRef.current = window.setTimeout(typeNextChunk, 12);
      } else {
        typingTimerRef.current = null;
        setIsTyping(false);
      }
    };

    if (sharedPrefixLength < targetContent.length) {
      typingTimerRef.current = window.setTimeout(typeNextChunk, 12);
    }

    return clearTypingTimer;
  }, [content, liveTyping]);

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
          {isTyping && liveTyping && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-300 border border-orange-500/20">
              typing
            </span>
          )}
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
