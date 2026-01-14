import { useState } from 'react';
import { useRoam } from '../hooks/useRoam';

export function FormatButton() {
  const { formatTodayPage, isLoading } = useRoam();
  const [message, setMessage] = useState<string | null>(null);

  const handleClick = async () => {
    const success = await formatTodayPage();
    setMessage(success ? '格式化完成!' : '格式化失败');
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium"
    >
      {isLoading ? '格式化中...' : '格式化今天的时间轴'}
      {message && <span className="ml-2">{message}</span>}
    </button>
  );
}
