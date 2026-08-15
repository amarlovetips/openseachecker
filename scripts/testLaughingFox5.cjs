const https = require('https');

async function getUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
  });
}

async function run() {
  const slug = 'laughingsighfox';
  const html = await getUrl('https://opensea.io/collection/' + slug + '/overview');

  // Search for relay store records
  // In OpenSea Next.js pages, relay store is embedded in window.__RELAY_STORE__ or script tags
  const relayStoreMatch = html.match(/__RELAY_STORE__\s*=\s*(\{[\s\S]*?\});/);
  if (relayStoreMatch) {
    console.log('Found __RELAY_STORE__!');
    const store = JSON.parse(relayStoreMatch[1]);
    for (const key of Object.keys(store)) {
      if (store[key].address && store[key].chain) {
        console.log('Found collection contract in Relay Store:', store[key]);
      }
    }
  }

  // Also check other script tags
  const scripts = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  for (const s of scripts) {
    if (s.includes('laughingsighfox') && s.includes('0x')) {
      const addresses = s.match(/0x[a-fA-F0-9]{40}/gi);
      if (addresses) {
        console.log('Script with slug has addresses:', [...new Set(addresses)]);
      }
    }
  }
}

run();
