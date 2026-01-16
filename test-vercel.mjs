import https from 'https';

const postData = JSON.stringify({
  action: 'create-block',
  location: { 'page-title': 'January 17th, 2026', order: 'last' },
  block: { string: 'Vercel API test', uid: 'vercel-mcp-test-' + Date.now() }
});

const options = {
  hostname: 'roam-timeline.vercel.app',
  path: '/api/roam/Mineworld',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Testing Vercel API:', options.hostname + options.path);

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  console.log('Headers:', JSON.stringify(res.headers, null, 2));
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(postData);
req.end();

setTimeout(() => {
  console.log('Timeout');
  process.exit(1);
}, 30000);
