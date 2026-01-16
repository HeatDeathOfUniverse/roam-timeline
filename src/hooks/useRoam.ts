import { useState, useCallback } from 'react';
import type { JournalEntry, RoamConfig } from '../types';
import { formatTimeForRoam, generatePageTitle } from '../utils/formatter';

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

  // Query to find Timeline block UID
  const findTimelineUid = useCallback(async (): Promise<string | null> => {
    const query = `[:find ?uid ?str :where [?b :block/uid ?uid] [?b :block/string ?str] [(clojure.string/includes? ?str "## Timeline")]]`;
    try {
      const result = await bffFetch('q', { query });
      if (result && result.length > 0) {
        // Return the first matching UID
        return result[0][0];
      }
      return null;
    } catch {
      return null;
    }
  }, [bffFetch]);

  // Create a block and return its UID
  const createBlockWithUid = useCallback(async (pageTitle: string, blockString: string) => {
    const uid = `timeline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await bffFetch('create-block', {
      location: { 'page-title': pageTitle, order: 'last' },
      block: { string: blockString, uid },
    });
    return uid;
  }, [bffFetch]);

  const addEntry = useCallback(async (entry: Omit<JournalEntry, 'id' | 'createdAt'>) => {
    setIsLoading(true);
    setError(null);
    try {
      const pageTitle = generatePageTitle();
      const formattedText = formatTimeForRoam(entry as JournalEntry);

      // Try to find Timeline block on today's page
      let timelineUid = await findTimelineUid();

      // If not found, create "## Timeline" block on today's page
      if (!timelineUid) {
        timelineUid = await createBlockWithUid(pageTitle, '## Timeline');
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
  }, [bffFetch, findTimelineUid, createBlockWithUid]);

  // Get the end time of the last entry under Timeline
  const getLastEntryEndTime = useCallback(async (): Promise<string | null> => {
    const timelineUid = await findTimelineUid();
    if (!timelineUid) return null;

    // Query for child blocks under Timeline
    const query = `[:find (pull ?child [:block/string :block/uid :block/order]) :where [?b :block/uid "${timelineUid}"] [?b :block/children ?child]]`;

    try {
      const result = await bffFetch('q', { query });
      if (result && result.length > 0 && result[0] && result[0][0]) {
        const blocks = result[0] as Array<{ ':block/string': string }>;
        // Parse the last block's string to extract end time
        for (let i = blocks.length - 1; i >= 0; i--) {
          const str = blocks[i][':block/string'];
          // Match format: "- startTime - endTime （duration） content"
          const match = str.match(/-\s*(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})/);
          if (match && match[2]) {
            return match[2];
          }
        }
      }
      return null;
    } catch {
      return null;
    }
  }, [bffFetch, findTimelineUid]);

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
  };
}
