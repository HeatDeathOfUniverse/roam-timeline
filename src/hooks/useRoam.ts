export interface Category {
  id: string;
  name: string;
  children: Category[];
}

import { useState, useCallback } from 'react';
import type { JournalEntry, RoamConfig } from '../types';
import { formatTimeForRoam, generatePageTitle, getYesterdayPageTitle, getTomorrowPageTitle, parseDurationToMinutes, formatDurationFromMinutes, isCrossMidnight, timeToMinutes, minutesToTime } from '../utils/formatter';

const BFF_API_BASE = '/api/roam';

export function useRoam() {
  const [config, setConfig] = useState<RoamConfig | null>(() => {
    const saved = localStorage.getItem('roamConfig');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Only keep graphName, token is stored server-side
      return { graphName: parsed.graphName };
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const saveConfig = useCallback((_apiToken: string, graphName: string) => {
    // Token is stored server-side, only graphName in localStorage
    const newConfig = { graphName };
    localStorage.setItem('roamConfig', JSON.stringify(newConfig));
    setConfig(newConfig);
  }, []);

  const clearConfig = useCallback(() => {
    localStorage.removeItem('roamConfig');
    setConfig(null);
  }, []);

  const bffFetch = useCallback(async (action: string, data: Record<string, unknown>) => {
    if (!config) throw new Error('Roam not configured');

    const response = await fetch(`${BFF_API_BASE}/${config.graphName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action,
        ...data,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`API error: ${err}`);
    }

    return response.json();
  }, [config]);

  // Parse blocks into entries (helper function)
  const parseEntries = (blocks: Array<{ ':block/string'?: string; ':block/order'?: number }>): Array<{ content: string; startTime: string; endTime: string; duration: string }> => {
    const entries: Array<{ content: string; startTime: string; endTime: string; duration: string }> = [];
    for (const block of blocks) {
      const str = block[':block/string'];
      if (str) {
        // Parse format: "09:08 - 09:47 (**39'**) - content" (content may include markdown images on new lines)
        const timeMatch = str.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\(\*\*(.+?)\*\*\)\s*-\s*([\s\S]*)$/);
        if (timeMatch) {
          entries.push({
            startTime: timeMatch[1],
            endTime: timeMatch[2],
            duration: timeMatch[3],
            content: timeMatch[4],
          });
        } else {
          // Try old format: "- 09:08 - 09:47 （39'） content"
          const oldMatch = str.match(/^-\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*[（(](.+?)[）)]\s*(.+)$/);
          if (oldMatch) {
            entries.push({
              startTime: oldMatch[1],
              endTime: oldMatch[2],
              duration: oldMatch[3],
              content: oldMatch[4],
            });
          }
        }
      }
    }
    return entries;
  };

  // Get all entries under Timeline block from a specific page
  // Uses an alternative query approach to avoid clojure.string/includes? which can fail on some Roam peers
  const getTimelineEntriesFromPage = useCallback(async (pageTitle: string): Promise<Array<{ content: string; startTime: string; endTime: string; duration: string }>> => {
    // First, find the Timeline block and get its children with full data
    const query = `[:find (pull ?child [:block/string :block/order]) :where
      [?p :node/title "${pageTitle}"]
      [?b :block/page ?p]
      [?b :block/string "Timeline"]
      [?b :block/children ?child]]`;

    try {
      const result = await bffFetch('q', { query });
      const data = result?.result;
      if (data && data.length > 0) {
        const blocks = data.map((item: unknown[]) => item[0]) as Array<{ ':block/string'?: string; ':block/order'?: number }>;
        return parseEntries(blocks);
      }
      return [];
    } catch {
      return [];
    }
  }, [bffFetch]);

  // Get all entries under Timeline block (today, fallback to yesterday)
  const getTimelineEntries = useCallback(async (): Promise<Array<{ content: string; startTime: string; endTime: string; duration: string }>> => {
    // Try today's page first
    const todayPageTitle = generatePageTitle();
    console.log('=== getTimelineEntries ===');
    console.log('Today page:', todayPageTitle);
    const todayEntries = await getTimelineEntriesFromPage(todayPageTitle);
    console.log('Today entries count:', todayEntries.length);
    if (todayEntries.length > 0) {
      console.log('Using TODAY entries');
      return todayEntries;
    }

    // Fallback to yesterday's page
    const yesterdayPageTitle = getYesterdayPageTitle();
    console.log('Yesterday page:', yesterdayPageTitle);
    const yesterdayEntries = await getTimelineEntriesFromPage(yesterdayPageTitle);
    console.log('Yesterday entries count:', yesterdayEntries.length);
    console.log('Using YESTERDAY entries');
    return yesterdayEntries;
  }, [getTimelineEntriesFromPage]);

  // Get the end time of the last entry under Timeline in a specific page
  // Uses exact string match instead of clojure.string/includes? to avoid peer issues
  const getLastEntryEndTimeFromPage = useCallback(async (pageTitle: string): Promise<string | null> => {
    const query = `[:find (pull ?child [:block/string :block/order]) :where
      [?p :node/title "${pageTitle}"]
      [?b :block/page ?p]
      [?b :block/string "Timeline"]
      [?b :block/children ?child]]`;

    try {
      const result = await bffFetch('q', { query });
      const data = result?.result;
      if (data && data.length > 0) {
        const blocks = data.map((item: unknown[]) => item[0]) as Array<{ ':block/string'?: string; ':block/order'?: number }>;
        // Find the block with highest order (last)
        let lastBlock = blocks[0];
        for (const block of blocks) {
          const blockOrder = block[':block/order'] ?? 0;
          const lastOrder = lastBlock[':block/order'] ?? 0;
          if (blockOrder > lastOrder) {
            lastBlock = block;
          }
        }

        const str = lastBlock[':block/string'];
        if (str) {
          // Match both new format "09:08 - 09:47 (**39'**)" and old format "- 09:08 - 09:47 （39'）"
          const match = str.match(/(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
          if (match && match[2]) {
            return match[2];
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [bffFetch]);

  // Get all categories from Time Categories page
  const getCategories = useCallback(async (): Promise<Category[]> => {
    // Query for all blocks under Time Categories page
    const query = `[:find (pull ?block [:block/uid :block/string]) :where
      [?page :node/title "Time Categories"]
      [?block :block/page ?page]]`;

    try {
      const result = await bffFetch('q', { query });
      const data = result?.result;
      if (data && data.length > 0) {
        const blocks = data.map((item: unknown[]) => item[0]) as Array<{ ':block/uid'?: string; ':block/string'?: string }>;
        return blocks
          .filter(b => b[':block/uid'] && b[':block/string'])
          .map(b => ({
            id: b[':block/uid']!,
            name: b[':block/string']!,
            children: []
          }));
      }
      return [];
    } catch {
      console.error('Failed to fetch categories from Roam');
      return [];
    }
  }, [bffFetch]);

  // Get the end time of the last entry under Timeline (today, fallback to yesterday)
  const getLastEntryEndTime = useCallback(async (): Promise<string | null> => {
    // Try today's page first
    const todayPageTitle = generatePageTitle();
    console.log('=== getLastEntryEndTime ===');
    console.log('Today page:', todayPageTitle);
    const todayEndTime = await getLastEntryEndTimeFromPage(todayPageTitle);
    console.log('Today end time:', todayEndTime);
    if (todayEndTime) {
      console.log('Using TODAY end time');
      return todayEndTime;
    }

    // Fallback to yesterday's page
    const yesterdayPageTitle = getYesterdayPageTitle();
    console.log('Yesterday page:', yesterdayPageTitle);
    const yesterdayEndTime = await getLastEntryEndTimeFromPage(yesterdayPageTitle);
    console.log('Yesterday end time:', yesterdayEndTime);
    console.log('Using YESTERDAY end time');
    return yesterdayEndTime;
  }, [getLastEntryEndTimeFromPage]);

// 拆分跨天记录为多条记录
interface SplitEntry {
  startTime: string;
  endTime: string;
  duration: string;
  content: string;
  pageDateOffset: number; // 0 = 今天, 1 = 明天
}

function splitCrossDayEntry(
  startTime: string,
  endTime: string,
  duration: string,
  content: string
): SplitEntry[] {
  // 不跨天，直接返回一条记录
  if (!isCrossMidnight(startTime, endTime)) {
    return [{
      startTime,
      endTime,
      duration,
      content,
      pageDateOffset: 0,
    }];
  }

  // 跨天，拆分为两条记录
  const totalMinutes = parseDurationToMinutes(duration);

  // 计算今天部分的分钟数 (从 startTime 到 23:59)
  const startMinutes = timeToMinutes(startTime);
  const todayMinutes = (24 * 60 - 1) - startMinutes; // 到 23:59

  // 计算明天部分的分钟数 (从 00:00 到 endTime)
  const endMinutes = timeToMinutes(endTime);
  const tomorrowMinutes = endMinutes;

  const todayDuration = formatDurationFromMinutes(todayMinutes);
  const tomorrowDuration = formatDurationFromMinutes(tomorrowMinutes);

  return [
    {
      startTime,
      endTime: '23:59',
      duration: todayDuration,
      content,
      pageDateOffset: 0, // 今天
    },
    {
      startTime: '00:00',
      endTime,
      duration: tomorrowDuration,
      content,
      pageDateOffset: 1, // 明天
    },
  ];
}

// 获取指定偏移量的页面标题
function getPageTitleWithOffset(offset: number): string {
  if (offset === 0) {
    return generatePageTitle();
  } else if (offset === 1) {
    return getTomorrowPageTitle();
  } else {
    // 通用情况：计算偏移日期
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const month = date.toLocaleString('en-US', { month: 'long' });
    const day = date.getDate();
    const suffix = getDaySuffix(day);
    const year = date.getFullYear();
    return `${month} ${day}${suffix}, ${year}`;
  }
}

// 获取日期后缀
function getDaySuffix(n: number): string {
  if (n > 3 && n < 21) return 'th';
  const last = n % 10;
  if (last === 1) return 'st';
  if (last === 2) return 'nd';
  if (last === 3) return 'rd';
  return 'th';
}

  const addEntry = useCallback(async (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    setIsLoading(true);
    setError(null);
    try {
      // 拆分跨天记录
      const splitEntries = splitCrossDayEntry(
        entry.startTime,
        entry.endTime,
        entry.duration,
        entry.content
      );

      // 对每条拆分后的记录执行插入
      for (const splitEntry of splitEntries) {
        const pageTitle = getPageTitleWithOffset(splitEntry.pageDateOffset);
        const formattedText = formatTimeForRoam({
          content: splitEntry.content,
          startTime: splitEntry.startTime,
          endTime: splitEntry.endTime,
          duration: splitEntry.duration,
        });

        // 查询页面上是否已存在 Timeline 块
        const findQuery = `[:find (pull ?b [:block/uid]) :where
          [?p :node/title "${pageTitle}"]
          [?b :block/page ?p]
          [?b :block/string "Timeline"]]`;

        const findResult = await bffFetch('q', { query: findQuery });
        const existingTimeline = findResult?.result?.[0]?.[0];

        let timelineUid: string;

        if (existingTimeline) {
          // 使用已存在的 Timeline 块的 UID
          timelineUid = existingTimeline[':block/uid'];
        } else {
          // 创建新的 Timeline 块
          // 计算实际的日期
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + splitEntry.pageDateOffset);
          const today = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;
          timelineUid = `timeline-${today}`;
          await bffFetch('create-block', {
            location: { 'page-title': pageTitle, order: 'last' },
            block: { string: 'Timeline', uid: timelineUid },
          });
        }

        // 插入条目
        await bffFetch('create-block', {
          location: { 'parent-uid': timelineUid, order: 'last' },
          block: {
            string: formattedText,
            uid: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          },
        });
      }

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [bffFetch]);

  const formatTodayPage = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await bffFetch('formatTodayPage', {});
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [bffFetch]);

  // Create a child node under the Timeline block
  const createChildNode = useCallback(async (content: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // 使用本地时区获取今天日期
      const localDate = new Date();
      const today = `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}`;
      const timelineUid = `timeline-${today}`;

      await bffFetch('create-block', {
        location: { 'parent-uid': timelineUid, order: 'last' },
        block: {
          string: content,
          uid: `child-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        },
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [bffFetch]);

  return {
    config,
    isConfigured: !!config,
    isLoading,
    error,
    saveConfig,
    clearConfig,
    addEntry,
    formatTodayPage,
    getLastEntryEndTime,
    getTimelineEntries,
    getCategories,
    createChildNode,
  };
}
