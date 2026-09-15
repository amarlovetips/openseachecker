const { ethers } = require('ethers');

async function testRareFriends() {
  console.log('================================================================');
  console.log('🧪 TESTING COLLECTION: rare-friends-genesis');
  console.log('================================================================\n');

  const slug = 'rare-friends-genesis';
  const url = `https://opensea.io/collection/${slug}/overview`;
  
  console.log(`1. Fetching OpenSea Page: ${url}...`);
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });

  const html = await res.text();
  console.log(`Received HTML size: ${html.length} bytes`);

  // 1. Extract Chain
  let chainSlug = null;
  const relayChainMatch = html.match(/"chain":\{[^}]*"identifier":"([^"]+)"/i);
  if (relayChainMatch) chainSlug = relayChainMatch[1].toLowerCase();

  if (!chainSlug) {
    const identMatch = html.match(/"chainIdentifier":"([^"]+)"/i);
    if (identMatch) chainSlug = identMatch[1].toLowerCase();
  }

  console.log(`\n📌 Detected Chain: "${chainSlug}"`);

  // 2. Extract Collection Name & Description
  let name = '';
  const nameMatch = html.match(/"collection":\{[\s\S]*?"name":"([^"]+)"/);
  if (nameMatch) name = nameMatch[1];
  console.log(`📌 Collection Name: "${name}"`);

  // 3. Extract Contract Address
  let contractAddress = null;
  if (chainSlug) {
    const chainCdnMatch = html.match(new RegExp(`seadn\\.io\\/${chainSlug}\\/(0x[a-fA-F0-9]{40})`, 'i'));
    if (chainCdnMatch) contractAddress = chainCdnMatch[1];
  }

  if (!contractAddress) {
    const dropContractMatch = html.match(/"contractAddress":"(0x[a-fA-F0-9]{40})"/i);
    if (dropContractMatch) contractAddress = dropContractMatch[1];
  }

  if (!contractAddress) {
    const assetContractMatch = html.match(/"assetContract":\{[^}]*"address":"(0x[a-fA-F0-9]{40})"/i);
    if (assetContractMatch) contractAddress = assetContractMatch[1];
  }

  if (!contractAddress) {
    const relayAddrMatch = html.match(/"address":"(0x[a-fA-F0-9]{40})"/i);
    if (relayAddrMatch) contractAddress = relayAddrMatch[1];
  }

  console.log(`📌 Contract Address: "${contractAddress}"`);

  // 4. Extract Stages
  let stages = [];
  const fullMatch = html.match(/"stages":(\[\{"label":[\s\S]*?\}\])/);
  if (fullMatch) {
    try { stages = JSON.parse(fullMatch[1]); } catch(e) {}
  }
  if (stages.length === 0) {
    const fbMatch = html.match(/"stages":(\[\{"startTime":[\s\S]*?\}\])/);
    if (fbMatch) {
      try { stages = JSON.parse(fbMatch[1]); } catch(e) {}
    }
  }

  console.log(`\n📌 Authentic Stages Count: ${stages.length}`);
  stages.forEach((stg, i) => {
    console.log(`   Stage #${i + 1}: "${stg.label || stg.stageType || 'Stage'}"`);
    console.log(`     - Start: ${stg.startTime} (${new Date(stg.startTime).toLocaleString()})`);
    console.log(`     - End: ${stg.endTime ? new Date(stg.endTime).toLocaleString() : 'Open-ended'}`);
    console.log(`     - Price: ${JSON.stringify(stg.price)}`);
    console.log(`     - Max Per Wallet: ${stg.maxTotalMintableByWallet || 'Unlimited'}`);
  });

  // 5. Test against local proxy
  console.log('\n2. Testing through Local Server Proxy (/api/opensea-drop)...');
  try {
    const proxyRes = await fetch(`http://localhost:5173/api/opensea-drop?slug=${slug}`);
    const proxyData = await proxyRes.json();
    console.log('✅ Proxy successfully returned:');
    console.log(`   - Chain: ${proxyData.chainSlug}`);
    console.log(`   - Contract: ${proxyData.contractAddress}`);
    console.log(`   - Name: ${proxyData.name}`);
    console.log(`   - Stages: ${proxyData.stages ? proxyData.stages.length : 0}`);
  } catch (err) {
    console.error('❌ Proxy error:', err.message);
  }
}

testRareFriends().catch(console.error);
