const testCollections = [
  'chainraiders',
  'laughingsighfox'
];

async function inspectOpenSeaChains() {
  for (const slug of testCollections) {
    console.log(`\n=================== INSPECTING: ${slug} ===================`);
    try {
      const res = await fetch(`https://opensea.io/collection/${slug}/overview`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        }
      });
      const html = await res.text();
      console.log('HTML length:', html.length);

      // Search for chain occurrences
      const chainMatches = [...html.matchAll(/"chain":\{[^}]+\}/g)].map(m => m[0]);
      console.log('Found "chain":{...} matches:', chainMatches.slice(0, 5));

      const chainPropMatches = [...html.matchAll(/"chain":"([^"]+)"/g)].map(m => m[1]);
      console.log('Found "chain":"..." matches:', [...new Set(chainPropMatches)]);

      const chainIdentifierMatches = [...html.matchAll(/"chainIdentifier":"([^"]+)"/g)].map(m => m[1]);
      console.log('Found "chainIdentifier":"..." matches:', [...new Set(chainIdentifierMatches)]);

      const chainNameMatches = [...html.matchAll(/"chainName":"([^"]+)"/g)].map(m => m[1]);
      console.log('Found "chainName":"..." matches:', [...new Set(chainNameMatches)]);

      // Check drop or collection chain
      const dropChainMatch = html.match(/"chain":\s*"([^"]+)"/i);
      console.log('Regex /"chain":\\s*"([^"]+)"/:', dropChainMatch ? dropChainMatch[1] : null);

      // Check chainraiders Robinhood chain or any other chain
      const allChainsInHtml = html.match(/"(ethereum|polygon|base|arbitrum|optimism|blast|zora|sei|avalanche|ronin|berachain|flow|b3|soneium|shape|unichain|abstract|gunz|hyperevm|somnia|monad|robinhood)"/gi);
      console.log('All known chain names in quotes:', [...new Set(allChainsInHtml || [])]);

    } catch (e) {
      console.error(e);
    }
  }
}

inspectOpenSeaChains();
