async function inspectCollectionNode() {
  const collections = ['chainraiders', 'laughingsighfox'];
  for (const slug of collections) {
    const res = await fetch(`https://opensea.io/collection/${slug}/overview`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    
    // Look for collection object in Relay store
    // e.g. "collection":{"address":...,"chain":...}
    const collectionAddressMatches = [...html.matchAll(/"(0x[a-fA-F0-9]{40})"/g)].map(m => m[1]);
    console.log(`\n=== ${slug} ===`);
    
    // Check for chain identifier
    const chainIdentMatches = [...html.matchAll(/"chain":\{[^}]*"identifier":"([^"]+)"/gi)].map(m => m[1]);
    console.log('Chain identifiers:', [...new Set(chainIdentMatches)]);

    // Check for drop stage or contract address
    const dropMatches = [...html.matchAll(/"contractAddress":"(0x[a-fA-F0-9]{40})"/gi)].map(m => m[1]);
    console.log('contractAddress matches:', dropMatches);
    
    // Check for "address":"0x..."
    const addrMatches = [...html.matchAll(/"address":"(0x[a-fA-F0-9]{40})"/gi)].map(m => m[1]);
    console.log('address matches:', addrMatches);

    // Check for asset contract
    const assetContractMatches = [...html.matchAll(/"assetContract":\{[^}]*"address":"(0x[a-fA-F0-9]{40})"/gi)].map(m => m[1]);
    console.log('assetContract address:', assetContractMatches);
  }
}
inspectCollectionNode();
