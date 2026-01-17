import { useState, useEffect } from 'react';
import type { Category } from '../hooks/useRoam';

interface CategorySelectorProps {
  onSelect: (tag: string) => void;
  disabled?: boolean;
}

export function CategorySelector({ onSelect, disabled }: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/roam/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!response.ok) throw new Error('Failed to fetch categories');
        const data = await response.json();
        setCategories(data.categories || []);
      } catch (err) {
        console.error('Failed to fetch categories:', err);
        setError('无法加载分类');
        // Use fallback categories for demo
        setCategories([
          { id: '1', name: '工作', children: [] },
          { id: '2', name: '学习', children: [] },
          { id: '3', name: '运动', children: [] },
          { id: '4', name: '休息', children: [] },
          { id: '5', name: '社交', children: [] },
        ]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCategories();
  }, []);

  // Filter categories based on input (if we add search later)
  const filteredCategories = categories;

  const handleSelect = (category: Category) => {
    // Convert to #tag format (use lowercase for tag)
    const tag = `#${category.name.toLowerCase()}`;
    onSelect(tag);
    setIsExpanded(false);
  };

  return (
    <div className="relative">
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
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
            onClick={() => setIsExpanded(false)}
          />

          {/* Dropdown content */}
          <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 rounded-lg shadow-xl border border-gray-700 z-20 max-h-64 overflow-y-auto">
            {error && (
              <div className="p-2 text-xs text-yellow-400 border-b border-gray-700">
                {error}
              </div>
            )}

            {filteredCategories.length === 0 && !isLoading ? (
              <div className="p-3 text-sm text-gray-500 text-center">
                未找到分类
                <div className="text-xs mt-1">
                  请在 Roam 中创建 "Time Categories" 页面
                </div>
              </div>
            ) : (
              <ul className="py-1">
                {filteredCategories.map((category) => (
                  <li key={category.id}>
                    <button
                      type="button"
                      onClick={() => handleSelect(category)}
                      className="w-full px-3 py-2 text-left text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors flex items-center gap-2"
                    >
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      {category.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
