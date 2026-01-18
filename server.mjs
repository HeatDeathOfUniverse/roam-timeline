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

  // First, get all blocks under Time Categories with their children refs
  const query = `[:find (pull ?block [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order]}]}]) :where
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

// Timeline Stats API endpoint
app.post('/api/roam/timeline-stats', async (req, res) => {
  console.log('>>> TIMELINE STATS API ROUTE HIT <<<');
  const { graphName, startDate, endDate } = req.body;

  if (!graphName) {
    return res.status(400).json({ error: 'Graph name is required' });
  }

  try {
    // Step 1: Get categories tree
    const categoriesQuery = `[:find (pull ?block [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order {:block/children [:block/uid :block/string :block/order]}]}]) :where
      [?page :node/title "Time Categories"]
      [?block :block/page ?page]]`;

    const categoriesResult = await fetchRoam(graphName, categoriesQuery);
    const categories = parseCategories(categoriesResult);

    // Step 2: For each category, query blocks that reference it
    const categoryStats = {};

    for (const cat of flattenCategories(categories)) {
      const catName = cat.name.replace(/\[\[|\]\]/g, '');
      const catDuration = await getCategoryDuration(graphName, cat.name, startDate, endDate);
      categoryStats[cat.name] = catDuration;
    }

    // Step 3: Aggregate into tree structure with parent durations
    const statsTree = buildStatsTree(categories, categoryStats);

    res.status(200).json({ stats: statsTree });
  } catch (error) {
    console.log('  Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to flatten categories for querying
function flattenCategories(categories, result = []) {
  for (const cat of categories) {
    result.push(cat);
    if (cat.children && cat.children.length > 0) {
      flattenCategories(cat.children, result);
    }
  }
  return result;
}

// Get duration for a specific category using reference query
async function getCategoryDuration(graphName, categoryName, startDate, endDate) {
  // Parse dates to Roam format (e.g., "January 18th, 2026")
  const startRoam = formatDateForRoam(new Date(startDate));
  const endRoam = formatDateForRoam(new Date(endDate));

  // Query blocks that reference this category page, filtered by date range
  const query = `[:find (pull ?entry [:block/string :block/order {:block/page [:node/title]}]) :where
    [?cat :node/title "${categoryName.replace('[[', '').replace(']]', '')}"]
    [?entry :block/_refs ?cat]
    [?entry :block/page ?page]
    [?page :node/title ?title]
    [(clojure.string/starts-with? ?title "${startRoam.split(' ')[0]}")]
    [(>= ?title "${startRoam}")]
    [(<= ?title "${endRoam}")]]`;

  const result = await fetchRoam(graphName, query);
  const entries = parseTimelineEntries(result);

  // Calculate total duration
  let totalMinutes = 0;
  for (const entry of entries) {
    totalMinutes += entry.duration || 0;
  }

  return totalMinutes;
}

// Parse timeline entries and extract duration
function parseTimelineEntries(data) {
  const result = data?.result;
  if (!result || !Array.isArray(result)) {
    return [];
  }

  const entries = [];

  for (const item of result) {
    const block = item[0];
    if (!block || !block[':block/string']) continue;

    const content = block[':block/string'];
    const date = block[':block/page']?.[':node/title'] || '';

    // Parse time format: "HH:MM - HH:MM (**duration**) - content"
    const timeMatch = content.match(/^(\d{2}:\d{2})\s*-\s*(\d{2}:\d{2})\s*\(\*\*(.+?)\*\*\)\s*-\s*([\s\S]*)$/);

    if (timeMatch) {
      const duration = parseDuration(timeMatch[3]);
      entries.push({
        id: block[':block/uid'],
        content: content,
        startTime: timeMatch[1],
        endTime: timeMatch[2],
        duration: duration,
        date: date
      });
    }
  }

  return entries;
}

// Parse duration string like "39'" or "1h30'"
function parseDuration(durationStr) {
  if (!durationStr) return 0;

  let totalMinutes = 0;

  // Match patterns like "1h30'" or "39'"
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

// Format date to Roam's format: "January 18th, 2026"
function formatDateForRoam(date) {
  const month = date.toLocaleString('en-US', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();

  // Add ordinal suffix
  let suffix = 'th';
  if (day % 10 === 1 && day % 100 !== 11) suffix = 'st';
  else if (day % 10 === 2 && day % 100 !== 12) suffix = 'nd';
  else if (day % 10 === 3 && day % 100 !== 13) suffix = 'rd';

  return `${month} ${day}${suffix}, ${year}`;
}

// Build stats tree with parent durations
function buildStatsTree(categories, categoryStats, parentDuration = 0) {
  const nodes = [];

  for (const cat of categories) {
    const ownDuration = categoryStats[cat.name] || 0;
    const totalDuration = ownDuration + parentDuration;

    const node = {
      name: cat.name,
      ownDuration: ownDuration,
      totalDuration: totalDuration,
      percentage: 0, // Will calculate after we know total
      children: []
    };

    if (cat.children && cat.children.length > 0) {
      node.children = buildStatsTree(cat.children, categoryStats, ownDuration);
    }

    nodes.push(node);
  }

  return nodes;
}

// Generic Roam fetch function with redirect handling
async function fetchRoam(graphName, query) {
  const body = JSON.stringify({ query, args: [] });

  const headers = {
    'Authorization': `Bearer ${ROAM_API_TOKEN}`,
    'x-authorization': `Bearer ${ROAM_API_TOKEN}`,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  };

  const url = new URL(`https://api.roamresearch.com/api/graph/${graphName}/q`);
  const response = await makeRequest(url, headers, body);

  if (response.status === 200) {
    return JSON.parse(response.data);
  }

  throw new Error(`Roam API error: ${response.status}`);
}

// Make HTTP request with redirect handling
async function makeRequest(url, headers, body) {
  return new Promise((resolve, reject) => {
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
}

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

  // Convert Roam blocks to category nodes with hierarchical structure
  const buildNode = (block) => {
    if (!block || !block[':block/uid'] || !block[':block/string']) {
      return null;
    }

    const node = {
      id: block[':block/uid'],
      name: block[':block/string'],
      children: [],
    };

    // Recursively build children
    const children = block[':block/children'];
    if (children && Array.isArray(children)) {
      node.children = children
        .map(buildNode)
        .filter(n => n !== null);
    }

    return node;
  };

  const allNodes = result
    .map((item) => buildNode(item[0]))
    .filter(n => n !== null);

  // Find the direct children of Time Categories page
  // These are the blocks whose parent is the Time Categories page (not another block)
  // We need to identify the Time Categories page's db/id
  const timeCategoriesPageBlocks = result
    .map((item) => item[0])
    .filter((block) => {
      if (!block || !block[':block/uid'] || !block[':block/string']) return false;
      // A direct child of Time Categories page has no parent block
      // We can identify them by checking which blocks are NOT children of other blocks
      // Or simpler: use :block/_children relationship to find parents
      return true;
    });

  // Better approach: only return blocks that are direct children of Time Categories page
  // We use :block/_children to find which blocks are children of the page
  // Actually, let's just return the top-level nodes (those without a parent block)
  // The Roam query returns all blocks under Time Categories, including nested ones
  // We need to filter to only show the top-level ones with their children

  // Get all block UIDs that appear as children
  const childUids = new Set();
  for (const node of allNodes) {
    for (const child of node.children) {
      childUids.add(child.id);
    }
  }

  // Only return top-level nodes (those not appearing as children)
  const topLevelNodes = allNodes.filter(node => !childUids.has(node.id));

  return topLevelNodes;
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
