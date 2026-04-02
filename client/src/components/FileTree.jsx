import { useState } from 'react';
import { ChevronRight, ChevronDown, FileCode, Folder, FolderOpen } from 'lucide-react';

function buildTree(files) {
  const tree = {};
  Object.keys(files).forEach((path) => {
    const parts = path.split('/');
    let current = tree;
    parts.forEach((part, i) => {
      if (i === parts.length - 1) {
        current[part] = { __isFile: true, __path: path };
      } else {
        if (!current[part]) current[part] = {};
        current = current[part];
      }
    });
  });
  return tree;
}

function TreeNode({ name, node, onSelect, selectedFile, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);

  if (node.__isFile) {
    const isSelected = selectedFile === node.__path;
    return (
      <button
        onClick={() => onSelect(node.__path)}
        className={`flex items-center w-full text-left px-2 py-1 text-sm hover:bg-gray-800 rounded transition-colors ${
          isSelected ? 'bg-orange-900/30 text-orange-300' : 'text-gray-400'
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <FileCode className="w-4 h-4 mr-2 flex-shrink-0" />
        <span className="truncate">{name}</span>
      </button>
    );
  }

  const entries = Object.entries(node).sort(([, a], [, b]) => {
    const aIsFile = a.__isFile ? 1 : 0;
    const bIsFile = b.__isFile ? 1 : 0;
    return aIsFile - bIsFile;
  });

  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center w-full text-left px-2 py-1 text-sm text-gray-300 hover:bg-gray-800 rounded transition-colors"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {expanded ? <ChevronDown className="w-4 h-4 mr-1" /> : <ChevronRight className="w-4 h-4 mr-1" />}
        {expanded ? <FolderOpen className="w-4 h-4 mr-2 text-orange-400" /> : <Folder className="w-4 h-4 mr-2 text-orange-400" />}
        <span className="truncate">{name}</span>
      </button>
      {expanded && (
        <div>
          {entries.map(([childName, childNode]) => (
            <TreeNode
              key={childName}
              name={childName}
              node={childNode}
              onSelect={onSelect}
              selectedFile={selectedFile}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileTree({ files, onSelect, selectedFile }) {
  const tree = buildTree(files);
  const entries = Object.entries(tree).sort(([, a], [, b]) => {
    const aIsFile = a.__isFile ? 1 : 0;
    const bIsFile = b.__isFile ? 1 : 0;
    return aIsFile - bIsFile;
  });

  return (
    <div data-lenis-prevent className="py-2 overflow-y-auto overscroll-contain">
      {entries.map(([name, node]) => (
        <TreeNode
          key={name}
          name={name}
          node={node}
          onSelect={onSelect}
          selectedFile={selectedFile}
        />
      ))}
    </div>
  );
}
