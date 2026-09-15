async function searchMinter() {
  const url = `https://opensea.io/collection/rare-friends-genesis/overview`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });
  const html = await res.text();

  // Search for minter or seadrop in html
  const minterMatches = [...html.matchAll(/"minter":\{[^}]+\}/gi)].map(m => m[0]);
  console.log('minter matches:', minterMatches);

  const dropStages = [...html.matchAll(/"stageType":"([^"]+)"/gi)].map(m => m[1]);
  console.log('drop stages types:', dropStages);

  // Check for feeRecipient or drop contract
  const feeRecipMatches = [...html.matchAll(/"feeRecipient":"([^"]+)"/gi)].map(m => m[1]);
  console.log('feeRecipient:', feeRecipMatches);

  // Check for creator
  const creatorMatches = [...html.matchAll(/"creator":\{[^}]+\}/gi)].map(m => m[0]);
  console.log('creator:', creatorMatches.slice(0, 3));
}

searchMinter().catch(console.error);
