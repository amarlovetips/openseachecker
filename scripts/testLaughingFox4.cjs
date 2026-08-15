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

  // Search for the contract address associated with this collection
  // OpenSea stores images like: https://i2c.seadn.io/collection/0x.../image_type_logo/... OR in asset_contracts or contracts
  const imageContractMatch = html.match(/seadn\.io\/collection\/(0x[a-fA-F0-9]{40})/i);
  if (imageContractMatch) {
    console.log('Found contract from logo CDN url:', imageContractMatch[1]);
  }

  // Also search for relay records
  const relayContracts = html.match(/\{"address":"(0x[a-fA-F0-9]{40})","chain":\{"identifier":"([^"]+)"/gi);
  if (relayContracts) {
    console.log('Relay contract matches:', relayContracts);
  }

  // Also search for collection contract query
  const all0x = html.match(/0x[a-fA-F0-9]{40}/gi) || [];
  const validContracts = all0x.filter(c => 
    c !== '0x0000000000000000000000000000000000000000' &&
    c.toLowerCase() !== '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' &&
    c.toLowerCase() !== '0x0bd7d308f8e1639fab988df18a8011f41eacad73' &&
    c.toLowerCase() !== '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' &&
    c.toLowerCase() !== '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619' &&
    c.toLowerCase() !== '0x4200000000000000000000000000000000000006'
  );
  console.log('First 5 valid non-currency contracts:', [...new Set(validContracts.map(x => x.toLowerCase()))].slice(0, 5));
}

run();
