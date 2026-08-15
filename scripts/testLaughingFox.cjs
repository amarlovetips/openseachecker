const https = require('https');

async function getUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
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
  const slug = 'laughingsighfox';
  console.log('Testing OpenSea API v2 for ' + slug);
  const apiRes = await getUrl('https://api.opensea.io/api/v2/collections/' + slug);
  console.log('API Status:', apiRes.status);
  console.log('API Response:', apiRes.data.slice(0, 300));

  console.log('\nTesting OpenSea HTML for ' + slug);
  const htmlRes = await getUrl('https://opensea.io/collection/' + slug + '/overview');
  console.log('HTML Status:', htmlRes.status, 'Length:', htmlRes.data.length);

  // Search for 0x address
  const hex = htmlRes.data.match(/0x[a-fA-F0-9]{40}/gi) || [];
  const uniqueHex = [...new Set(hex.map(h => h.toLowerCase()))];
  console.log('Unique 0x addresses in HTML:', uniqueHex);

  // Search for stages
  const stagesMatch = htmlRes.data.match(/"stages":(\[\{"label":[\s\S]*?\}\])/);
  if (stagesMatch) {
    console.log('Found stages:', stagesMatch[1].slice(0, 400));
  } else {
    const fbMatch = htmlRes.data.match(/"stages":(\[\{"startTime":[\s\S]*?\}\])/);
    if (fbMatch) console.log('Found fallback stages:', fbMatch[1].slice(0, 400));
    else console.log('No stages in HTML');
  }

  // Look for contractAddress or contract
  const contractMatch = htmlRes.data.match(/"contractAddress":"(0x[a-fA-F0-9]{40})"/i) ||
                        htmlRes.data.match(/"address":"(0x[a-fA-F0-9]{40})"/i);
  if (contractMatch) {
    console.log('Found contract from HTML property:', contractMatch[1]);
  }
}

run();
