import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Fuse from 'fuse.js';
import type { Category } from '../hooks/useRoam';

interface CategorySelectorProps {
  onSelect: (tag: string) => void;
  disabled?: boolean;
  searchQuery?: string;
}

export function CategorySelector({ onSelect, disabled, searchQuery = '' }: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const expandedBySearchRef = useRef(false);

  // Close dropdown function
  const closeDropdown = useCallback(() => {
    setIsExpanded(false);
    expandedBySearchRef.current = false;
  }, []);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const saved = localStorage.getItem('roamConfig');
        const config = saved ? JSON.parse(saved) : null;
        const graphName = config?.graphName;

        if (!graphName) {
          throw new Error('Graph name not configured');
        }

        const response = await fetch('/api/roam/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ graphName }),
        });
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setCategories(data.categories || []);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setError('无法加载分类');
        // Use fallback categories for demo
        setCategories([
          { id: '1', name: '[[工作]]', children: [] },
          { id: '2', name: '[[学习]]', children: [] },
          { id: '3', name: '[[运动]]', children: [] },
          { id: '4', name: '[[休息]]', children: [] },
          { id: '5', name: '[[社交]]', children: [] },
          { id: '6', name: '[[P/基于 roam 的计时分析工具]]', children: [] },
          { id: '7', name: '[[P/黄叔 AI 编程社群/基础课]]', children: [] },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Handle auto-expand based on search query
  useEffect(() => {
    const hasSearchQuery = searchQuery.trim().length > 0;

    if (hasSearchQuery && !isExpanded) {
      setIsExpanded(true);
      expandedBySearchRef.current = true;
    } else if (!hasSearchQuery && expandedBySearchRef.current && isExpanded) {
      closeDropdown();
    }
  }, [searchQuery, isExpanded, closeDropdown]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [closeDropdown]);

  // Setup Fuse.js for fuzzy search
  const fuse = useMemo(() => {
    return new Fuse(categories, {
      keys: [{ name: 'name', weight: 1 }],
      threshold: 0.4,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1,
      ignoreLocation: true,
      findAllMatches: true,
    });
  }, [categories]);

  // Search and filter categories
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return categories.map(cat => ({ category: cat, score: 1 }));
    }

    const results = fuse.search(searchQuery);
    return results.map(result => ({
      category: result.item,
      score: result.score ?? 1,
    }));
  }, [searchQuery, categories, fuse]);

  // Get tag name from category
  const getTagName = (name: string): string => {
    return name.replace(/\[\[|\]\]/g, '').toLowerCase();
  };

  // Highlight matching parts
  const highlightMatch = (name: string, query: string): React.ReactNode => {
    if (!query.trim()) return name;

    const escapedQuery = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = name.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <span key={index} className="bg-yellow-500/30 text-yellow-200 rounded px-0.5">
          {part}
        </span>
      ) : (
        part
      )
    );
  };

  const handleSelect = (category: Category) => {
    const tag = `#${getTagName(category.name)}`;
    onSelect(tag);
    closeDropdown();
  };

  const handleToggle = () => {
    if (isExpanded) {
      closeDropdown();
    } else {
      setIsExpanded(true);
      expandedBySearchRef.current = false;
    }
  };

  const handleBackdropClick = () => {
    closeDropdown();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toggle button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || isLoading}
        className={`flex items-center gap-1 px-3 py-1.5 rounded text-sm transition-colors ${
          disabled || isLoading
            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
        }`}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        <span>{isLoading ? '加载中...' : '分类'}</span>
        <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isExpanded && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={handleBackdropClick}
          />

          {/* Dropdown content - aligned to right */}
          <div className="absolute top-full right-0 mt-1 w-64 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-20 max-h-80 overflow-y-auto">
            {/* Search query indicator */}
            {searchQuery.trim() && (
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-700 bg-gray-800/50">
                搜索: "{searchQuery}"
                <span className="ml-2 text-gray-600">
                  ({searchResults.length} 个匹配)
                </span>
              </div>
            )}

            {error && (
              <div className="p-2 text-xs text-yellow-400 border-b border-gray-700">
                {error}
              </div>
            )}

            {searchResults.length === 0 && !isLoading ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                未找到匹配的分类
              </div>
            ) : (
              <ul className="py-1">
                {searchResults.map(({ category, score }) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(category)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        score < 0.3 ? 'bg-green-500' : score < 0.6 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} />
                      <span className="flex-1 truncate">
                        {highlightMatch(category.name, searchQuery)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {/* Footer */}
            <div className="px-3 py-2 text-xs text-gray-600 border-t border-gray-700 bg-gray-800/50">
              提示: 输入关键词实时搜索匹配分类
            </div>
          </div>
        </>
      )}
    </div>
  );
}
