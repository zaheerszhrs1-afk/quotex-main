'use client'
import { create } from 'zustand'

let toastId = 0

export const useStore = create((set, get) => ({
  // --- account ---
  me: null,
  accountType: 'demo',
  balance: { demoBalance: 0, realBalance: 0 },
  announcement: '',

  setMe: (me) =>
    set({
      me,
      balance: me
        ? { demoBalance: me.demoBalance, realBalance: me.realBalance }
        : { demoBalance: 0, realBalance: 0 },
    }),
  setAccountType: (accountType) => set({ accountType }),
  setBalance: (balance) => set({ balance }),
  setAnnouncement: (announcement) => set({ announcement }),

  // admin-controlled: show real TradingView charts on the user side (all assets)
  tradingView: false,
  setTradingView: (tradingView) => set({ tradingView }),

  currentBalance: () => {
    const { accountType, balance } = get()
    return accountType === 'real' ? balance.realBalance : balance.demoBalance
  },

  // --- assets / market ---
  assets: [],
  summary: {}, // symbol -> { price, changePct, payout, name, category }
  activeSymbol: 'EUR/USD',
  openSymbols: [], // asset pairs open as top tabs
  timeframe: '5s',
  favorites: [],

  setAssets: (assets) => set({ assets }),
  // restore several open tabs at once (used to rehydrate after a refresh)
  setOpenSymbols: (openSymbols, activeSymbol) =>
    set((st) => ({
      openSymbols,
      activeSymbol:
        activeSymbol && openSymbols.includes(activeSymbol)
          ? activeSymbol
          : openSymbols[openSymbols.length - 1] || st.activeSymbol,
    })),
  openSymbol: (sym) =>
    set((st) => ({
      openSymbols: st.openSymbols.includes(sym) ? st.openSymbols : [...st.openSymbols, sym],
      activeSymbol: sym,
    })),
  closeSymbol: (sym) =>
    set((st) => {
      if (st.openSymbols.length <= 1) return {} // always keep one tab
      const remaining = st.openSymbols.filter((s) => s !== sym)
      const activeSymbol =
        st.activeSymbol === sym ? remaining[remaining.length - 1] : st.activeSymbol
      return { openSymbols: remaining, activeSymbol }
    }),
  setSummary: (list) =>
    set(() => {
      const summary = {}
      for (const s of list) summary[s.symbol] = s
      return { summary }
    }),
  setActiveSymbol: (activeSymbol) => set({ activeSymbol }),
  setTimeframe: (timeframe) => set({ timeframe }),
  toggleFavorite: (symbol) =>
    set((st) => ({
      favorites: st.favorites.includes(symbol)
        ? st.favorites.filter((s) => s !== symbol)
        : [...st.favorites, symbol],
    })),

  // --- trades ---
  openTrades: [],
  history: [],
  setOpenTrades: (openTrades) => set({ openTrades }),
  setHistory: (history) => set({ history }),
  addOpenTrade: (t) => set((st) => ({ openTrades: [t, ...st.openTrades] })),
  resolveOpenTrade: (tradeId, closed) =>
    set((st) => {
      const open = st.openTrades.filter((t) => t.id !== tradeId)
      const historyEntry = {
        id: tradeId,
        symbol: closed.symbol,
        direction: closed.direction,
        amount: closed.amount,
        openPrice: closed.openPrice,
        closePrice: closed.closePrice,
        profit: closed.profit,
        status: closed.result === 'win' ? 'won' : 'lost',
        closeTime: new Date(),
        accountType: closed.accountType,
      }
      return { openTrades: open, history: [historyEntry, ...st.history].slice(0, 100) }
    }),

  // --- chart win/loss flash ---
  flash: null, // { type: 'win'|'loss', ts }
  triggerFlash: (type) => set({ flash: { type, ts: Date.now() } }),

  // --- toasts ---
  toasts: [],
  pushToast: (toast) =>
    set((st) => ({ toasts: [...st.toasts, { id: ++toastId, ...toast }] })),
  removeToast: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),

  // --- trade opened notice (green banner over chart) ---
  tradeNotice: null,
  setTradeNotice: (notice) => set({ tradeNotice: notice }),
  clearTradeNotice: () => set({ tradeNotice: null }),
}))
