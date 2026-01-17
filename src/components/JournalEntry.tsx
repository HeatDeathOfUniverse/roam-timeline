import { useState, useEffect } from 'react';
import type { JournalEntry as JournalEntryType } from '../types';
import { formatDuration } from '../utils/formatter';

interface Props {
  onSubmit: (entry: Omit<JournalEntryType, 'id' | 'createdAt'>) => void;
  isLoading: boolean;
  initialStartTime?: string;
  currentTime?: string;
}

export function JournalEntryForm({ onSubmit, isLoading, initialStartTime, currentTime }: Props) {
  const [content, setContent] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  // Set initial start time when it becomes available
  useEffect(() => {
    if (initialStartTime && !startTime) {
      setStartTime(initialStartTime);
    }
  }, [initialStartTime]);

  // Update end time when currentTime changes (for live ticking)
  useEffect(() => {
    if (currentTime) {
      setEndTime(currentTime);
    }
  }, [currentTime]);

  // Calculate time elapsed since last entry (in HH:MM:SS format)
  const getElapsedTime = () => {
    if (!initialStartTime || !currentTime) return null;

    const now = new Date();
    const [startH, startM] = initialStartTime.split(':').map(Number);
    const startDate = new Date();
    startDate.setHours(startH, startM, 0, 0);

    let diffMs = now.getTime() - startDate.getTime();
    if (diffMs < 0) diffMs += 24 * 60 * 60 * 1000; // handle midnight

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content || !startTime || !endTime) return;

    const duration = formatDuration(startTime, endTime);
    onSubmit({ content, startTime, endTime, duration });
    setContent('');
    // Keep startTime and endTime for continuous entry
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 bg-gray-800 rounded-lg space-y-3">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-lg">添加日记</h3>
        {getElapsedTime() && (
          <span className="text-sm text-yellow-400">
            已过去 {getElapsedTime()}
          </span>
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

      <div>
        <label className="block text-xs text-gray-400 mb-1">内容</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="做了什么..."
          className="w-full p-2 bg-gray-700 rounded text-white h-20 resize-none"
          required
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
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
      <p className="text-white">{entry.content}</p>
    </div>
  );
}
