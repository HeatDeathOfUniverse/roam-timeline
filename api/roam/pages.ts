import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  // Get graph name from request body
  const { graphName } = request.body as { graphName?: string };

  if (!graphName) {
    return response.status(400).json({ error: 'Graph name is required' });
  }

  // Query for all pages in the graph
  const query = `[:find (pull ?page [:node/uid :node/title :block/string]) :where [?page :node/title]]`;

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

    // Follow 308 redirect
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
          const pages = parsePages(result);
          return response.status(200).json({ pages });
        }
      }
    }

    if (roamResponse.ok) {
      const result = await roamResponse.json();
      const pages = parsePages(result);
      return response.status(200).json({ pages });
    }

    const errorText = await roamResponse.text();
    return response.status(roamResponse.status).json({
      error: `Roam API error: ${errorText}`,
    });
  } catch (error) {
    console.error('Failed to fetch pages:', error);
    return response.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

interface RoamBlock {
  ':node/uid'?: string;
  ':node/title'?: string;
  ':block/string'?: string;
}

interface RoamResultItem {
  0?: RoamBlock;
}

interface RoamResult {
  result?: RoamResultItem[];
}

function parsePages(data: RoamResult): Array<{ id: string; name: string }> {
  const result = data.result;
  if (!result || !Array.isArray(result)) {
    return [];
  }

  const pageSet = new Map<string, { id: string; name: string }>();

  for (const item of result) {
    const block = item[0];
    if (!block) continue;

    // Get page title from either :node/title or :block/string
    let title: string | undefined;
    let uid: string | undefined;

    if (block[':node/title']) {
      title = block[':node/title'];
      uid = block[':node/uid'];
    } else if (block[':block/string']) {
      title = block[':block/string'];
      uid = block[':node/uid'] || block[':block/uid'];
    }

    if (title && uid && !pageSet.has(title)) {
      pageSet.set(title, { id: uid, name: `[[${title}]]` });
    }
  }

  return Array.from(pageSet.values());
}
