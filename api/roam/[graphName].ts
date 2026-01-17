import type { VercelRequest, VercelResponse } from '@vercel/node';

const ROAM_API_BASE = 'https://api.roamresearch.com/api/graph';
const PEERS = [
  'peer-24.api.roamresearch.com:3001',
  'peer-25.api.roamresearch.com:3001',
  'peer-23.api.roamresearch.com:3001',
];

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

  const { graphName } = request.query;

  if (!graphName || typeof graphName !== 'string') {
    return response.status(400).json({ error: 'Graph name is required' });
  }

  const apiToken = process.env.ROAM_API_TOKEN;

  if (!apiToken) {
    console.error('ROAM_API_TOKEN not configured');
    return response.status(500).json({ error: 'Server configuration error: ROAM_API_TOKEN missing' });
  }

  const { action, ...data } = request.body as { action: string; [key: string]: unknown };

  if (!action) {
    return response.status(400).json({ error: 'Action is required' });
  }

  const body = JSON.stringify({ action, ...data });

  const isQuery = action === 'q';

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${apiToken}`,
    'x-authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': String(Buffer.byteLength(body)),
  };

  // Queries go to main API only (no /write)
  // Mutations go to main API + peer servers with /write
  const urlsToTry = isQuery
    ? [`${ROAM_API_BASE}/${graphName}`]
    : [`${ROAM_API_BASE}/${graphName}`, ...PEERS.map(p => `https://${p}/api/graph/${graphName}/write`)];

  let lastError: string = '';

  for (const currentUrl of urlsToTry) {
    try {
      const roamResponse = await fetch(currentUrl, {
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
            if (isQuery) {
              // For queries, return the actual data
              const result = await redirectResponse.json();
              return response.status(200).json(result);
            }
            return response.status(200).json({ success: true });
          }
          lastError = `Redirect failed: ${redirectResponse.status}`;
          continue;
        }
      }

      if (roamResponse.ok) {
        if (isQuery) {
          // For queries, return the actual data
          const result = await roamResponse.json();
          return response.status(200).json(result);
        }
        return response.status(200).json({ success: true });
      }

      if (roamResponse.status === 404) {
        continue;
      }

      const errorText = await roamResponse.text();
      lastError = errorText;
      return response.status(roamResponse.status).json({
        error: `Roam API error: ${errorText}`,
      });

    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
      continue;
    }
  }

  return response.status(500).json({ error: `All Roam endpoints failed: ${lastError}` });
}
