// Date utility functions for Roam timeline stats

/**
 * Format date to Roam's daily page format: "January 18th, 2026"
 */
export function formatDateForRoam(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();

  // Add ordinal suffix (1st, 2nd, 3rd, 4th, etc.)
  let suffix = 'th';
  if (day % 10 === 1 && day % 100 !== 11) suffix = 'st';
  else if (day % 10 === 2 && day % 100 !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day % 100 !== 13) suffix = 'rd';

  return `${month} ${day}${suffix}, ${year}`;
}

/**
 * Get date range for different time periods
 */
export function getDateRange(range: 'day' | 'week' | 'month'): { startDate: string; endDate: string } {
  const today = new Date();
  const endDate = new Date(today);

  let startDate: Date;

  switch (range) {
    case 'day':
      startDate = new Date(today);
      break;
    case 'week':
      // Start from Monday of current week
      startDate = new Date(today);
      const dayOfWeek = startDate.getDay();
      const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
      startDate.setDate(diff);
      break;
    case 'month':
      // Start from 1st of current month
      startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    default:
      startDate = new Date(today);
  }

  return {
    startDate: formatDateForRoam(startDate),
    endDate: formatDateForRoam(endDate)
  };
}

/**
 * Format minutes to human readable duration string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    if (mins > 0) {
      return `${hours}h${mins}m`;
    }
    return `${hours}h`;
  }
  return `${mins}m`;
}

/**
 * Format minutes to compact display format (e.g., "8h00m")
 */
export function formatDurationCompact(minutes: number): string {
  if (minutes < 0) return '0m';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 0) {
    return `${hours}h${mins.toString().padStart(2, '0')}m`;
  }
  return `${mins}m`;
}

/**
 * Calculate percentage of total
 */
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}
