import { useState, useEffect } from 'react';
import { TimeStats } from './TimeStats';
import { useTimelineStats } from '../hooks/useTimelineStats';

interface StatsTabProps {
  initialRange?: 'day' | 'week' | 'month';
}

export function StatsTab({ initialRange = 'week' }: StatsTabProps) {
  const { stats, isLoading, error, fetchStats, refreshStats } = useTimelineStats();
  const [currentRange, setCurrentRange] = useState<'day' | 'week' | 'month'>(initialRange);

  // Load stats on mount and when range changes
  useEffect(() => {
    fetchStats(currentRange);
  }, [currentRange, fetchStats]);

  const handleRangeChange = (range: 'day' | 'week' | 'month') => {
    setCurrentRange(range);
  };

  return (
    <div className="space-y-4">
      {/* Info card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-semibold text-blue-800 mb-2">时间统计</h3>
        <p className="text-sm text-blue-700">
          按 Time Categories 分类统计你的时间花费。树状视图展示每个分类及其子分类的总时间。
        </p>
      </div>

      {/* Refresh button */}
      <div className="flex justify-end">
        <button
          onClick={refreshStats}
          disabled={isLoading}
          className={`
            px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg
            hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          {isLoading ? '刷新中...' : '刷新数据'}
        </button>
      </div>

      {/* Stats tree view */}
      <TimeStats
        stats={stats}
        isLoading={isLoading}
        error={error}
        onRangeChange={handleRangeChange}
        currentRange={currentRange}
      />

      {/* Tips */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
        <h4 className="font-medium text-gray-700 mb-2">提示</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>点击分类名称可展开/折叠子分类</li>
          <li>每个分类显示该分类及所有子分类的总时间</li>
          <li>百分比基于该节点的总时间占"全部"的占比</li>
        </ul>
      </div>
    </div>
  );
}
