async function inspectLocation() {
  const url = `https://opensea.io/collection/rare-friends-genesis/overview`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    }
  });

  const html = await res.text();
  const target = '116eaa62241751e0c98da43d458600c6c17cd361';
  
  let pos = 0;
  while (true) {
    const idx = html.toLowerCase().indexOf(target, pos);
    if (idx === -1) break;
    console.log(`\nFound at index ${idx}:`);
    console.log(html.substring(Math.max(0, idx - 150), Math.min(html.length, idx + 200)));
    pos = idx + target.length;
  }
}

inspectLocation().catch(console.error);
