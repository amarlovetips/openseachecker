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

  // Search for the collection address in the page scripts
  // In OpenSea drop pages, the contract is referenced in `collection: { ... }` or `contractAddress`
  const matches = html.match(/"chain":\{"identifier":"([a-z0-9-_]+)"[\s\S]*?"address":"(0x[a-fA-F0-9]{40})"/gi);
  console.log('Matches chain -> address:', matches);

  const matchesRev = html.match(/"address":"(0x[a-fA-F0-9]{40})"[\s\S]*?"chain":\{"identifier":"([a-z0-9-_]+)"/gi);
  console.log('Matches address -> chain:', matchesRev);

  // Search for the contract with etherscan / block explorer link
  const explorerMatch = html.match(/(?:etherscan\.io|basescan\.org|polygonscan\.com|arbiscan\.io)\/address\/(0x[a-fA-F0-9]{40})/i);
  if (explorerMatch) console.log('Explorer match:', explorerMatch[1]);
}

run();
