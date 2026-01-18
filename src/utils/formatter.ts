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

// 将 "34'" 或 "1h30'" 格式解析为分钟数
export function parseDurationToMinutes(duration: string): number {
  // 移除末尾的单引号和空格
  const cleaned = duration.trim().replace(/'$/, '');

  // 匹配 "1h30" 或 "30" 格式
  const hourMatch = cleaned.match(/^(\d+)h(\d+)$/);
  if (hourMatch) {
    const hours = parseInt(hourMatch[1], 10);
    const minutes = parseInt(hourMatch[2], 10);
    return hours * 60 + minutes;
  }

  // 纯数字格式
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

// 将分钟数格式化为 "34'" 或 "1h30'" 格式
export function formatDurationFromMinutes(minutes: number): string {
  if (minutes < 0) return "0'";

  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);

  if (hours > 0) {
    return `${hours}h${mins}'`;
  }
  return `${mins}'`;
}

// 检测是否跨天（结束时间小于开始时间）
export function isCrossMidnight(startTime: string, endTime: string): boolean {
  return endTime < startTime;
}

// 将时间字符串 "HH:MM" 转换为从当天0点开始的分钟数
export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// 将分钟数转换为时间字符串 "HH:MM"
export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// 获取明天的页面标题
export function getTomorrowPageTitle(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const month = tomorrow.toLocaleString('en-US', { month: 'long' });
  const day = tomorrow.getDate();
  const suffix = getDaySuffix(day);
  const year = tomorrow.getFullYear();
  return `${month} ${day}${suffix}, ${year}`;
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

export function getYesterdayPageTitle(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const month = yesterday.toLocaleString('en-US', { month: 'long' });
  const day = yesterday.getDate();
  const suffix = getDaySuffix(day);
  const year = yesterday.getFullYear();
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
