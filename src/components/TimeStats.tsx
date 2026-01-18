import { useState, useEffect } from 'react';
import type { CategoryNode } from '../hooks/useTimelineStats';
import { formatDurationCompact, calculatePercentage } from '../utils/dateUtils';

interface StatsTreeNodeProps {
  node: CategoryNode;
  depth?: number;
  totalDuration: number;
}

function StatsTreeNode({ node, depth = 0, totalDuration }: StatsTreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2); // Auto-expand first 2 levels
  const hasChildren = node.children && node.children.length > 0;

  const toggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
  };

  // Calculate percentage based on own duration vs total duration
  const displayPercentage = node.totalDuration > 0 ? calculatePercentage(node.totalDuration, totalDuration) : 0;

  return (
    <div className="select-none">
      <div
        className={`
          flex items-center py-2 px-3 cursor-pointer
          hover:bg-gray-50 transition-colors
          ${depth === 0 ? 'font-semibold bg-gray-100' : ''}
        `}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={toggleExpand}
      >
        {/* Expand/collapse arrow */}
        <div className="w-4 h-4 mr-2 flex items-center justify-center text-gray-400">
          {hasChildren ? (
            <span className={`transform transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              ▶
            </span>
          ) : (
            <span className="opacity-30">●</span>
          )}
        </div>

        {/* Category name */}
        <span className="flex-1 truncate text-gray-800">
          {node.name.replace(/\[\[|\]\]/g, '')}
        </span>

        {/* Duration */}
        <span className="w-20 text-right font-mono text-sm text-gray-600 mr-4">
          {formatDurationCompact(node.totalDuration)}
        </span>

        {/* Percentage */}
        <span className="w-12 text-right text-sm text-gray-400">
          {displayPercentage}%
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="border-l border-gray-200 ml-4">
          {node.children.map((child) => (
            <StatsTreeNode
              key={child.name}
              node={child}
              depth={depth + 1}
              totalDuration={totalDuration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface TimeStatsProps {
  stats: CategoryNode[] | null;
  isLoading: boolean;
  error: string | null;
  onRangeChange: (range: 'day' | 'week' | 'month') => void;
  currentRange: 'day' | 'week' | 'month';
}

export function TimeStats({ stats, isLoading, error, onRangeChange, currentRange }: TimeStatsProps) {
  const [selectedRange, setSelectedRange] = useState<'day' | 'week' | 'month'>(currentRange);

  useEffect(() => {
    setSelectedRange(currentRange);
  }, [currentRange]);

  const handleRangeChange = (range: 'day' | 'week' | 'month') => {
    setSelectedRange(range);
    onRangeChange(range);
  };

  // Calculate total duration from all categories (including nested children)
  const calculateTotal = (nodes: CategoryNode[]): number => {
    let total = 0;
    for (const node of nodes) {
      total += node.ownDuration;
      if (node.children && node.children.length > 0) {
        total += calculateTotal(node.children);
      }
    }
    return total;
  };

  const totalDuration = stats ? calculateTotal(stats) : 0;

  if (error) {
    return (
      <div className="p-4 text-red-600 bg-red-50 rounded-lg">
        <strong>Error:</strong> {error}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8 text-center text-gray-500">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mb-2"></div>
        <p>加载中...</p>
      </div>
    );
  }

  if (!stats || stats.length === 0) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>暂无时间统计数据</p>
        <p className="text-sm mt-2">添加带分类标签的时间条目后即可查看统计</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Header with range selector */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h2 className="font-semibold text-gray-700">时间统计</h2>
        <div className="flex gap-1 bg-gray-200 rounded-lg p-1">
          {(['day', 'week', 'month'] as const).map((range) => (
            <button
              key={range}
              onClick={() => handleRangeChange(range)}
              className={`
                px-3 py-1 text-sm rounded-md transition-colors
                ${selectedRange === range
                  ? 'bg-white text-gray-800 shadow-sm font-medium'
                  : 'text-gray-600 hover:text-gray-800'}
              `}
            >
              {range === 'day' ? '今日' : range === 'week' ? '本周' : '本月'}
            </button>
          ))}
        </div>
      </div>

      {/* Total summary */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
        <span className="font-semibold text-blue-800">全部</span>
        <div className="flex items-center gap-4">
          <span className="font-mono text-lg font-semibold text-blue-700">
            {formatDurationCompact(totalDuration)}
          </span>
          <span className="text-sm text-blue-600">100%</span>
        </div>
      </div>

      {/* Tree view */}
      <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
        {stats.map((node) => (
          <StatsTreeNode
            key={node.name}
            node={node}
            totalDuration={totalDuration}
          />
        ))}
      </div>

      {/* Footer with info */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        显示 {stats.length} 个分类 · 鼠标悬停查看详情
      </div>
    </div>
  );
}
