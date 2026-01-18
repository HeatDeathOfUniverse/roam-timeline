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
  // Using recursive pull syntax to get nested children
  const query = `[:find (pull ?block [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order]}]}]) :where
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

  // Convert Roam blocks to category nodes with hierarchical structure
  const buildNode = (block: Record<string, unknown>): CategoryNode | null => {
    if (!block || !block[':block/uid'] || !block[':block/string']) {
      return null;
    }

    const node: CategoryNode = {
      id: block[':block/uid'] as string,
      name: block[':block/string'] as string,
      children: [],
    };

    // Recursively build children from :block/children
    const children = block[':block/children'];
    if (children && Array.isArray(children)) {
      node.children = children
        .map((child) => buildNode(child as Record<string, unknown>))
        .filter((n): n is CategoryNode => n !== null);
    }

    return node;
  };

  // Build all nodes first
  const allNodes: CategoryNode[] = result
    .map((item) => {
      const block = (item as unknown[])[0] as Record<string, unknown>;
      return buildNode(block);
    })
    .filter((n): n is CategoryNode => n !== null);

  // Build hierarchical structure - children are already embedded by buildNode
  // But we need to filter to only top-level nodes
  const childUids = new Set<string>();
  for (const node of allNodes) {
    for (const child of node.children) {
      childUids.add(child.id);
    }
  }

  // Only return top-level nodes (those not appearing as children)
  const topLevelNodes = allNodes.filter((node) => !childUids.has(node.id));

  return topLevelNodes;
}
