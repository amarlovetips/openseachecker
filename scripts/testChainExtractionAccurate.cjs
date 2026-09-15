const testSlugs = [
  'chainraiders',
  'laughingsighfox'
];

async function testExtraction(slug) {
  const url = `https://opensea.io/collection/${slug}/overview`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    }
  });
  const html = await res.text();

  let chainSlug = null;

  // 1. Match OpenSea GraphQL Relay Chain Object: "chain":{"identifier":"..."
  const relayMatch = html.match(/"chain":\{[^}]*"identifier":"([^"]+)"/i);
  if (relayMatch) chainSlug = relayMatch[1].toLowerCase();

  // 2. Match "chainIdentifier":"..."
  if (!chainSlug) {
    const identMatch = html.match(/"chainIdentifier":"([^"]+)"/i);
    if (identMatch) chainSlug = identMatch[1].toLowerCase();
  }

  // 3. Match collection object "chain": { "name": "..." }
  if (!chainSlug) {
    const chainNameMatch = html.match(/"chain":\{[^}]*"name":"([^"]+)"/i);
    if (chainNameMatch) chainSlug = chainNameMatch[1].toLowerCase();
  }

  // 4. Match drop stage or direct chain property: "chain":"..."
  if (!chainSlug) {
    const stageChainMatch = html.match(/"chain":"([a-z0-9-_]+)"/i);
    if (stageChainMatch) chainSlug = stageChainMatch[1].toLowerCase();
  }

  // Contract Address Extraction
  let contractAddress = null;
  // Look for contract address associated with the detected chain
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

  console.log(`[${slug}] => Accurately Detected Chain: "${chainSlug}", Contract: "${contractAddress}"`);
}

async function run() {
  for (const s of testSlugs) {
    await testExtraction(s);
  }
}
run();
