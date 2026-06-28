export const ASSETS = [
  { symbol: "SPY", name: "S&P 500 ETF", group: "米国株・指数", dataSymbol: "spy.us", basePrice: 545 },
  { symbol: "QQQ", name: "Nasdaq 100 ETF", group: "米国株・指数", dataSymbol: "qqq.us", basePrice: 480 },
  { symbol: "DIA", name: "Dow Jones ETF", group: "米国株・指数", dataSymbol: "dia.us", basePrice: 390 },
  { symbol: "IWM", name: "Russell 2000 ETF", group: "米国株・指数", dataSymbol: "iwm.us", basePrice: 205 },
  { symbol: "NVDA", name: "NVIDIA", group: "米国株・指数", dataSymbol: "nvda.us", basePrice: 125 },
  { symbol: "AAPL", name: "Apple", group: "米国株・指数", dataSymbol: "aapl.us", basePrice: 210 },
  { symbol: "MSFT", name: "Microsoft", group: "米国株・指数", dataSymbol: "msft.us", basePrice: 440 },
  { symbol: "EURUSD", name: "Euro / US Dollar", group: "FX", dataSymbol: "eurusd", basePrice: 1.08 },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen", group: "FX", dataSymbol: "usdjpy", basePrice: 157 },
  { symbol: "GBPUSD", name: "British Pound / US Dollar", group: "FX", dataSymbol: "gbpusd", basePrice: 1.27 },
  { symbol: "AUDUSD", name: "Australian Dollar / US Dollar", group: "FX", dataSymbol: "audusd", basePrice: 0.66 },
  { symbol: "XAUUSD", name: "Gold / US Dollar", group: "貴金属", dataSymbol: "xauusd", basePrice: 2320 },
  { symbol: "XAGUSD", name: "Silver / US Dollar", group: "貴金属", dataSymbol: "xagusd", basePrice: 29 },
  { symbol: "XPTUSD", name: "Platinum / US Dollar", group: "貴金属", dataSymbol: "xptusd", basePrice: 980 }
];

export function findAsset(symbol) {
  return ASSETS.find((asset) => asset.symbol === String(symbol || "").trim().toUpperCase());
}
