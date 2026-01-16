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
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
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
    return response.status(500).json({ error: 'Server configuration error' });
  }

  const { action, ...data } = request.body as { action: string; [key: string]: unknown };

  if (!action) {
    return response.status(400).json({ error: 'Action is required' });
  }

  const body = JSON.stringify({ action, ...data });

  const headers = {
    'Authorization': `Bearer ${apiToken}`,
    'x-authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  };

  const urlsToTry = [
    `${ROAM_API_BASE}/${graphName}`,
    ...PEERS.map(p => `https://${p}/api/graph/${graphName}/write`)
  ];

  for (const currentUrl of urlsToTry) {
    try {
      const roamResponse = await fetch(currentUrl, {
        method: 'POST',
        headers: headers,
        body: body,
      });

      if (roamResponse.status === 308) {
        const location = roamResponse.headers.get('location');
        if (location) {
          const redirectResponse = await fetch(location, {
            method: 'POST',
            headers: headers,
            body: body,
          });
          // Return success even if body is empty
          return response.status(200).json({ success: true });
        }
      }

      if (roamResponse.ok) {
        return response.status(200).json({ success: true });
      }

      if (roamResponse.status === 404) {
        continue;
      }

      const errorText = await roamResponse.text();
      return response.status(roamResponse.status).json({
        error: `Roam API error: ${errorText}`,
      });

    } catch (error) {
      continue;
    }
  }

  return response.status(500).json({ error: 'All Roam endpoints failed' });
}
