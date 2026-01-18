import { useState, useEffect, useRef, useCallback } from 'react';
import type { JournalEntry as JournalEntryType } from '../types';
import { formatDuration } from '../utils/formatter';
import { uploadImage } from '../utils/imageUploader';
import Fuse from 'fuse.js';

interface SuggestionItem {
  id: string;
  name: string;
  type: 'tag' | 'page';
}

// Get tag name from category name (remove [[ ]] and convert to lowercase)
const getTagName = (name: string): string => {
  return name.replace(/\[\[|\]\]/g, '').toLowerCase();
};

interface Props {
  onSubmit: (entry: Omit<JournalEntryType, 'id' | 'createdAt'>) => void;
  onCreateChildNode: (content: string) => void;
  isLoading: boolean;
  initialStartTime?: string;
  currentTime?: string;
}

export function JournalEntryForm({ onSubmit, onCreateChildNode, isLoading, initialStartTime, currentTime }: Props) {
  const [content, setContent] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [, setTick] = useState(0);

  // Editor ref
  const editorRef = useRef<HTMLDivElement>(null);

  // Suggestion states
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionType, setSuggestionType] = useState<'tag' | 'page'>('tag');
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [categories, setCategories] = useState<SuggestionItem[]>([]);
  const [pages, setPages] = useState<SuggestionItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const suggestionRef = useRef<HTMLDivElement>(null);

  // Image upload states
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cloudinaryConfigured, setCloudinaryConfigured] = useState(false);

  // Fetch categories and pages on mount
  useEffect(() => {
    const fetchData = async () => {
      const saved = localStorage.getItem('roamConfig');
      const config = saved ? JSON.parse(saved) : null;
      const graphName = config?.graphName;

      if (graphName) {
        // Fetch categories
        try {
          const catResponse = await fetch('/api/roam/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ graphName }),
          });
          if (catResponse.ok) {
            const data = await catResponse.json();
            const items: SuggestionItem[] = (data.categories || []).map((c: { id: string; name: string }) => ({
              id: c.id,
              name: c.name,
              type: 'tag' as const,
            }));
            setCategories(items);
          }
        } catch (e) {
          console.error('Failed to fetch categories:', e);
        }

        // Fetch pages
        try {
          const pageResponse = await fetch('/api/roam/pages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ graphName }),
          });
          if (pageResponse.ok) {
            const data = await pageResponse.json();
            // Transform pages to SuggestionItem format
            const pageItems: SuggestionItem[] = (data.pages || []).map((p: { id: string; name: string }) => ({
              id: p.id,
              name: p.name,
              type: 'page' as const,
            }));
            setPages(pageItems);
          }
        } catch (e) {
          console.error('Failed to fetch pages:', e);
        }
      }
    };

    fetchData();

    // Check Cloudinary config
    const cloudinaryConfig = localStorage.getItem('cloudinaryConfig');
    if (cloudinaryConfig) {
      const config = JSON.parse(cloudinaryConfig);
      setCloudinaryConfigured(!!config.cloudName && !!config.preset);
    }
  }, []);

  // Set initial start time
  useEffect(() => {
    if (initialStartTime && !startTime) {
      setStartTime(initialStartTime);
    }
  }, [initialStartTime]);

  // Update end time
  useEffect(() => {
    if (currentTime) {
      setEndTime(currentTime);
    }
  }, [currentTime]);

  // Tick every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate elapsed time
  const getElapsedTime = () => {
    if (!initialStartTime || !currentTime) return null;
    const now = new Date();
    const [startH, startM] = initialStartTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(startH, startM, 0, 0);
    let diffMs = now.getTime() - startDate.getTime();
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000;
    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  // Get editor plain text
  const getEditorText = useCallback(() => {
    return editorRef.current?.innerText || '';
  }, []);

  // Handle editor input
  const handleInput = useCallback(() => {
    setContent(getEditorText());
  }, [getEditorText]);

  // Filter suggestions
  const filterSuggestions = useCallback((type: 'tag' | 'page', query: string) => {
    let items = type === 'tag' ? categories : pages;
    if (query.trim()) {
      const fuse = new Fuse(items, { keys: ['name'], threshold: 0.4 });
      items = fuse.search(query).map(r => r.item);
    }
    setSuggestions(items.slice(0, 10));
  }, [categories, pages]);

  // Handle key down for # @ triggers
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Check for # or @ triggers - must handle before character is inserted
    if (e.key === '#' || e.key === '@') {
      e.preventDefault();
      // Insert the trigger character
      document.execCommand('insertText', false, e.key);
      // Trigger suggestions with empty query to show all
      const type = e.key === '#' ? 'tag' : 'page';
      setSuggestionType(type);
      filterSuggestions(type, '');
      setShowSuggestions(true);
      setSelectedIndex(0);
      return;
    }

    if (showSuggestions) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (suggestions[selectedIndex]) {
          const item = suggestions[selectedIndex];
          insertSuggestion(item);
          return;
        }
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false);
        return;
      }

      // Filter suggestions based on continued typing
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const textBefore = range.startContainer.textContent?.slice(0, range.startOffset) || '';

        const hashMatch = textBefore.match(/#(\w*)$/);
        if (hashMatch) {
          const query = hashMatch[1];
          filterSuggestions('tag', query);
          setSelectedIndex(0);
          return;
        }

        const atMatch = textBefore.match(/@(\w*)$/);
        if (atMatch) {
          const query = atMatch[1];
          filterSuggestions('page', query);
          setSelectedIndex(0);
          return;
        }
      }
    }
  }, [showSuggestions, suggestions, selectedIndex, filterSuggestions]);

  // Insert suggestion
  const insertSuggestion = (item: SuggestionItem) => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;

    const range = selection.getRangeAt(0);
    const textNode = range.startContainer;
    const offset = range.startOffset;

    const textBefore = textNode.textContent?.slice(0, offset) || '';
    const triggerMatch = textBefore.match(/[#@]\w*$/);
    if (triggerMatch) {
      const triggerStart = offset - triggerMatch[0].length;
      const triggerEnd = offset;
      const beforeText = textNode.textContent?.slice(0, triggerStart) || '';
      const afterText = textNode.textContent?.slice(triggerEnd) || '';

      let insertText = '';
      if (suggestionType === 'tag') {
        insertText = `#${getTagName(item.name)}`;
      } else {
        insertText = `[[${item.name}]]`;
      }

      textNode.textContent = beforeText + insertText + afterText;

      // Update selection
      const newRange = document.createRange();
      newRange.setStart(textNode, triggerStart + insertText.length);
      newRange.collapse(true);
      selection.removeAllRanges();
      selection.addRange(newRange);

      // Update content
      setContent(getEditorText());
    }

    setShowSuggestions(false);
  };

  // Insert text at cursor
  const insertText = (text: string) => {
    document.execCommand('insertText', false, text);
    setContent(getEditorText());
  };

  // Format selection
  const formatText = (before: string, after: string) => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    const selectedText = range.toString();

    if (selectedText) {
      document.execCommand('insertText', false, `${before}${selectedText}${after}`);
    } else {
      document.execCommand('insertText', false, `${before}${after}`);
    }
    setContent(getEditorText());
  };

  // Image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const cloudinaryConfig = JSON.parse(localStorage.getItem('cloudinaryConfig') || '{}');
    if (!cloudinaryConfig.cloudName || !cloudinaryConfig.preset) {
      setUploadError('请先在设置中配置 Cloudinary');
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    const result = await uploadImage(file, cloudinaryConfig.cloudName, cloudinaryConfig.preset);

    if (result.success && result.url) {
      insertText(`\n![](${result.url})\n`);
    } else {
      setUploadError(result.error || '上传失败');
    }

    setIsUploading(false);
  };

  // Create child node
  const handleCreateChildNode = () => {
    const selection = window.getSelection();
    const selectedText = selection?.toString() || getEditorText();

    if (selectedText.trim()) {
      onCreateChildNode(selectedText);
      if (editorRef.current) {
        editorRef.current.innerText = '';
        setContent('');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !startTime || !endTime) return;

    const duration = formatDuration(startTime, endTime);
    onSubmit({ content, startTime, endTime, duration });
    setContent('');
    if (editorRef.current) {
      editorRef.current.innerText = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-800 rounded-lg space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">添加日记</h3>
        {getElapsedTime() && (
          <span className="text-sm text-yellow-400">已过去 {getElapsedTime()}</span>
        )}
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">开始时间</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded text-white"
            required
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-400 mb-1">结束时间</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            className="w-full p-2 bg-gray-700 rounded text-white"
            required
          />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-gray-750 border border-gray-600 rounded-t-lg flex-wrap">
        {/* Format buttons */}
        <button type="button" onClick={() => formatText('**', '**')} className="p-1.5 rounded hover:bg-gray-600 text-gray-300 font-bold" title="加粗">
          B
        </button>
        <button type="button" onClick={() => formatText('*', '*')} className="p-1.5 rounded hover:bg-gray-600 text-gray-300 italic" title="斜体">
          I
        </button>
        <button type="button" onClick={() => formatText('<u>', '</u>')} className="p-1.5 rounded hover:bg-gray-600 text-gray-300 underline" title="下划线">
          U
        </button>
        <button type="button" onClick={() => formatText('~~', '~~')} className="p-1.5 rounded hover:bg-gray-600 text-gray-300 line-through" title="删除线">
          S
        </button>
        <button type="button" onClick={() => formatText('`', '`')} className="p-1.5 rounded hover:bg-gray-600 text-gray-300 font-mono text-xs" title="行内代码">
          {'</>'}
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Image button */}
        <label className={`p-1.5 rounded hover:bg-gray-600 text-gray-300 cursor-pointer ${!cloudinaryConfigured ? 'opacity-50 cursor-not-allowed' : ''}`} title="插入图片">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={!cloudinaryConfigured || isUploading} />
        </label>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* List button - create child node */}
        <button type="button" onClick={handleCreateChildNode} className="p-1.5 rounded hover:bg-gray-600 text-gray-300" title="创建子节点">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Tag and Page trigger buttons */}
        <button
          type="button"
          onClick={() => {
            insertText('#');
            // Trigger tag suggestions with empty query to show all
            setSuggestionType('tag');
            filterSuggestions('tag', '');
            setShowSuggestions(true);
            setSelectedIndex(0);
          }}
          className="p-1.5 rounded hover:bg-gray-600 text-blue-400 font-bold"
          title="插入 # 选择标签"
        >
          #
        </button>
        <button
          type="button"
          onClick={() => {
            insertText('@');
            // Trigger page suggestions with empty query to show all
            setSuggestionType('page');
            filterSuggestions('page', '');
            setShowSuggestions(true);
            setSelectedIndex(0);
          }}
          className="p-1.5 rounded hover:bg-gray-600 text-green-400 font-bold"
          title="插入 @ 选择页面"
        >
          @
        </button>

        <div className="w-px h-6 bg-gray-600 mx-1" />

        {/* Help text */}
        <span className="text-xs text-gray-500 ml-2">
          点击 # 或 @ 按钮选择
        </span>
      </div>

      {/* Editor */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className="w-full p-3 bg-gray-700 rounded-b-lg text-white min-h-[100px] focus:outline-none focus:ring-2 focus:ring-blue-500"
          data-placeholder="输入内容...（支持 Markdown 格式）"
          suppressContentEditableWarning
        />

        {/* Suggestions popup */}
        {showSuggestions && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowSuggestions(false)} />
            <div ref={suggestionRef} className="absolute z-20 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 max-h-60 overflow-y-auto" style={{ bottom: '100%', left: 0, marginBottom: '4px' }}>
              {suggestions.length === 0 ? (
                <div className="p-3 text-sm text-gray-500 text-center">
                  未找到 {suggestionType === 'tag' ? '标签' : '页面'}
                </div>
              ) : (
                <ul>
                  {suggestions.map((item, index) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => insertSuggestion(item)}
                        className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 ${index === selectedIndex ? 'bg-gray-600' : 'hover:bg-gray-700'}`}
                      >
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.type === 'tag' ? 'bg-blue-500' : 'bg-green-500'}`} />
                        <span className="flex-1 truncate">{item.name.replace(/\[\[|\]\]/g, '')}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </div>

      {/* Upload error */}
      {uploadError && <p className="text-red-400 text-sm">{uploadError}</p>}

      <button
        type="submit"
        disabled={isLoading || !content || !startTime || !endTime}
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-2 px-4 rounded"
      >
        {isLoading ? '提交中...' : '添加到 Roam'}
      </button>
    </form>
  );
}

interface EntryItemProps {
  entry: JournalEntryType;
}

export function EntryItem({ entry }: EntryItemProps) {
  return (
    <div className="p-3 bg-gray-700/50 rounded border-l-4 border-blue-500">
      <div className="flex justify-between text-sm text-gray-400 mb-1">
        <span>{entry.startTime} - {entry.endTime}</span>
        <span>{entry.duration}</span>
      </div>
      <p className="text-white whitespace-pre-wrap">{entry.content}</p>
    </div>
  );
}
