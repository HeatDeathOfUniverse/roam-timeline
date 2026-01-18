import type { JournalEntry } from '../types';

interface Props {
  entries: JournalEntry[];
}

// 将时间字符串转换为分钟数
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// 计算记录的有效时间（用于排序）
// 跨天记录：endTime < startTime 时，给 endTime 加上 24h
function getEffectiveTime(startTime: string, endTime: string): number {
  const startMin = timeToMinutes(startTime);
  const endMin = timeToMinutes(endTime);

  // 如果 endTime < startTime（跨天），给 endTime 加上 24h
  // 这样 00:00 (跨天) 的权重是 1440，代表"明天的凌晨"
  if (endMin < startMin) {
    return endMin + 24 * 60;
  }

  return endMin;
}

export function Timeline({ entries }: Props) {
  // 倒序排列：结束时间越晚越靠前
  const sortedEntries = [...entries].sort((a, b) => {
    const aTime = getEffectiveTime(a.startTime, a.endTime);
    const bTime = getEffectiveTime(b.startTime, b.endTime);
    return bTime - aTime;
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
