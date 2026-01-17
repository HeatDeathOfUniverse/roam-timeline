import type { JournalEntry } from '../types';

interface Props {
  entries: JournalEntry[];
}

export function Timeline({ entries }: Props) {
  // 倒序排列：最近的时间在最上面
  const sortedEntries = [...entries].sort((a, b) => {
    return b.startTime.localeCompare(a.startTime);
  });

  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-lg mb-3">今日时间轴</h3>

      {sortedEntries.length === 0 ? (
        <p className="text-gray-400 text-center py-8">暂无记录</p>
      ) : (
        sortedEntries.map((entry) => (
          <div key={entry.id} className="p-3 bg-gray-700/50 rounded border-l-4 border-blue-500">
            <div className="flex justify-between text-sm text-gray-400 mb-1">
              <span>{entry.startTime} - {entry.endTime}</span>
              <span>{entry.duration}</span>
            </div>
            <p className="text-white">{entry.content}</p>
          </div>
        ))
      )}
    </div>
  );
}
