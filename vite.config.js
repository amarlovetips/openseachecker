import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'opensea-drop-proxy',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url.startsWith('/api/opensea-drop')) {
            const urlObj = new URL(req.url, 'http://localhost:5173');
            const slug = urlObj.searchParams.get('slug');
            if (!slug) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Missing slug' }));
              return;
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
              
              // 1. Extract Real Contract Address & Chain
              let contractAddress = null;
              let chainSlug = 'ethereum';

              // Item CDN match: /seadn.io/<chain>/0x<address>/
              const cdnItemMatch = html.match(/seadn\.io\/([a-z0-9-_]+)\/(0x[a-fA-F0-9]{40})\//i);
              if (cdnItemMatch) {
                const detected = cdnItemMatch[1].toLowerCase();
                if (detected !== 'collection' && detected !== 'profiles') {
                  chainSlug = detected;
                  contractAddress = cdnItemMatch[2];
                }
              }

              if (!contractAddress) {
                const cdnLogoMatch = html.match(/seadn\.io\/collection\/(0x[a-fA-F0-9]{40})\//i);
                if (cdnLogoMatch) contractAddress = cdnLogoMatch[1];
              }

              // Fallback contract lookup from HTML
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

              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({
                slug,
                name: name || slug.toUpperCase(),
                description,
                imageUrl,
                contractAddress: contractAddress || '0x03c993a0af31c953d98b22e2f1825a6ac191fcc1',
                chainSlug,
                stages,
                htmlLength: html.length
              }));
            } catch (err) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
          next();
        });
      }
    }
  ],
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    proxy: {
      '/api/opensea': {
        target: 'https://api.opensea.io',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opensea/, '/api'),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          'Accept': 'application/json',
        }
      }
    }
  },
})
