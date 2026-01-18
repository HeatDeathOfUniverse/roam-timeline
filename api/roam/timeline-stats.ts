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
    // Parse dates (they come in Roam format like "January 12th, 2026")
    const start = parseRoamDate(startDate || 'January 12th, 2026');
    const end = parseRoamDate(endDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }));

    console.log('Fetching timeline stats from', start.toISOString(), 'to', end.toISOString());

    // Step 1: Get categories tree
    const categoriesQuery = `[:find (pull ?block [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order]}]}]) :where
      [?page :node/title "Time Categories"]
      [?block :block/page ?page]]`;

    const categoriesResult = await fetchRoam(graphName, apiToken, categoriesQuery);
    const categories = parseCategories(categoriesResult);

    console.log(`Found ${categories.length} top-level categories`);
    const logCategoryTree = (cats: CategoryNode[], depth = 0) => {
      for (const cat of cats) {
        console.log('  '.repeat(depth) + `- ${cat.name}`);
        if (cat.children.length > 0) {
          logCategoryTree(cat.children, depth + 1);
        }
      }
    };
    logCategoryTree(categories);

    // Step 2: Get all timeline entries for the date range
    const entries = await getTimelineEntries(graphName, apiToken, start, end);

    const debugInfo: Record<string, unknown> = {
      categoriesCount: categories.length,
      entriesCount: entries.length,
      entries: entries.map(e => ({
        content: e.content.substring(0, 50),
        duration: e.duration,
        categories: e.categories
      })),
    };

    console.log(`Processing ${entries.length} entries...`);
    for (const entry of entries) {
      console.log(`  Entry: "${entry.content.substring(0, 50)}..." (${entry.duration}m) categories: [${entry.categories.join(', ')}]`);
    }

    // Step 3: Build a map of all category paths
    const categoryPaths = buildCategoryPathMap(categories);

    // Step 4: For each entry, find matching categories and add duration
    const categoryDurations: Record<string, number> = {};

    let matchedCount = 0;
    for (const entry of entries) {
      console.log(`Entry: "${entry.content.substring(0, 50)}..." (${entry.duration}m)`);
      for (const catName of entry.categories) {
        const result = addDurationToCategory(categories, catName, entry.duration, categoryDurations);
        if (result) matchedCount++;
      }
    }
    console.log(`Matched ${matchedCount} category assignments`);

    // Step 5: Build stats tree with durations
    const statsTree = buildStatsTreeWithDurations(categories, categoryDurations);

    const debugInfo: Record<string, unknown> = {
      categoriesCount: categories.length,
      entriesCount: entries.length,
      categoryDurations: Object.entries(categoryDurations),
    };

    console.log('=== Final Stats ===');
    for (const [path, mins] of Object.entries(categoryDurations)) {
      console.log(`  ${path}: ${mins}m`);
    }

    return response.status(200).json({ stats: statsTree, debug: debugInfo });
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
  startDate: Date,
  endDate: Date
): Promise<TimelineEntry[]> {
  const entries: TimelineEntry[] = [];

  // For each day, query the timeline entries
  const current = new Date(startDate);
  while (current <= endDate) {
    const pageTitle = formatRoamDate(current);

    // Query timeline entries for this specific day
    const query = `[:find (pull ?child [:block/string :block/order]) :where
      [?p :node/title "${pageTitle}"]
      [?b :block/page ?p]
      [?b :block/string "Timeline"]
      [?b :block/children ?child]]`;

    try {
      const result = await fetchRoam(graphName, apiToken, query);
      console.log(`Query result for ${pageTitle}:`, JSON.stringify(result).substring(0, 500));
      const timelineData = (result.result as Array<[Array<{':block/string': string}]>) || [];

      if (timelineData.length > 0) {
        console.log(`Found ${timelineData.length} entries for ${pageTitle}`);
      }

      let entryWithCategoriesCount = 0;
      for (const item of timelineData) {
        const childData = item[0];
        if (!childData) continue;

        const content = childData[':block/string'];
        if (!content) continue;

        // Parse timeline format: "HH:MM - HH:MM duration content"
        // Duration can be like "2h12'" or "39'" or "1h30'"
        // First match time range, then extract duration and content
        const timeMatch = content.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s+(.+)$/);
        if (timeMatch) {
          // timeMatch[3] is "duration content" - extract duration from the start
          // Duration format: "2h12'" or "12h30'" or "39'" or "1h" etc.
          const durationContent = timeMatch[3];
          const durationMatch = durationContent.match(/^(\d+h\d+'|\d+h\d+|\d+'\d+h|\d+h|\d+')\s*(.*)$/);
          const duration = durationMatch ? parseDuration(durationMatch[1]) : 0;
          const entryContent = durationMatch ? durationMatch[2] : durationContent;

          // Extract category tags from content
          const categories = extractCategories(entryContent);

          if (categories.length > 0) {
            console.log(`  Entry: "${entryContent.substring(0, 50)}..." -> categories: [${categories.join(', ')}], duration: ${duration}m`);
            entryWithCategoriesCount++;
          } else {
            // Log entries without categories for debugging
            console.log(`  NO CATEGORIES: "${entryContent.substring(0, 80)}..."`);
          }

          entries.push({
            content: entryContent,
            duration,
            categories
          });
        }
      }
      if (entryWithCategoriesCount > 0) {
        console.log(`  -> ${entryWithCategoriesCount} entries with categories for ${pageTitle}`);
      }
    } catch (err) {
      // Skip days that don't exist (future dates, etc.)
      console.log(`Error for ${pageTitle}:`, err);
    }

    // Move to next day
    current.setDate(current.getDate() + 1);
  }

  const entriesWithCategories = entries.filter(e => e.categories.length > 0);
  console.log(`Total timeline entries found: ${entries.length} (${entriesWithCategories.length} with categories)`);
  if (entries.length === 0) {
    console.log('WARNING: No entries found! Check if the Timeline block exists on the page.');
  }
  return entries;
}

// Helper function to add duration to a category
// Fix: Now matches by leaf category name, not full path
// This allows short format tags like #睡觉 to match "Life/睡觉" in the tree
function addDurationToCategory(
  categories: CategoryNode[],
  catName: string,
  duration: number,
  categoryDurations: Record<string, number>,
  parentPath = ''
): boolean {
  // Define this outside the loop so we can use it in the error log
  const catNameWithoutBrackets = catName.replace(/\[\[|\]\]/g, '');

  for (const cat of categories) {
    const currentCatNameWithoutBrackets = cat.name.replace(/\[\[|\]\]/g, '');

    // Check if leaf category name matches (ignore parent path)
    if (currentCatNameWithoutBrackets === catNameWithoutBrackets) {
      // Build full path and add duration
      const fullPath = parentPath ? `${parentPath}/${cat.name}` : cat.name;
      const fullPathWithoutBrackets = fullPath.replace(/\[\[|\]\]/g, '');
      addDurationToPath(categoryDurations, fullPathWithoutBrackets, duration);
      console.log(`✅ Matched "${catNameWithoutBrackets}" -> "${fullPathWithoutBrackets}" (+${duration}m)`);
      return true;
    }

    // Continue searching in children
    if (cat.children && cat.children.length > 0) {
      const fullPath = parentPath ? `${parentPath}/${cat.name}` : cat.name;
      const found = addDurationToCategory(cat.children, catName, duration, categoryDurations, fullPath);
      if (found) {
        return true;
      }
    }
  }
  console.log(`❌ No match for "${catNameWithoutBrackets}"`);
  return false;
}

// Helper to safely add duration to a path key
function addDurationToPath(durations: Record<string, number>, path: string, duration: number): void {
  if (path) {
    durations[path] = (durations[path] || 0) + duration;
  }
}

// Format date to Roam's format: "January 18th, 2026"
function formatRoamDate(date: Date): string {
  const month = date.toLocaleString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();

  let suffix = 'th';
  if (day % 10 === 1 && day % 100 !== 11) suffix = 'st';
  else if (day % 10 === 2 && day % 100 !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day % 100 !== 13) suffix = 'rd';

  return `${month} ${day}${suffix}, ${year}`;
}

// Parse Roam date format: "January 12th, 2026" to Date object
function parseRoamDate(dateStr: string): Date {
  // Remove ordinal suffix (st, nd, rd, th)
  const cleaned = dateStr.replace(/(\d+)(st|nd|rd|th)/, '$1');
  const timestamp = Date.parse(cleaned);
  if (isNaN(timestamp)) {
    // Fallback to current date if parsing fails
    return new Date();
  }
  return new Date(timestamp);
}

// Extract category tags from content
function extractCategories(content: string): string[] {
  const categories: string[] = [];
  const foundCategories = new Set<string>();

  // Match #[[Category Name]] format
  const bracketRegex = /#\[\[([^\]]+)\]\]/g;
  let match;

  while ((match = bracketRegex.exec(content)) !== null) {
    const catName = match[1].trim();
    if (catName && !foundCategories.has(catName)) {
      foundCategories.add(catName);
      categories.push(catName);
    }
  }

  // Also match #CategoryName format (without brackets)
  // Note: We use [^\s#]+ to allow slashes and other characters in category names
  const simpleRegex = /#([^\s#]+)/g;
  while ((match = simpleRegex.exec(content)) !== null) {
    const catName = match[1].trim();
    // Skip if this looks like a bracket expression (contains [[)
    if (catName && !catName.includes('[[') && !foundCategories.has(catName)) {
      foundCategories.add(catName);
      categories.push(catName);
    }
  }

  if (categories.length > 0) {
    console.log(`extractCategories for "${content.substring(0, 50)}...": [${categories.join(', ')}]`);
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

  interface RawBlock {
    ':block/uid': string;
    ':block/string': string;
    ':block/children'?: RawBlock[];
  }

  const buildNode = (block: RawBlock, depth = 0): CategoryNode | null => {
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
        .map((child) => buildNode(child, depth + 1))
        .filter((n): n is CategoryNode => n !== null);
    }

    return node;
  };

  // Build all nodes from the result
  const allNodes: CategoryNode[] = result
    .map((item) => {
      const block = (item as unknown[])[0] as RawBlock;
      return buildNode(block);
    })
    .filter((n): n is CategoryNode => n !== null);

  // Collect all child UIDs at all levels to identify which nodes are nested
  const collectAllChildUids = (nodes: CategoryNode[]): Set<string> => {
    const uids = new Set<string>();
    for (const node of nodes) {
      for (const child of node.children) {
        uids.add(child.id);
        // Also recurse to collect nested children
        const nestedUids = collectAllChildUids([child]);
        for (const uid of nestedUids) {
          uids.add(uid);
        }
      }
    }
    return uids;
  };

  const allChildUids = collectAllChildUids(allNodes);

  // Filter to only keep top-level nodes (nodes that are not children of any other node)
  // Also filter out the "Time Categories" page itself if present
  const topLevelNodes = allNodes.filter((node) =>
    node.name !== 'Time Categories' && !allChildUids.has(node.id)
  );

  return topLevelNodes;
}
