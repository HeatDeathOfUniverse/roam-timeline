import { useState, useCallback } from 'react';
import type { JournalEntry, RoamConfig } from '../types';
import { formatTimeForRoam, generatePageTitle, getYesterdayPageTitle } from '../utils/formatter';

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
      console.log('Parsing block:', str);
      if (str) {
        // Parse format: "09:08 - 09:47 (**39'**) - content" (content may include markdown images on new lines)
        const timeMatch = str.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\(\*\*(.+?)\*\*\)\s*-\s*([\s\S]*)$/);
        console.log('Regex match result:', timeMatch);
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
    console.log('Parsed entries:', entries);
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

  // Get the end time of the last entry under Timeline (today, fallback to yesterday)
  const getLastEntryEndTime = useCallback(async (): Promise<string | null> => {
    // Try today's page first
    const todayPageTitle = generatePageTitle();
    const todayEndTime = await getLastEntryEndTimeFromPage(todayPageTitle);
    if (todayEndTime) {
      return todayEndTime;
    }

    // Fallback to yesterday's page
    const yesterdayPageTitle = getYesterdayPageTitle();
    const yesterdayEndTime = await getLastEntryEndTimeFromPage(yesterdayPageTitle);
    return yesterdayEndTime;
  }, [getLastEntryEndTimeFromPage]);

  const addEntry = useCallback(async (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    setIsLoading(true);
    setError(null);
    try {
      const pageTitle = generatePageTitle();
      const formattedText = formatTimeForRoam(entry as JournalEntry);

      // Fixed UID for Timeline block - creates once, reused thereafter
      const timelineUid = 'timeline-block-main';

      // Try to create Timeline block if it doesn't exist (idempotent)
      try {
        await bffFetch('create-block', {
          location: { 'page-title': pageTitle, order: 'last' },
          block: { string: 'Timeline', uid: timelineUid },
        });
      } catch {
        // Timeline block may already exist, ignore error
      }

      // Insert the entry under Timeline block
      await bffFetch('create-block', {
        location: { 'parent-uid': timelineUid, order: 'last' },
        block: {
          string: formattedText,
          uid: `entry-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
  };
}
