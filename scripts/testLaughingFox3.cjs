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

  // Let's find the collection name, contract address, chain, and drop
  const pos = html.indexOf('"drop":');
  if (pos !== -1) {
    const snippet = html.slice(pos - 500, pos + 1500);
    console.log('Snippet around drop:\n', snippet);
  }

  // Search for collection object in __NEXT_DATA__
  const nextData = html.match(/<script id=\"__NEXT_DATA__\"[^>]*>([\s\S]*?)<\/script>/);
  if (nextData) {
    console.log('NextData found!');
  } else {
    // Search for Relay environment or Apollo client state in HTML
    const relayMatch = html.match(/\"collection\":\{[\s\S]*?\"name\":\"([^\"]+)\"/);
    if (relayMatch) console.log('Collection Name from relay:', relayMatch[1]);
  }
}

run();
