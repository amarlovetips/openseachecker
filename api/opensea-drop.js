export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  try {
    const fetchRes = await fetch(`https://opensea.io/collection/${slug}/overview`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    const html = await fetchRes.text();

    // 1. Extract Real Chain (Accurate GraphQL Relay extraction)
    let chainSlug = null;

    // Priority A: OpenSea GraphQL Relay Chain Identifier
    const relayChainMatch = html.match(/"chain":\{[^}]*"identifier":"([^"]+)"/i);
    if (relayChainMatch) chainSlug = relayChainMatch[1].toLowerCase();

    // Priority B: Direct chainIdentifier
    if (!chainSlug) {
      const identMatch = html.match(/"chainIdentifier":"([^"]+)"/i);
      if (identMatch) chainSlug = identMatch[1].toLowerCase();
    }

    // Priority C: Collection chain name
    if (!chainSlug) {
      const chainNameMatch = html.match(/"chain":\{[^}]*"name":"([^"]+)"/i);
      if (chainNameMatch) chainSlug = chainNameMatch[1].toLowerCase();
    }

    // Priority D: Drop stage or direct chain property
    if (!chainSlug) {
      const directChainMatch = html.match(/"chain":"([a-z0-9-_]+)"/i);
      if (directChainMatch) chainSlug = directChainMatch[1].toLowerCase();
    }

    // Priority E: CDN image path match
    if (!chainSlug) {
      const cdnItemMatch = html.match(/seadn\.io\/([a-z0-9-_]+)\/(0x[a-fA-F0-9]{40})\//i);
      if (cdnItemMatch && cdnItemMatch[1] !== 'collection' && cdnItemMatch[1] !== 'profiles') {
        chainSlug = cdnItemMatch[1].toLowerCase();
      }
    }

    if (!chainSlug) {
      chainSlug = 'ethereum';
    }

    // 2. Extract Real Contract Address
    let contractAddress = null;

    // Priority A: Contract on the detected chain's CDN
    if (chainSlug) {
      const chainCdnMatch = html.match(new RegExp(`seadn\\.io\\/${chainSlug}\\/(0x[a-fA-F0-9]{40})`, 'i'));
      if (chainCdnMatch) contractAddress = chainCdnMatch[1];
    }

    // Priority B: Drop contractAddress
    if (!contractAddress) {
      const dropContractMatch = html.match(/"contractAddress":"(0x[a-fA-F0-9]{40})"/i);
      if (dropContractMatch) contractAddress = dropContractMatch[1];
    }

    // Priority C: Asset Contract address
    if (!contractAddress) {
      const assetContractMatch = html.match(/"assetContract":\{[^}]*"address":"(0x[a-fA-F0-9]{40})"/i);
      if (assetContractMatch) contractAddress = assetContractMatch[1];
    }

    // Priority D: Collection address
    if (!contractAddress) {
      const relayAddrMatch = html.match(/"address":"(0x[a-fA-F0-9]{40})"/i);
      if (relayAddrMatch) contractAddress = relayAddrMatch[1];
    }

    // Priority E: Fallback valid hex search
    if (!contractAddress) {
      const hexMatches = html.match(/0x[a-fA-F0-9]{40}/gi) || [];
      const validHex = hexMatches.filter(c => 
        c !== '0x0000000000000000000000000000000000000000' &&
        c.toLowerCase() !== '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2' &&
        c.toLowerCase() !== '0x0bd7d308f8e1639fab988df18a8011f41eacad73' &&
        c.toLowerCase() !== '0x82af49447d8a07e3bd95bd0d56f35241523fbab1' &&
        c.toLowerCase() !== '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619' &&
        c.toLowerCase() !== '0x4200000000000000000000000000000000000006'
      );
      if (validHex.length > 0) contractAddress = validHex[0];
    }

    // 2. Extract Collection Name & Description
    let name = '';
    const nameMatch = html.match(/"collection":\{[\s\S]*?"name":"([^"]+)"/);
    if (nameMatch) name = nameMatch[1];

    let description = '';
    const descMatch = html.match(/"description":"([^"]+)"/);
    if (descMatch) description = descMatch[1].replace(/\\n/g, ' ');

    // 3. Extract Image Logo
    let imageUrl = '';
    const imgMatch = html.match(/https:\/\/i2c\.seadn\.io\/collection\/[^\s"']+/);
    if (imgMatch) imageUrl = imgMatch[0].replace(/&quot;/g, '');

    // 4. Extract Real Drop Stages
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

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      slug,
      name: name || slug.toUpperCase(),
      description,
      imageUrl,
      contractAddress: contractAddress || '0x03c993a0af31c953d98b22e2f1825a6ac191fcc1',
      chainSlug,
      stages,
      htmlLength: html.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
