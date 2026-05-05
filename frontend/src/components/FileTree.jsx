import { useState, useRef, useEffect } from 'react';

const EXT_TO_LANG = {
  js:'javascript', ts:'typescript', py:'python', java:'java',
  cpp:'cpp', cs:'csharp', go:'go', rs:'rust', php:'php',
  rb:'ruby', html:'html', css:'css', sql:'sql',
};
const FILE_ICONS = {
  javascript:'📜', typescript:'📘', python:'🐍', java:'☕',
  cpp:'⚙️', csharp:'🔷', go:'🐹', rust:'🦀', php:'🐘',
  ruby:'💎', html:'🌐', css:'🎨', sql:'🗄️',
};
const getFileIcon = (name = '') => FILE_ICONS[EXT_TO_LANG[name.split('.').pop()?.toLowerCase()]] || '📄';

/* ── Build flat files array into a tree ─────────────────── */
const buildTree = (files) => {
  const root = { children:{}, files:[], folderPath:'', folderFile:null };
  files.forEach(file => {
    const parts = file.path.replace(/^\//, '').split('/');
    if (file.isFolder) {
      let node = root;
      parts.forEach((part, i) => {
        if (!node.children[part])
          node.children[part] = { children:{}, files:[], folderPath:'/'+parts.slice(0,i+1).join('/'), folderFile:null };
        node = node.children[part];
      });
      node.folderFile = file;
    } else {
      const fileName = parts[parts.length - 1];
      const dirParts = parts.slice(0, -1);
      let node = root;
      dirParts.forEach((part, i) => {
        if (!node.children[part])
          node.children[part] = { children:{}, files:[], folderPath:'/'+dirParts.slice(0,i+1).join('/'), folderFile:null };
        node = node.children[part];
      });
      node.files.push({ ...file, displayName: fileName });
    }
  });
  return root;
};

/* ── Inline rename/create input ─────────────────────────── */
function InlineInput({ defaultValue='', placeholder, onConfirm, onCancel }) {
  const ref = useRef(null);
  // track whether a confirm is in-flight so blur doesn't cancel it
  const confirming = useRef(false);

  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const commit = () => {
    const v = ref.current?.value.trim();
    if (v) { confirming.current = true; onConfirm(v); }
    else onCancel();
  };

  return (
    <input
      ref={ref}
      className="ft-inline-input"
      defaultValue={defaultValue}
      placeholder={placeholder}
      onKeyDown={e => {
        e.stopPropagation();
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') onCancel();
      }}
      onBlur={() => { if (!confirming.current) onCancel(); }}
      onClick={e => e.stopPropagation()}
    />
  );
}

/* ── Hover action buttons ────────────────────────────────── */
function RowActions({ isFolder, onNewFile, onNewFolder, onRename, onDelete }) {
  return (
    <span className="ft-row-actions" onClick={e => e.stopPropagation()}>
      {isFolder && <>
        <button className="ft-act-btn" title="New file here"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onNewFile(); }}>📄</button>
        <button className="ft-act-btn" title="New folder here"
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onNewFolder(); }}>📁</button>
      </>}
      <button className="ft-act-btn" title="Rename"
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onRename(); }}>✏️</button>
      <button className="ft-act-btn ft-act-del" title="Delete"
        onMouseDown={e => { e.preventDefault(); e.stopPropagation(); onDelete(); }}>🗑</button>
    </span>
  );
}

/* ── Folder node ─────────────────────────────────────────── */
function TreeNode({ node, depth, activeFileId, onFileClick, onCreateFile, onCreateFolder, onRenameFolder, onDelete, canEdit }) {
  const [open, setOpen]       = useState(true);
  const [creating, setCreating] = useState(null); // 'file' | 'folder'
  const [renaming, setRenaming] = useState(false);
  const [hovered, setHovered]  = useState(false);

  const folderName = node.folderPath ? node.folderPath.split('/').pop() : '';

  /* Build the correct child path inside this folder */
  const childPath = (name) =>
    node.folderPath ? `${node.folderPath}/${name}` : `/${name}`;

  const handleCreate = (inputName, type) => {
    setCreating(null);
    const path = childPath(inputName);
    type === 'file' ? onCreateFile(inputName, path) : onCreateFolder(inputName, path);
  };

  const handleRename = (newName) => {
    setRenaming(false);
    if (!newName || newName === folderName) return;
    onRenameFolder(node, newName);
  };

  return (
    <div>
      {/* Folder row — only for non-root */}
      {depth > 0 && (
        <div
          className="ft-folder-row"
          style={{ paddingLeft: `${depth * 14}px` }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          <span className="ft-chevron" onClick={() => setOpen(o => !o)}>
            {open ? '▾' : '▸'}
          </span>
          <span className="ft-folder-icon" onClick={() => setOpen(o => !o)}>📁</span>

          {renaming ? (
            <InlineInput
              defaultValue={folderName}
              onConfirm={handleRename}
              onCancel={() => setRenaming(false)}
            />
          ) : (
            <span className="ft-name" onClick={() => setOpen(o => !o)}>{folderName}</span>
          )}

          {canEdit && hovered && !renaming && (
            <RowActions
              isFolder
              onNewFile={() => { setCreating('file'); setOpen(true); }}
              onNewFolder={() => { setCreating('folder'); setOpen(true); }}
              onRename={() => setRenaming(true)}
              onDelete={() => onDelete(node.folderFile?.id, node.folderPath, true)}
            />
          )}
        </div>
      )}

      {/* Children */}
      {(open || depth === 0) && (
        <div>
          {/* Inline create input */}
          {creating && (
            <div style={{ paddingLeft: `${(depth + 1) * 14 + 4}px`, padding: `3px 8px 3px ${(depth + 1) * 14 + 4}px` }}>
              <InlineInput
                placeholder={creating === 'file' ? 'filename.js' : 'foldername'}
                onConfirm={v => handleCreate(v, creating)}
                onCancel={() => setCreating(null)}
              />
            </div>
          )}

          {/* Sub-folders */}
          {Object.values(node.children).map(childNode => (
            <TreeNode
              key={childNode.folderPath}
              node={childNode}
              depth={depth + 1}
              activeFileId={activeFileId}
              onFileClick={onFileClick}
              onCreateFile={onCreateFile}
              onCreateFolder={onCreateFolder}
              onRenameFolder={onRenameFolder}
              onDelete={onDelete}
              canEdit={canEdit}
            />
          ))}

          {/* Files */}
          {node.files.map(file => (
            <FileRow
              key={file.id}
              file={file}
              depth={depth + 1}
              active={activeFileId === file.id}
              onFileClick={onFileClick}
              onDelete={onDelete}
              onRename={(id, oldName, newName, oldPath) => {
                const dir = oldPath.substring(0, oldPath.lastIndexOf('/'));
                const newPath = dir ? `${dir}/${newName}` : `/${newName}`;
                onCreateFile.__renameFile(id, newName, newPath);
              }}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── File row ────────────────────────────────────────────── */
function FileRow({ file, depth, active, onFileClick, onRename, onDelete, canEdit }) {
  const [renaming, setRenaming] = useState(false);
  const [hovered, setHovered]  = useState(false);

  return (
    <div
      className={`ft-file-row${active ? ' active' : ''}`}
      style={{ paddingLeft: `${depth * 14}px` }}
      onClick={() => !renaming && onFileClick(file)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="ft-file-icon">{getFileIcon(file.displayName)}</span>

      {renaming ? (
        <InlineInput
          defaultValue={file.displayName}
          onConfirm={v => { setRenaming(false); onRename(file.id, file.displayName, v, file.path); }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <span className="ft-name">{file.displayName}</span>
      )}

      {canEdit && hovered && !renaming && (
        <RowActions
          isFolder={false}
          onRename={() => setRenaming(true)}
          onDelete={() => onDelete(file.id, file.path, false)}
        />
      )}
    </div>
  );
}

/* ── Public component ────────────────────────────────────── */
export default function FileTree({
  files, activeFileId,
  onFileClick, onCreateFile, onCreateFolder,
  onRenameFile, onRenameFolder,
  onDelete, canEdit,
}) {
  const [rootCreating, setRootCreating] = useState(null);
  const tree = buildTree(files);

  // Attach renameFile as a hidden property so FileRow can call it
  // without threading an extra prop through TreeNode
  onCreateFile.__renameFile = onRenameFile;

  return (
    <div className="file-tree">
      {canEdit && (
        <div className="ft-toolbar">
          <button className="ft-tool-btn" onClick={() => setRootCreating('file')}>📄 New File</button>
          <button className="ft-tool-btn" onClick={() => setRootCreating('folder')}>📁 New Folder</button>
        </div>
      )}

      {rootCreating && (
        <div style={{ padding: '3px 8px' }}>
          <InlineInput
            placeholder={rootCreating === 'file' ? 'filename.js' : 'foldername'}
            onConfirm={v => {
              rootCreating === 'file' ? onCreateFile(v, `/${v}`) : onCreateFolder(v, `/${v}`);
              setRootCreating(null);
            }}
            onCancel={() => setRootCreating(null)}
          />
        </div>
      )}

      {files.length === 0 && !rootCreating && (
        <div className="ft-empty">{canEdit ? 'No files yet. Click New File to start.' : 'No files yet'}</div>
      )}

      <TreeNode
        node={{ ...tree, folderPath: '' }}
        depth={0}
        activeFileId={activeFileId}
        onFileClick={onFileClick}
        onCreateFile={onCreateFile}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDelete={onDelete}
        canEdit={canEdit}
      />
    </div>
  );
}
