const slugs = [
  'chainraiders',
  'laughingsighfox'
];

async function testAll() {
  for (const slug of slugs) {
    const res = await fetch(`https://opensea.io/collection/${slug}/overview`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const html = await res.text();
    
    // Test extraction methods
    // Method 1: Relay GraphQL chain identifier
    const m1 = html.match(/"chain":\{[^}]*"identifier":"([^"]+)"/i);
    // Method 2: Relay GraphQL chainIdentifier
    const m2 = html.match(/"chainIdentifier":"([^"]+)"/i);
    // Method 3: Direct chain object {"identifier":"..."}
    const m3 = html.match(/"chain":\{"identifier":"([^"]+)"/i);

    const detected = m1 ? m1[1] : (m2 ? m2[1] : (m3 ? m3[1] : null));
    console.log(`${slug} => detected chain: "${detected}"`);
  }
}

testAll();
