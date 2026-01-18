import { useState, useCallback } from 'react';

export interface CategoryNode {
  name: string;
  ownDuration: number;
  totalDuration: number;
  percentage: number;
  children: CategoryNode[];
}

interface TimelineStatsResponse {
  stats: CategoryNode[];
}

interface UseTimelineStatsReturn {
  stats: CategoryNode[] | null;
  isLoading: boolean;
  error: string | null;
  fetchStats: (range: 'day' | 'week' | 'month') => Promise<void>;
  refreshStats: () => Promise<void>;
}

const BFF_API_BASE = '/api/roam';

export function useTimelineStats(): UseTimelineStatsReturn {
  const [stats, setStats] = useState<CategoryNode[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async (range: 'day' | 'week' | 'month') => {
    setIsLoading(true);
    setError(null);

    try {
      // Get graph name from localStorage
      const savedConfig = localStorage.getItem('roamConfig');
      if (!savedConfig) {
        throw new Error('Roam not configured');
      }

      const { graphName } = JSON.parse(savedConfig);

      // Calculate date range
      const today = new Date();
      let startDate: Date;
      const endDate = new Date(today);

      switch (range) {
        case 'day':
          startDate = new Date(today);
          break;
        case 'week':
          startDate = new Date(today);
          const dayOfWeek = startDate.getDay();
          const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
          startDate.setDate(diff);
          break;
        case 'month':
          startDate = new Date(today.getFullYear(), today.getMonth(), 1);
          break;
        default:
          startDate = new Date(today);
      }

      // Format dates for Roam
      const formatDate = (d: Date) => {
        const month = d.toLocaleString('en-US', { month: 'long' });
        const day = d.getDate();
        const year = d.getFullYear();
        let suffix = 'th';
        if (day % 10 === 1 && day % 100 !== 11) suffix = 'st';
        else if (day % 10 === 2 && day % 100 !== 12) suffix = 'nd';
        else if (day % 10 === 3 && day % 100 !== 13) suffix = 'rd';
        return `${month} ${day}${suffix}, ${year}`;
      };

      const response = await fetch(`${BFF_API_BASE}/timeline-stats`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          graphName,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`API error: ${err}`);
      }

      const data: TimelineStatsResponse = await response.json();

      // Calculate total duration and percentages
      const calculatePercentages = (nodes: CategoryNode[]): number => {
        let total = 0;
        for (const node of nodes) {
          total += node.ownDuration;
          if (node.children.length > 0) {
            total += calculatePercentages(node.children);
          }
        }
        return total;
      };

      const totalDuration = calculatePercentages(data.stats);

      const addPercentages = (nodes: CategoryNode[]) => {
        for (const node of nodes) {
          // Calculate percentage based on totalDuration (own + direct children)
          node.percentage = totalDuration > 0 ? Math.round((node.totalDuration / totalDuration) * 100) : 0;
          if (node.children.length > 0) {
            addPercentages(node.children);
          }
        }
      };

      addPercentages(data.stats);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    // Default to week view on refresh
    await fetchStats('week');
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    fetchStats,
    refreshStats,
  };
}
