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
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
  });
}

async function run() {
  console.log('Fetching OpenSea page...');
  const res = await getUrl('https://opensea.io/collection/chainraiders/overview');
  console.log('Status:', res.status, 'Data length:', res.data.length);

  // Search for JSON or stages in the HTML
  const matches = res.data.match(/\{"__typename"[\s\S]*?\}/g);
  console.log('Matches with __typename:', matches ? matches.length : 0);

  // Search for drop stages or mint in html
  const regex = /"stage[s]?"[\s\S]*?\]/gi;
  const stageMatches = res.data.match(regex);
  if (stageMatches) {
    console.log('Found stage patterns:', stageMatches.slice(0, 3));
  }

  // Let's also check OpenSea GraphQL endpoint
  console.log('Testing GraphQL query...');
}

run().catch(console.error);
