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

function extractContractAndStagesFromHtml(html) {
  // 1. Contract Address from item CDN url: /seadn.io/<chain>/0x<address>/...
  let contractAddress = null;
  let chainSlug = 'ethereum';

  const cdnItemMatch = html.match(/seadn\.io\/([a-z0-9-_]+)\/(0x[a-fA-F0-9]{40})\//i);
  if (cdnItemMatch) {
    chainSlug = cdnItemMatch[1].toLowerCase();
    contractAddress = cdnItemMatch[2];
  }

  if (!contractAddress) {
    const cdnLogoMatch = html.match(/seadn\.io\/collection\/(0x[a-fA-F0-9]{40})\//i);
    if (cdnLogoMatch) contractAddress = cdnLogoMatch[1];
  }

  // 2. Collection Name
  let name = '';
  const nameMatch = html.match(/"collection":\{[\s\S]*?"name":"([^"]+)"/);
  if (nameMatch) name = nameMatch[1];

  // 3. Stages
  let stages = [];
  const stagesMatch = html.match(/"stages":(\[\{"label":[\s\S]*?\}\])/);
  if (stagesMatch) {
    try { stages = JSON.parse(stagesMatch[1]); } catch(e) {}
  }

  return { contractAddress, chainSlug, name, stagesCount: stages.length, stages };
}

async function test() {
  const slugs = ['laughingsighfox', 'chainraiders'];
  for (const s of slugs) {
    const html = await getUrl(`https://opensea.io/collection/${s}/overview`);
    const res = extractContractAndStagesFromHtml(html);
    console.log(`\n=== RESULT FOR ${s} ===`);
    console.log('Contract:', res.contractAddress);
    console.log('Chain:', res.chainSlug);
    console.log('Name:', res.name);
    console.log('Stages count:', res.stagesCount);
    console.log('Stages labels:', res.stages.map(x => x.label));
  }
}

test();
