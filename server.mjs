import express from 'express';
import https from 'https';
import { URL } from 'url';

const app = express();
app.use(express.json());

// Log ALL requests first
app.use((req, res, next) => {
  console.log('\n========== REQUEST ==========');
  console.log('Method:', req.method);
  console.log('URL:', req.originalUrl);
  console.log('Path:', req.path);
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('=============================');
  next();
});

const ROAM_API_TOKEN = 'roam-graph-token-AC1uSpGn4az4ckYYDdyUG8-G4Y1dw';

// Categories API endpoint - MUST come before /:graphName route
app.post('/api/roam/categories', async (req, res) => {
  console.log('>>> CATEGORIES API ROUTE HIT <<<');
  const { graphName } = req.body;

  if (!graphName) {
    return res.status(400).json({ error: 'Graph name is required' });
  }

  console.log('Fetching categories for graph:', graphName);

  const query = `[:find (pull ?block [:block/uid :block/string]) :where
    [?page :node/title "Time Categories"]
    [?block :block/page ?page]]`;

  const body = JSON.stringify({ query, args: [] });

  const headers = {
    'Authorization': `Bearer ${ROAM_API_TOKEN}`,
    'x-authorization': `Bearer ${ROAM_API_TOKEN}`,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  };

  try {
    const url = new URL(`https://api.roamresearch.com/api/graph/${graphName}/q`);
    console.log('Trying:', url.hostname + url.pathname);

    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: headers
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    console.log('  Status:', response.status);

    if (response.status === 308 && response.headers.location) {
      const redirectUrl = new URL(response.headers.location);
      const redirectResponse = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: redirectUrl.hostname,
          port: redirectUrl.port || 443,
          path: redirectUrl.pathname,
          method: 'POST',
          headers: headers
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      if (redirectResponse.status === 200) {
        const parsedData = JSON.parse(redirectResponse.data);
        const categories = parseCategories(parsedData);
        console.log('  Found', categories.length, 'categories');
        return res.status(200).json({ categories });
      }
    }

    if (response.status === 200) {
      const parsedData = JSON.parse(response.data);
      const categories = parseCategories(parsedData);
      console.log('  Found', categories.length, 'categories');
      return res.status(200).json({ categories });
    }

    console.log('  Error:', response);
    res.status(response.status || 500).json({ error: 'Failed to fetch categories' });
  } catch (error) {
    console.log('  Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Pages API endpoint - MUST come before /:graphName route
app.post('/api/roam/pages', async (req, res) => {
  const { graphName } = req.body;

  if (!graphName) {
    return res.status(400).json({ error: 'Graph name is required' });
  }

  // Query for all pages in the graph
  const query = `[:find (pull ?page [:node/uid :node/title]) :where [?page :node/title]]`;

  const body = JSON.stringify({ query, args: [] });

  const headers = {
    'Authorization': `Bearer ${ROAM_API_TOKEN}`,
    'x-authorization': `Bearer ${ROAM_API_TOKEN}`,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  };

  try {
    const url = new URL(`https://api.roamresearch.com/api/graph/${graphName}/q`);

    const response = await new Promise((resolve, reject) => {
      const req = https.request({
        hostname: url.hostname,
        port: url.port || 443,
        path: url.pathname,
        method: 'POST',
        headers: headers
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });

    if (response.status === 308 && response.headers.location) {
      const redirectUrl = new URL(response.headers.location);
      const redirectResponse = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: redirectUrl.hostname,
          port: redirectUrl.port || 443,
          path: redirectUrl.pathname,
          method: 'POST',
          headers: headers
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      if (redirectResponse.status === 200) {
        const parsed = JSON.parse(redirectResponse.data);
        const pages = parsePages(parsed);
        return res.status(200).json({ pages });
      }
    }

    if (response.status === 200) {
      const parsed = JSON.parse(response.data);
      const pages = parsePages(parsed);
      return res.status(200).json({ pages });
    }

    res.status(response.status || 500).json({ error: 'Failed to fetch pages' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/roam/:graphName', async (req, res) => {
  console.log('>>> API ROUTE HIT <<<');
  console.log('graphName:', req.params.graphName);
  console.log('action:', req.body.action);
  console.log('data:', JSON.stringify(req.body).substring(0, 200));

  const { graphName } = req.params;
  const { action, ...data } = req.body;
  const isQuery = action === 'q';

  // Build correct body and URL based on action type
  // Query: POST /api/graph/{graph}/q with { query, args }
  // Write: POST /api/graph/{graph}/write with { action, ...data }
  const body = isQuery
    ? JSON.stringify({ query: data.query, args: data.args || [] })
    : JSON.stringify({ action, ...data });

  const headers = {
    'Authorization': `Bearer ${ROAM_API_TOKEN}`,
    'x-authorization': `Bearer ${ROAM_API_TOKEN}`,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  };

  // Queries go to /q endpoint, mutations go to /write endpoint
  // Both follow 308 redirects to handle load balancing across peers
  const urlsToTry = isQuery
    ? [`https://api.roamresearch.com/api/graph/${graphName}/q`]
    : [`https://api.roamresearch.com/api/graph/${graphName}/write`];

  console.log('action:', action, 'isQuery:', isQuery, 'urls:', urlsToTry);

  for (const currentUrl of urlsToTry) {
    const url = new URL(currentUrl);
    console.log('Trying:', url.hostname + url.pathname);

    try {
      const response = await new Promise((resolve, reject) => {
        const req = https.request({
          hostname: url.hostname,
          port: url.port || 443,
          path: url.pathname,
          method: 'POST',
          headers: headers
        }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
        });
        req.on('error', reject);
        req.write(body);
        req.end();
      });

      console.log('  Status:', response.status, 'Location:', response.headers.location || 'none');

      if (response.status === 308 && response.headers.location) {
        const redirectUrl = new URL(response.headers.location);
        console.log('  Following redirect to:', redirectUrl.hostname + ':' + redirectUrl.port + redirectUrl.pathname);
        const redirectResponse = await new Promise((resolve, reject) => {
          const req = https.request({
            hostname: redirectUrl.hostname,
            port: redirectUrl.port || 443,
            path: redirectUrl.pathname,
            method: 'POST',
            headers: headers
          }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
          });
          req.on('error', reject);
          req.write(body);
          req.end();
        });
        console.log('  Redirect status:', redirectResponse.status);
        if (redirectResponse.status === 200) {
          if (isQuery) {
            try {
              const parsedData = JSON.parse(redirectResponse.data);
              res.status(200).json(parsedData);
            } catch {
              res.status(200).json({ data: redirectResponse.data });
            }
          } else {
            res.status(200).json({ success: true });
          }
          return;
        }
        continue;
      }

      if (response.status === 200) {
        console.log('  SUCCESS!');
        if (isQuery) {
          try {
            const parsedData = JSON.parse(response.data);
            res.status(200).json(parsedData);
          } catch {
            res.status(200).json({ data: response.data });
          }
        } else {
          res.status(200).json({ success: true });
        }
        return;
      }

      if (response.status === 404) {
        console.log('  404, trying next...');
        continue;
      }

      res.status(response.status || 500).send(response.data || '');

    } catch (error) {
      console.log('  Error:', error.message, 'trying next...');
      continue;
    }
  }

  res.status(500).json({ error: 'All endpoints failed' });
});

function parseCategories(data) {
  const result = data?.result;
  if (!result || !Array.isArray(result)) {
    return [];
  }

  return result
    .map((item) => {
      const block = item[0];
      if (block && block[':block/uid'] && block[':block/string']) {
        return {
          id: block[':block/uid'],
          name: block[':block/string'],
          children: [],
        };
      }
      return null;
    })
    .filter(item => item !== null);
}

function parsePages(data) {
  const result = data?.result;
  if (!result || !Array.isArray(result)) {
    return [];
  }

  const pageSet = new Map();

  for (const item of result) {
    const block = item[0];
    if (!block) continue;

    // For pages, :node/title is the unique identifier
    const title = block[':node/title'];
    if (title && !pageSet.has(title)) {
      pageSet.set(title, { id: title, name: `[[${title}]]` });
    }
  }

  return Array.from(pageSet.values());
}

app.use(express.static('dist'));
app.listen(3000, () => console.log('Server running on http://localhost:3000'));
