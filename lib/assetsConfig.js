// Single source of truth for tradable assets — used by the price engine,
// the seed script, and as a fallback when the DB has no assets yet.
const ASSETS = [
  { symbol: 'EUR/USD', name: 'EUR/USD', category: 'Currencies', basePrice: 1.085, volatility: 0.0003, payout: 85, digits: 5 },
  { symbol: 'GBP/USD', name: 'GBP/USD', category: 'Currencies', basePrice: 1.267, volatility: 0.0004, payout: 82, digits: 5 },
  { symbol: 'USD/JPY', name: 'USD/JPY', category: 'Currencies', basePrice: 149.5, volatility: 0.05, payout: 80, digits: 3 },
  { symbol: 'AUD/USD', name: 'AUD/USD', category: 'Currencies', basePrice: 0.6580, volatility: 0.00025, payout: 81, digits: 5 },

  // OTC currency pairs (weekend / synthetic)
  { symbol: 'EUR/CHF (OTC)', name: 'EUR/CHF (OTC)', category: 'Currencies', basePrice: 0.9220, volatility: 0.00025, payout: 85, digits: 5 },
  { symbol: 'NZD/USD (OTC)', name: 'NZD/USD (OTC)', category: 'Currencies', basePrice: 0.6120, volatility: 0.00022, payout: 85, digits: 5 },
  { symbol: 'NZD/CHF (OTC)', name: 'NZD/CHF (OTC)', category: 'Currencies', basePrice: 0.5520, volatility: 0.00022, payout: 93, digits: 5 },
  { symbol: 'NZD/JPY (OTC)', name: 'NZD/JPY (OTC)', category: 'Currencies', basePrice: 92.15, volatility: 0.03, payout: 92, digits: 3 },
  { symbol: 'CAD/CHF (OTC)', name: 'CAD/CHF (OTC)', category: 'Currencies', basePrice: 0.6510, volatility: 0.00022, payout: 91, digits: 5 },
  { symbol: 'EUR/NZD (OTC)', name: 'EUR/NZD (OTC)', category: 'Currencies', basePrice: 1.7850, volatility: 0.0004, payout: 92, digits: 5 },
  { symbol: 'USD/MXN (OTC)', name: 'USD/MXN (OTC)', category: 'Currencies', basePrice: 17.05, volatility: 0.006, payout: 85, digits: 4 },
  { symbol: 'USD/BRL (OTC)', name: 'USD/BRL (OTC)', category: 'Currencies', basePrice: 5.05, volatility: 0.0022, payout: 92, digits: 4 },
  { symbol: 'USD/NGN (OTC)', name: 'USD/NGN (OTC)', category: 'Currencies', basePrice: 1450.0, volatility: 0.6, payout: 94, digits: 2 },
  { symbol: 'USD/IDR (OTC)', name: 'USD/IDR (OTC)', category: 'Currencies', basePrice: 15800.0, volatility: 4.0, payout: 91, digits: 1 },
  { symbol: 'USD/DZD (OTC)', name: 'USD/DZD (OTC)', category: 'Currencies', basePrice: 134.5, volatility: 0.04, payout: 90, digits: 3 },

  { symbol: 'BTC/USD', name: 'BTC/USD', category: 'Crypto', basePrice: 43250.0, volatility: 12.0, payout: 80, digits: 2 },
  { symbol: 'ETH/USD', name: 'ETH/USD', category: 'Crypto', basePrice: 2280.0, volatility: 1.0, payout: 78, digits: 2 },
  { symbol: 'Gold', name: 'Gold', category: 'Commodities', basePrice: 2024.5, volatility: 0.6, payout: 83, digits: 2 },
  { symbol: 'Oil', name: 'Oil', category: 'Commodities', basePrice: 78.4, volatility: 0.035, payout: 80, digits: 2 },
  { symbol: 'USCrude (OTC)', name: 'USCrude (OTC)', category: 'Commodities', basePrice: 78.4, volatility: 0.035, payout: 88, digits: 2 },

  // Stocks (synthetic / OTC) — simulated like every other asset
  { symbol: 'AAPL', name: 'Apple', category: 'Stocks', basePrice: 185.5, volatility: 0.08, payout: 80, digits: 2 },
  { symbol: 'TSLA', name: 'Tesla', category: 'Stocks', basePrice: 242.0, volatility: 0.10, payout: 82, digits: 2 },
  { symbol: 'AMZN', name: 'Amazon', category: 'Stocks', basePrice: 155.0, volatility: 0.09, payout: 80, digits: 2 },
  { symbol: 'GOOGL', name: 'Alphabet', category: 'Stocks', basePrice: 142.5, volatility: 0.06, payout: 79, digits: 2 },
  { symbol: 'MSFT', name: 'Microsoft', category: 'Stocks', basePrice: 378.0, volatility: 0.16, payout: 78, digits: 2 },
  { symbol: 'META', name: 'Meta', category: 'Stocks', basePrice: 352.0, volatility: 0.16, payout: 80, digits: 2 },
  { symbol: 'NFLX', name: 'Netflix', category: 'Stocks', basePrice: 485.0, volatility: 0.20, payout: 81, digits: 2 },
  { symbol: 'NVDA', name: 'Nvidia', category: 'Stocks', basePrice: 495.0, volatility: 0.22, payout: 80, digits: 2 },
]

const TIMEFRAMES = {
  '5s': 5, '10s': 10, '15s': 15, '30s': 30,
  '1m': 60, '2m': 120, '3m': 180, '5m': 300, '10m': 600,
  '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400,
}

module.exports = { ASSETS, TIMEFRAMES }
