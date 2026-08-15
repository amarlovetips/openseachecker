const https = require('https');

async function fetchOpenSeaHtml(slug) {
  const url = `https://opensea.io/collection/${slug}/overview`;
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

function parseOpenSeaDropStages(html) {
  try {
    // 1. Look for full stage array with label, stageType, startTime, endTime
    const fullStagesRegex = /"stages":(\[\{"label":[\s\S]*?\}\])/;
    const match = html.match(fullStagesRegex);
    if (match) {
      const parsed = JSON.parse(match[1]);
      console.log('Successfully parsed full stages:', parsed.length);
      return parsed;
    }

    // 2. Fallback regex for any stages array with startTime
    const fallbackRegex = /"stages":(\[\{"startTime":[\s\S]*?\}\])/;
    const fbMatch = html.match(fallbackRegex);
    if (fbMatch) {
      const parsed = JSON.parse(fbMatch[1]);
      console.log('Successfully parsed fallback stages:', parsed.length);
      return parsed;
    }
  } catch (err) {
    console.error('Error parsing stages:', err.message);
  }
  return null;
}

async function run() {
  const html = await fetchOpenSeaHtml('chainraiders');
  const stages = parseOpenSeaDropStages(html);
  console.log('Parsed Stages Result:');
  console.log(JSON.stringify(stages, null, 2));
}

run();
