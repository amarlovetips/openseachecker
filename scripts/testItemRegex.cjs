const testCollections = [
  'rare-friends-genesis',
  'chainraiders',
  'laughingsighfox'
];

async function testItemLinkExtraction() {
  for (const slug of testCollections) {
    const res = await fetch(`https://opensea.io/collection/${slug}/overview`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      }
    });
    const html = await res.text();
    
    // Priority 1: Match item link /item/<chain>/<0x...>/
    const itemMatch = html.match(/\/item\/([a-z0-9-_]+)\/(0x[a-fA-F0-9]{40})/i);
    
    // Priority 2: Match asset /assets/<chain>/<0x...>/
    const assetMatch = html.match(/\/assets\/([a-z0-9-_]+)\/(0x[a-fA-F0-9]{40})/i);

    // Relay chain match
    const relayChainMatch = html.match(/"chain":\{[^}]*"identifier":"([^"]+)"/i);

    console.log(`\n=== Collection: ${slug} ===`);
    console.log('Item link match:', itemMatch ? `${itemMatch[1]} -> ${itemMatch[2]}` : 'NONE');
    console.log('Asset link match:', assetMatch ? `${assetMatch[1]} -> ${assetMatch[2]}` : 'NONE');
    console.log('Relay chain:', relayChainMatch ? relayChainMatch[1] : 'NONE');
  }
}

testItemLinkExtraction().catch(console.error);
