import type { VercelRequest, VercelResponse } from '@vercel/node';

interface CategoryNode {
  id: string;
  name: string;
  children: CategoryNode[];
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

  // Get graph name from request body or query
  const { graphName } = request.body as { graphName?: string };

  if (!graphName) {
    return response.status(400).json({ error: 'Graph name is required' });
  }

  // Query for Time Categories page with full tree structure
  // First get all blocks under Time Categories, then get their children recursively
  const query = `[:find (pull ?block [
    :block/uid
    :block/string
    :block/children
  ]) :where
    [?page :node/title "Time Categories"]
    [?block :block/page ?page]]`;

  const body = JSON.stringify({ query, args: [] });

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiToken}`,
    'x-authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
  };

  try {
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
          const result = await redirectResponse.json();
          const categories = parseCategories(result);
          return response.status(200).json({ categories });
        }
      }
    }

    if (roamResponse.ok) {
      const result = await roamResponse.json();
      const categories = parseCategories(result);
      return response.status(200).json({ categories });
    }

    const errorText = await roamResponse.text();
    return response.status(roamResponse.status).json({
      error: `Roam API error: ${errorText}`,
    });
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function parseCategories(data: { result?: unknown[] }): CategoryNode[] {
  const result = data.result;
  if (!result || !Array.isArray(result)) {
    return [];
  }

  // Convert Roam blocks to category nodes
  const nodes: CategoryNode[] = result.map((item: unknown[]) => {
    const block = item[0 as keyof typeof item] as {
      ':block/uid'?: string;
      ':block/string'?: string;
      ':block/children'?: unknown[];
    } | undefined;
    if (block && block[':block/uid'] && block[':block/string']) {
      return {
        id: block[':block/uid'],
        name: block[':block/string'],
        children: [],
      };
    }
    return null;
  }).filter((n): n is CategoryNode => n !== null);

  // Build hierarchical structure from flat list
  // Roam returns blocks in order, and children are embedded in :block/children
  const buildTree = (blocks: typeof nodes): CategoryNode[] => {
    const result: CategoryNode[] = [];

    for (const block of blocks) {
      if (block[':block/children' as keyof typeof block]) {
        const childrenData = block[':block/children' as keyof typeof block] as unknown[];
        const children = childrenData.map((child: unknown) => {
          const c = child as { ':block/uid'?: string; ':block/string'?: string };
          return {
            id: c[':block/uid'] || '',
            name: c[':block/string'] || '',
            children: [],
          };
        }).filter(c => c.id && c.name);
        block.children = children;
      }
      result.push({
        id: block.id,
        name: block.name,
        children: block.children,
      });
    }

    return result;
  };

  return buildTree(nodes);
}
