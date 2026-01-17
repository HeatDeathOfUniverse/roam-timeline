export function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);

  let diff = (end.getTime() - start.getTime()) / 1000 / 60;
  if (diff < 0) {
    diff += 24 * 60; // 跨 midnight
  }

  const hours = Math.floor(diff / 60);
  const minutes = Math.floor(diff % 60);

  if (hours > 0) {
    return `${hours}h${minutes}'`;
  }
  return `${minutes}'`;
}

export function formatTimeForRoam(entry: { content: string; startTime: string; endTime: string; duration: string }): string {
  return `${entry.startTime} - ${entry.endTime} (**${entry.duration}**) - ${entry.content}`;
}

export function generatePageTitle(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' });
  const day = now.getDate();
  const suffix = getDaySuffix(day);
  const year = now.getFullYear();
  return `${month} ${day}${suffix}, ${year}`;
}

function getDaySuffix(n: number): string {
  if (n > 3 && n < 21) return 'th';
  const last = n % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
}
