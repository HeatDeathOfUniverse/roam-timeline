import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CategoryNode {
  id: string;
  name: string;
  children: CategoryNode[];
}

interface StatsNode {
  name: string;
  ownDuration: number;
  totalDuration: number;
  percentage: number;
  children: StatsNode[];
}

interface TimelineEntry {
  content: string;
  duration: number;
  categories: string[];
}

const ROAM_API_BASE = 'https://api.roamresearch.com/api/graph';

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  // CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Max-Age', '86400');

  if (request.method === 'OPTIONS') {
    return response.status(204).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed' });
  }

  const apiToken = process.env.ROAM_API_TOKEN;

  if (!apiToken) {
    console.error('ROAM_API_TOKEN not configured');
    return response.status(500).json({ error: 'Server configuration error: ROAM_API_TOKEN missing' });
  }

  const { graphName, startDate, endDate } = request.body as {
    graphName?: string;
    startDate?: string;
    endDate?: string;
  };

  if (!graphName) {
    return response.status(400).json({ error: 'Graph name is required' });
  }

  try {
    // Step 1: Get categories tree
    const categoriesQuery = `[:find (pull ?block [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order]}]}]) :where
      [?page :node/title "Time Categories"]
      [?block :block/page ?page]]`;

    const categoriesResult = await fetchRoam(graphName, apiToken, categoriesQuery);
    const categories = parseCategories(categoriesResult);

    // Step 2: Get all timeline entries for the date range
    const entries = await getTimelineEntries(graphName, apiToken, startDate, endDate);

    // Step 3: Build a map of all category paths
    const categoryPaths = buildCategoryPathMap(categories);

    // Step 4: For each entry, find matching categories and add duration
    const categoryDurations: Record<string, number> = {};

    for (const entry of entries) {
      for (const catPath of entry.categories) {
        // Add duration to this category and all its parents
        let currentPath = catPath;
        while (currentPath) {
          categoryDurations[currentPath] = (categoryDurations[currentPath] || 0) + entry.duration;
          // Move to parent
          const lastSlash = currentPath.lastIndexOf('/');
          currentPath = lastSlash > 0 ? currentPath.substring(0, lastSlash) : '';
        }
      }
    }

    // Step 5: Build stats tree with durations
    const statsTree = buildStatsTreeWithDurations(categories, categoryDurations);

    return response.status(200).json({ stats: statsTree });
  } catch (error) {
    console.error('Failed to fetch timeline stats:', error);
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Get timeline entries from date range
async function getTimelineEntries(
  graphName: string,
  apiToken: string,
  startDate?: string,
  endDate?: string
): Promise<TimelineEntry[]> {
  // Use month prefix for filtering
  const monthPrefix = startDate ? startDate.split(' ')[0] : 'January';

  // Query all Timeline entries for pages in the month
  // This gets all blocks that are children of a Timeline block
  const query = `[:find (pull ?entry [:block/string :block/order {:block/page [:node/title]}]) :where
    [?page :node/title ?title]
    [(clojure.string/starts-with? ?title "${monthPrefix}")]
    [?timeline :block/page ?page]
    [?timeline :block/string "Timeline"]
    [?timeline :block/children ?entry]]`;

  const result = await fetchRoam(graphName, apiToken, query);
  const entries: TimelineEntry[] = [];

  const timelineEntries = ((result.result as Array<[{':block/string': string; ':block/page': {':node/title': string}}]>) || []);

  for (const entryItem of timelineEntries) {
    const entryData = entryItem[0];
    if (!entryData) continue;

    const content = entryData[':block/string'];
    if (!content) continue;

    // Parse timeline format
    const timeMatch = content.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\(\*\*(.+?)\*\*\)\s*-\s*([\s\S]*)$/);
    if (timeMatch) {
      const duration = parseDuration(timeMatch[3]);
      const entryContent = timeMatch[4];

      // Extract category tags from content
      const categories = extractCategories(entryContent);

      entries.push({
        content: entryContent,
        duration,
        categories
      });
    }
  }

  return entries;
}

// Extract category tags from content
function extractCategories(content: string): string[] {
  const categories: string[] = [];

  // Match #[[Category Name]] or #CategoryName patterns
  const tagRegex = /#\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = tagRegex.exec(content)) !== null) {
    categories.push(match[1]);
  }

  return categories;
}

// Parse duration string like "39'" or "1h30'"
function parseDuration(durationStr: string): number {
  if (!durationStr) return 0;

  let totalMinutes = 0;

  const hourMatch = durationStr.match(/(\d+)h/);
  const minMatch = durationStr.match(/(\d+)'/);

  if (hourMatch) {
    totalMinutes += parseInt(hourMatch[1], 10) * 60;
  }
  if (minMatch) {
    totalMinutes += parseInt(minMatch[1], 10);
  }

  return totalMinutes;
}

// Build a map of all category paths (including nested paths)
function buildCategoryPathMap(categories: CategoryNode[], parentPath = ''): string[] {
  const paths: string[] = [];

  for (const cat of categories) {
    const fullPath = parentPath ? `${parentPath}/${cat.name}` : cat.name;
    // Store both with and without brackets
    paths.push(fullPath.replace(/\[\[|\]\]/g, ''));
    paths.push(fullPath);

    if (cat.children && cat.children.length > 0) {
      paths.push(...buildCategoryPathMap(cat.children, fullPath));
    }
  }

  return paths;
}

// Build stats tree with durations
function buildStatsTreeWithDurations(
  categories: CategoryNode[],
  categoryDurations: Record<string, number>,
  parentPath = ''
): StatsNode[] {
  const nodes: StatsNode[] = [];

  for (const cat of categories) {
    const fullPath = parentPath ? `${parentPath}/${cat.name}` : cat.name;
    const fullPathWithoutBrackets = fullPath.replace(/\[\[|\]\]/g, '');

    const ownDuration = categoryDurations[fullPathWithoutBrackets] || categoryDurations[fullPath] || 0;

    const node: StatsNode = {
      name: cat.name,
      ownDuration,
      totalDuration: ownDuration, // Will be updated with children's duration
      percentage: 0,
      children: [],
    };

    if (cat.children && cat.children.length > 0) {
      node.children = buildStatsTreeWithDurations(cat.children, categoryDurations, fullPath);

      // Calculate total duration = own + children's total
      for (const child of node.children) {
        node.totalDuration += child.totalDuration;
      }
    }

    nodes.push(node);
  }

  return nodes;
}

// Generic Roam fetch function with redirect handling
async function fetchRoam(graphName: string, apiToken: string, query: string): Promise<Record<string, unknown>> {
  const body = JSON.stringify({ query, args: [] });

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiToken}`,
    'x-authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
  };

  const roamResponse = await fetch(`${ROAM_API_BASE}/${graphName}/q`, {
    method: 'POST',
    headers,
    body,
  });

  if (roamResponse.status === 308) {
    const location = roamResponse.headers.get('location');
    if (location) {
      const redirectResponse = await fetch(location, {
        method: 'POST',
        headers,
        body,
      });
      if (redirectResponse.ok) {
        return redirectResponse.json() as Promise<Record<string, unknown>>;
      }
    }
  }

  if (roamResponse.ok) {
    return roamResponse.json() as Promise<Record<string, unknown>>;
  }

  throw new Error(`Roam API error: ${roamResponse.status}`);
}

// Parse categories from Roam response
function parseCategories(data: { result?: unknown[] }): CategoryNode[] {
  const result = data.result;
  if (!result || !Array.isArray(result)) {
    return [];
  }

  const buildNode = (block: Record<string, unknown>): CategoryNode | null => {
    if (!block || !block[':block/uid'] || !block[':block/string']) {
      return null;
    }

    const node: CategoryNode = {
      id: block[':block/uid'] as string,
      name: block[':block/string'] as string,
      children: [],
    };

    const children = block[':block/children'];
    if (children && Array.isArray(children)) {
      node.children = children
        .map((child) => buildNode(child as Record<string, unknown>))
        .filter((n): n is CategoryNode => n !== null);
    }

    return node;
  };

  const allNodes: CategoryNode[] = result
    .map((item) => {
      const block = (item as unknown[])[0] as Record<string, unknown>;
      return buildNode(block);
    })
    .filter((n): n is CategoryNode => n !== null);

  const childUids = new Set<string>();
  for (const node of allNodes) {
    for (const child of node.children) {
      childUids.add(child.id);
    }
  }

  const topLevelNodes = allNodes.filter((node) => !childUids.has(node.id));

  return topLevelNodes;
}
