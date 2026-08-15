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

  // Search for collection metadata in HTML
  // Look for "name": "Laughing Sigh Fox" or collection contract in the embedded JSON
  const regex = /"collection":\{[\s\S]*?"contracts":\[\{"address":"(0x[a-fA-F0-9]{40})"/i;
  const match = html.match(regex);
  if (match) console.log('Found contract regex 1:', match[1]);

  const contractRegex2 = /"primaryAssetContracts":\[\{"address":"(0x[a-fA-F0-9]{40})"/i;
  const match2 = html.match(contractRegex2);
  if (match2) console.log('Found contract regex 2:', match2[1]);

  const contractRegex3 = /"address":"(0x[a-fA-F0-9]{40})","chain"/i;
  const match3 = html.match(contractRegex3);
  if (match3) console.log('Found contract regex 3:', match3[1]);

  // Look for SeaDrop contract or drop stages
  const stagesMatch = html.match(/"stages":(\[\{"label":[\s\S]*?\}\])/);
  if (stagesMatch) {
    const stages = JSON.parse(stagesMatch[1]);
    console.log('Stages count:', stages.length);
    console.log('Stages labels:', stages.map(s => s.label));
  }

  // Look for all occurrences of "0x..." followed by token/nft contract
  const dropRegex = /"drop":\{[\s\S]*?\}/;
  const dropMatch = html.match(dropRegex);
  if (dropMatch) console.log('Drop match:', dropMatch[0].slice(0, 300));
}

run();
