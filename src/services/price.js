// Service to fetch live USD prices for cryptocurrencies

const DEFAULT_FALLBACK_PRICES = {
  ETH: 2500,
  POL: 0.35,
  MATIC: 0.35,
  BNB: 720,
  AVAX: 7.5,
  SEI: 0.05,
  APE: 0.13,
  RON: 1.2,
  FLOW: 0.5,
  BERA: 5.0,
  MON: 1.0,
  GUN: 0.1,
  HYPE: 15.0,
  STT: 0.2,
  CELO: 0.45,
  MNT: 0.75,
};

const SYMBOL_TO_BINANCE_PAIR = {
  ETH: 'ETHUSDT',
  POL: 'POLUSDT',
  MATIC: 'MATICUSDT',
  BNB: 'BNBUSDT',
  AVAX: 'AVAXUSDT',
  SEI: 'SEIUSDT',
  APE: 'APEUSDT',
  RON: 'RONINUSDT',
  FLOW: 'FLOWUSDT',
};

class PriceService {
  constructor() {
    this.priceCache = { ...DEFAULT_FALLBACK_PRICES };
    this.lastFetched = 0;
    this.fetchPromise = null;
    this.listeners = new Set();
    this.init();
  }

  init() {
    this.fetchAllPrices();
    // Refresh every 60 seconds
    if (typeof window !== 'undefined') {
      setInterval(() => this.fetchAllPrices(), 60000);
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach((cb) => {
      try { cb(this.priceCache); } catch(e) {}
    });
  }

  async fetchAllPrices() {
    const now = Date.now();
    if (now - this.lastFetched < 30000 && Object.keys(this.priceCache).length > 0) {
      return this.priceCache;
    }

    if (this.fetchPromise) return this.fetchPromise;

    this.fetchPromise = (async () => {
      try {
        const pairs = Object.entries(SYMBOL_TO_BINANCE_PAIR);
        await Promise.allSettled(
          pairs.map(async ([symbol, pair]) => {
            try {
              const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
              if (res.ok) {
                const data = await res.json();
                const p = parseFloat(data.price);
                if (!isNaN(p) && p > 0) {
                  this.priceCache[symbol] = p;
                }
              }
            } catch (err) {
              // Ignore individual failed pair, keep fallback
            }
          })
        );
        this.lastFetched = Date.now();
        this.notify();
      } catch (err) {
        console.warn("Could not refresh live crypto prices:", err.message);
      } finally {
        this.fetchPromise = null;
      }
      return this.priceCache;
    })();

    return this.fetchPromise;
  }

  getPrice(symbol = 'ETH') {
    const s = String(symbol).toUpperCase().trim();
    return this.priceCache[s] || DEFAULT_FALLBACK_PRICES[s] || DEFAULT_FALLBACK_PRICES.ETH || 2500;
  }

  formatUsd(amount, symbol = 'ETH') {
    const num = parseFloat(amount || 0);
    if (isNaN(num) || num === 0) return '$0.00';

    const price = this.getPrice(symbol);
    const totalUsd = num * price;

    if (totalUsd < 0.01) {
      return `< $0.01`;
    }
    return `$${totalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
}

export const priceService = new PriceService();
