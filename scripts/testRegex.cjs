async function test() {
  const res = await fetch('https://opensea.io/collection/chainraiders/overview', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
  });
  const html = await res.text();
  
  // What vite.config.js was doing:
  const cdnItemMatch = html.match(/seadn\.io\/([a-z0-9-_]+)\/(0x[a-fA-F0-9]{40})\//i);
  console.log('Old cdnItemMatch detected chain:', cdnItemMatch ? cdnItemMatch[1] : 'NONE');

  // Direct OpenSea GraphQL State pattern:
  const chainIdentMatch = html.match(/"chain":\{"identifier":"([^"]+)"/i);
  console.log('New "chain":{"identifier":"..."}:', chainIdentMatch ? chainIdentMatch[1] : 'NONE');

  const chainObjMatch = html.match(/"chain":\{[^}]*"identifier":"([^"]+)"/i);
  console.log('New flexible "chain":{..."identifier":"..."}:', chainObjMatch ? chainObjMatch[1] : 'NONE');
}

test();
