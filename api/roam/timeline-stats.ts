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

    // Step 2: For each category, query blocks that reference it
    const categoryStats: Record<string, number> = {};

    const allCategories = flattenCategories(categories);
    for (const cat of allCategories) {
      const catDuration = await getCategoryDuration(graphName, apiToken, cat.name, startDate, endDate);
      categoryStats[cat.name] = catDuration;
    }

    // Step 3: Aggregate into tree structure with parent durations
    const statsTree = buildStatsTree(categories, categoryStats);

    return response.status(200).json({ stats: statsTree });
  } catch (error) {
    console.error('Failed to fetch timeline stats:', error);
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Helper function to flatten categories for querying
function flattenCategories(categories: CategoryNode[], result: CategoryNode[] = []): CategoryNode[] {
  for (const cat of categories) {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      flattenCategories(cat.children, result);
    }
  }
  return result;
}

// Get duration for a specific category using reference query
async function getCategoryDuration(
  graphName: string,
  apiToken: string,
  categoryName: string,
  startDate?: string,
  endDate?: string
): Promise<number> {
  // Use the category name without brackets for the query
  const catName = categoryName.replace(/\[\[|\]\]/g, '');

  // Build date filter - use month prefix matching for simplicity
  const monthPrefix = startDate ? startDate.split(' ')[0] : 'January';
  const startFilter = startDate ? `[(>= ?title "${startDate}")]` : '';
  const endFilter = endDate ? `[(<= ?title "${endDate}")]` : '';

  // Query blocks that reference this category page, filtered by date range
  const query = `[:find (pull ?entry [:block/string :block/order {:block/page [:node/title]}]) :where
    [?cat :node/title "${catName}"]
    [?entry :block/_refs ?cat]
    [?entry :block/page ?page]
    [?page :node/title ?title]
    [(clojure.string/starts-with? ?title "${monthPrefix}")]
    ${startFilter}
    ${endFilter}]`;

  const result = await fetchRoam(graphName, apiToken, query);
  const entries = parseTimelineEntries(result);

  // Calculate total duration
  let totalMinutes = 0;
  for (const entry of entries) {
    totalMinutes += entry.duration || 0;
  }

  return totalMinutes;
}

// Parse timeline entries and extract duration
function parseTimelineEntries(data: { result?: unknown[] }): Array<{ duration: number }> {
  const result = data.result;
  if (!result || !Array.isArray(result)) {
    return [];
  }

  const entries: Array<{ duration: number }> = [];

  for (const item of result) {
    const block = (item as unknown[])[0] as Record<string, unknown>;
    if (!block || !block[':block/string']) continue;

    const content = block[':block/string'] as string;

    // Parse time format: "HH:MM - HH:MM (**duration**) - content"
    const timeMatch = content.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\(\*\*(.+?)\*\*\)\s*-\s*([\s\S]*)$/);

    if (timeMatch) {
      const duration = parseDuration(timeMatch[3]);
      entries.push({ duration });
    }
  }

  return entries;
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

// Build stats tree with parent durations
function buildStatsTree(
  categories: CategoryNode[],
  categoryStats: Record<string, number>,
  parentDuration = 0
): StatsNode[] {
  const nodes: StatsNode[] = [];

  for (const cat of categories) {
    const ownDuration = categoryStats[cat.name] || 0;
    const totalDuration = ownDuration + parentDuration;

    const node: StatsNode = {
      name: cat.name,
      ownDuration,
      totalDuration,
      percentage: 0,
      children: [],
    };

    if (cat.children && cat.children.length > 0) {
      node.children = buildStatsTree(cat.children, categoryStats, ownDuration);
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
