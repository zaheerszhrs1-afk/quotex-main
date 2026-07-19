'use client'
import { useEffect, useRef, useState } from 'react'
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts'
import { useStore } from '@/lib/store'
import { getSocket } from '@/lib/socketClient'
import BottomTabs from '@/components/trade/BottomTabs'
import TradeOpenNotice from '@/components/trade/TradeOpenNotice'
import ChartLoader from './ChartLoader'

const COLORS = {
  bg: '#0E1621',
  grid: 'rgba(255,255,255,0.075)',
  text: '#566273',
  up: '#00C076',
  down: '#FF6258',
  volUp: 'rgba(0,192,118,0.35)',
  volDown: 'rgba(255,98,88,0.35)',
  area: '#2F8FEE',
}

// Per-symbol zoom (bar spacing) so each asset remembers how far it was zoomed
// in, even across a page refresh.
const ZOOM_KEY = 'qx:zoom'
const DEFAULT_BAR_SPACING = 9
function loadZoom() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(ZOOM_KEY) || '{}') || {} } catch { return {} }
}
function saveZoom(map) {
  try { localStorage.setItem(ZOOM_KEY, JSON.stringify(map)) } catch {}
}

const TF_LIST = ['5s', '10s', '15s', '30s', '1m', '2m', '3m', '5m', '10m', '15m', '30m', '1h', '4h', '1d']
const TF_SECONDS = {
  '5s': 5, '10s': 10, '15s': 15, '30s': 30,
  '1m': 60, '2m': 120, '3m': 180, '5m': 300, '10m': 600,
  '15m': 900, '30m': 1800, '1h': 3600, '4h': 14400, '1d': 86400,
}
const CHART_TYPES = [
  { id: 'area', label: 'Area' },
  { id: 'candles', label: 'Candles' },
  { id: 'bars', label: 'Bars' },
]

// Drawing tools (pencil), like the real Quotex: brush, segment, trend line
// (ray), horizontal/vertical lines and rectangle, with color/width options.
// Drawings are stored in chart coordinates (logical bar index + price), so
// they pan/zoom together with the candles.
const DRAW_TOOLS = [
  { id: 'brush', label: 'Brush' },
  { id: 'line', label: 'Line' },
  { id: 'ray', label: 'Trend line' },
  { id: 'hline', label: 'Horizontal line' },
  { id: 'vline', label: 'Vertical line' },
  { id: 'rect', label: 'Rectangle' },
]
const DRAW_COLORS = ['#FFFFFF', '#2F8FEE', '#00C076', '#FF6258', '#F5B70A']
const DRAW_WIDTHS = [1, 2, 3]

function DrawIcon({ id }) {
  const c = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  if (id === 'brush') return <svg {...c}><path d="M3 17c4-8 7 4 11-5 2-4 5-5 7-4" /></svg>
  if (id === 'line') return <svg {...c}><path d="M5 19L19 5" /><circle cx="5" cy="19" r="1.6" fill="currentColor" /><circle cx="19" cy="5" r="1.6" fill="currentColor" /></svg>
  if (id === 'ray') return <svg {...c}><path d="M4 20L17 7M17 7h-5M17 7v5" /></svg>
  if (id === 'hline') return <svg {...c}><path d="M3 12h18" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>
  if (id === 'vline') return <svg {...c}><path d="M12 3v18" /><circle cx="12" cy="12" r="1.6" fill="currentColor" /></svg>
  if (id === 'rect') return <svg {...c}><rect x="4" y="7" width="16" height="10" rx="1" /></svg>
  // cursor (no tool)
  return <svg {...c}><path d="M5 3l14 9-6 1-3 6z" /></svg>
}

function TypeIcon({ id }) {
  const c = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 }
  if (id === 'area')
    return <svg {...c}><path d="M3 16l5-5 4 3 6-7" strokeLinecap="round" strokeLinejoin="round" /><path d="M3 16l5-5 4 3 6-7V20H3z" fill="currentColor" opacity="0.2" stroke="none" /></svg>
  if (id === 'bars')
    return <svg {...c}><path d="M7 4v16M7 8h4M7 14h4M17 4v16M17 7h-4M17 13h-4" strokeLinecap="round" /></svg>
  // candles
  return <svg {...c}><path d="M8 3v4M8 15v6M16 6v3M16 17v4" strokeLinecap="round" /><rect x="5.5" y="7" width="5" height="8" rx="1" /><rect x="13.5" y="9" width="5" height="8" rx="1" /></svg>
}

function fmtCountdown(r) {
  if (r >= 60) {
    const m = Math.floor(r / 60)
    const s = r % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }
  return `${r}s`
}

export default function CandlestickChart() {
  const containerRef = useRef(null)
  const chartRef = useRef(null)
  const mainRef = useRef(null)
  const lastTimeRef = useRef(0)
  const digitsRef = useRef(2)
  const tradeLinesRef = useRef(new Map())
  const cacheRef = useRef([]) // cached OHLC array for re-seeding on type switch
  const chartTypeRef = useRef('candles') // read inside stream closures (avoid stale type)
  const lastCloseRef = useRef(null) // latest close price, for positioning the countdown
  const targetRef = useRef(null) // latest forming candle from the server (animation target)
  const dispRef = useRef(null) // { time, close } currently displayed (eased toward target)
  const rafRef = useRef(0) // requestAnimationFrame id for the smoothing loop
  const zoomRef = useRef(null) // { symbol -> barSpacing }; lazily loaded from storage
  if (zoomRef.current === null) zoomRef.current = loadZoom()
  const symbolRef = useRef(null) // current symbol, read inside the zoom subscription

  const symbol = useStore((s) => s.activeSymbol)
  const timeframe = useStore((s) => s.timeframe)
  const setTimeframe = useStore((s) => s.setTimeframe)
  const openTrades = useStore((s) => s.openTrades)
  const flash = useStore((s) => s.flash)

  const [chartType, setChartType] = useState('candles')
  const [typeMenu, setTypeMenu] = useState(false)
  const [tfMenu, setTfMenu] = useState(false)
  const [toolbarOpen, setToolbarOpen] = useState(false) // mobile: ⋯ toggles the tool strip
  const [dealsOpen, setDealsOpen] = useState(false) // mobile: briefcase opens the open-trades sheet
  const [countdown, setCountdown] = useState(null) // { left, y } for the forming-candle timer
  const [loading, setLoading] = useState(true) // true until candle history arrives (pair/timeframe switch)
  const [ohlc, setOhlc] = useState(null) // OHLC legend — only shown while the crosshair is over a bar

  // ---- drawing tools state ----
  const drawCanvasRef = useRef(null)
  const drawingsRef = useRef([]) // committed drawings
  const draftRef = useRef(null) // drawing in progress
  const drawCfgRef = useRef({ tool: null, color: '#2F8FEE', width: 2 }) // read inside pointer handlers
  const [drawMenu, setDrawMenu] = useState(false)
  const [drawTool, setDrawTool] = useState(null)
  const [drawColor, setDrawColor] = useState('#2F8FEE')
  const [drawWidth, setDrawWidth] = useState(2)
  const [drawCount, setDrawCount] = useState(0) // mirrors drawingsRef.length for the menu buttons

  useEffect(() => {
    drawCfgRef.current = { tool: drawTool, color: drawColor, width: drawWidth }
  }, [drawTool, drawColor, drawWidth])

  // Esc deselects the active tool; Ctrl+Z undoes the last drawing
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setDrawTool(null)
        setDrawMenu(false)
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (drawingsRef.current.length) {
          e.preventDefault()
          drawingsRef.current.pop()
          setDrawCount(drawingsRef.current.length)
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ---- create chart once ----
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      layout: { background: { color: COLORS.bg }, textColor: COLORS.text, fontSize: 11, attributionLogo: false },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#5A6B83', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#2B3240' },
        horzLine: { color: '#5A6B83', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#2B3240' },
      },
      rightPriceScale: { borderColor: '#1B2435', scaleMargins: { top: 0.12, bottom: 0.12 } },
      timeScale: {
        borderColor: '#1B2435',
        timeVisible: true,
        secondsVisible: true,
        rightOffset: 10,
        barSpacing: 9,
        minBarSpacing: 1,
      },
    })
    chartRef.current = chart

    // OHLC legend: only while the crosshair is over a real bar (move or
    // touch-and-hold). Looked up in the cache so it works for every chart type.
    const onCrosshair = (param) => {
      const series = mainRef.current
      const bar =
        series && param?.time != null && param.point
          ? cacheRef.current.find((c) => c.time === param.time)
          : null
      setOhlc(bar ? { open: bar.open, high: bar.high, low: bar.low, close: bar.close } : null)
    }
    chart.subscribeCrosshairMove(onCrosshair)

    // remember the zoom (bar spacing) per symbol as the user zooms / pans
    let zoomSaveTimer = 0
    const onRange = () => {
      const sym = symbolRef.current
      const bs = chart.timeScale().options().barSpacing
      if (!sym || !bs || zoomRef.current[sym] === bs) return
      zoomRef.current[sym] = bs
      clearTimeout(zoomSaveTimer)
      zoomSaveTimer = setTimeout(() => saveZoom(zoomRef.current), 400)
    }
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRange)

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })
    })
    ro.observe(el)
    chart.applyOptions({ width: el.clientWidth, height: el.clientHeight })

    return () => {
      ro.disconnect()
      clearTimeout(zoomSaveTimer)
      chart.unsubscribeCrosshairMove(onCrosshair)
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRange)
      chart.remove()
      chartRef.current = null
      mainRef.current = null
    }
  }, [])

  // ---- (re)create main series when chart type changes ----
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return
    chartTypeRef.current = chartType
    if (mainRef.current) {
      try { chart.removeSeries(mainRef.current) } catch {}
      mainRef.current = null
      tradeLinesRef.current.clear()
    }
    const d = digitsRef.current
    const priceFormat = { type: 'price', precision: d, minMove: Math.pow(10, -d) }
    let series
    if (chartType === 'area') {
      series = chart.addAreaSeries({
        lineColor: COLORS.area,
        topColor: 'rgba(47,143,238,0.4)',
        bottomColor: 'rgba(47,143,238,0.02)',
        lineWidth: 2,
        priceFormat,
        priceLineVisible: true,
        priceLineStyle: LineStyle.Dashed,
      })
    } else if (chartType === 'bars') {
      series = chart.addBarSeries({ upColor: COLORS.up, downColor: COLORS.down, priceFormat, priceLineVisible: true })
    } else {
      series = chart.addCandlestickSeries({
        upColor: COLORS.up, downColor: COLORS.down,
        borderUpColor: COLORS.up, borderDownColor: COLORS.down,
        wickUpColor: COLORS.up, wickDownColor: COLORS.down,
        priceFormat, priceLineVisible: true, priceLineStyle: LineStyle.Dashed, priceLineColor: '#7E8A99',
      })
    }
    mainRef.current = series
    if (cacheRef.current.length) series.setData(toSeriesData(cacheRef.current, chartType))
    redrawTradeLines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartType])

  // ---- drawing canvas: sizing + continuous redraw -------------------------
  useEffect(() => {
    const el = containerRef.current
    const canvas = drawCanvasRef.current
    if (!el || !canvas) return
    const dpr = window.devicePixelRatio || 1
    const resize = () => {
      canvas.width = el.clientWidth * dpr
      canvas.height = el.clientHeight * dpr
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(el)

    const ctx = canvas.getContext('2d')
    const toPx = (pt) => {
      const chart = chartRef.current
      const series = mainRef.current
      if (!chart || !series) return null
      const x = chart.timeScale().logicalToCoordinate(pt.logical)
      const y = series.priceToCoordinate(pt.price)
      if (x == null || y == null) return null
      return { x, y }
    }
    const render = (d, w, h) => {
      ctx.strokeStyle = d.color
      ctx.lineWidth = d.width
      ctx.lineJoin = 'round'
      ctx.lineCap = 'round'
      ctx.beginPath()
      if (d.tool === 'brush') {
        let started = false
        for (const pt of d.pts) {
          const p = toPx(pt)
          if (!p) continue
          if (!started) {
            ctx.moveTo(p.x, p.y)
            started = true
          } else ctx.lineTo(p.x, p.y)
        }
      } else if (d.tool === 'hline') {
        const y = mainRef.current?.priceToCoordinate(d.price)
        if (y == null) return
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
      } else if (d.tool === 'vline') {
        const x = chartRef.current?.timeScale().logicalToCoordinate(d.logical)
        if (x == null) return
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
      } else {
        const a = toPx(d.p1)
        const b = toPx(d.p2)
        if (!a || !b) return
        if (d.tool === 'rect') {
          ctx.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y))
        } else if (d.tool === 'ray') {
          // extend through the second point to the canvas edge
          const dx = b.x - a.x
          const dy = b.y - a.y
          const f = (w + h) / (Math.hypot(dx, dy) || 1)
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x + dx * f, b.y + dy * f)
        } else {
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
        }
      }
      ctx.stroke()
    }
    let raf
    const loop = () => {
      raf = requestAnimationFrame(loop)
      const w = el.clientWidth
      const h = el.clientHeight
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      if (!drawingsRef.current.length && !draftRef.current) return
      for (const d of drawingsRef.current) render(d, w, h)
      if (draftRef.current) render(draftRef.current, w, h)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(raf)
    }
  }, [])

  // ---- drawing pointer handlers --------------------------------------------
  function evtPoint(e) {
    const canvas = drawCanvasRef.current
    const chart = chartRef.current
    const series = mainRef.current
    if (!canvas || !chart || !series) return null
    const rect = canvas.getBoundingClientRect()
    const logical = chart.timeScale().coordinateToLogical(e.clientX - rect.left)
    const price = series.coordinateToPrice(e.clientY - rect.top)
    if (logical == null || price == null) return null
    return { logical, price }
  }
  function onDrawStart(e) {
    const { tool, color, width } = drawCfgRef.current
    if (!tool) return
    const p = evtPoint(e)
    if (!p) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    if (tool === 'hline' || tool === 'vline') {
      // single click places the line
      drawingsRef.current.push({ tool, color, width, price: p.price, logical: p.logical })
      setDrawCount(drawingsRef.current.length)
      return
    }
    draftRef.current =
      tool === 'brush' ? { tool, color, width, pts: [p] } : { tool, color, width, p1: p, p2: p }
  }
  function onDrawMove(e) {
    const d = draftRef.current
    if (!d) return
    const p = evtPoint(e)
    if (!p) return
    if (d.tool === 'brush') d.pts.push(p)
    else d.p2 = p
  }
  function onDrawEnd() {
    const d = draftRef.current
    if (!d) return
    draftRef.current = null
    const moved =
      d.tool === 'brush'
        ? d.pts.length > 1
        : d.p1.logical !== d.p2.logical || d.p1.price !== d.p2.price
    if (moved) {
      drawingsRef.current.push(d)
      setDrawCount(drawingsRef.current.length)
    }
  }
  function undoDrawing() {
    drawingsRef.current.pop()
    setDrawCount(drawingsRef.current.length)
  }
  function clearDrawings() {
    drawingsRef.current = []
    draftRef.current = null
    setDrawCount(0)
  }

  function toSeriesData(arr, type) {
    if (type === 'area') return arr.map((c) => ({ time: c.time, value: c.close }))
    return arr.map((c) => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }))
  }
  function oneBar(c, type) {
    return type === 'area'
      ? { time: c.time, value: c.close }
      : { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close }
  }

  function redrawTradeLines() {
    const series = mainRef.current
    if (!series) return
    const lines = tradeLinesRef.current
    const { activeSymbol, openTrades: trades } = useStore.getState()
    const activeIds = new Set()
    for (const t of trades) {
      if (t.symbol !== activeSymbol) continue
      activeIds.add(t.id)
      if (!lines.has(t.id)) {
        const line = series.createPriceLine({
          price: t.openPrice,
          color: t.direction === 'up' ? COLORS.up : COLORS.down,
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: `${t.direction === 'up' ? '▲' : '▼'} $${t.amount}`,
        })
        lines.set(t.id, line)
      }
    }
    for (const [id, line] of lines) {
      if (!activeIds.has(id)) {
        try { series.removePriceLine(line) } catch {}
        lines.delete(id)
      }
    }
  }

  // ---- subscribe to stream ----
  useEffect(() => {
    let sock
    let active = true
    let loaderTimer = 0
    let lastTickAt = Date.now()
    let staleLoading = false
    lastTimeRef.current = 0
    symbolRef.current = symbol // keep the zoom subscription pointed at this symbol
    setLoading(true) // show the chart loader until fresh history arrives
    const loaderStart = Date.now()
    const MIN_LOADER_MS = 600 // keep it visible long enough to read, even when history is cached (e.g. seconds timeframes)
    // drawings are anchored to bar indices, which shift when the series
    // reloads — clear them when switching pair/timeframe
    drawingsRef.current = []
    draftRef.current = null
    setDrawCount(0)

    function applyDigits(d) {
      digitsRef.current = d
      mainRef.current?.applyOptions({ priceFormat: { type: 'price', precision: d, minMove: Math.pow(10, -d) } })
    }
    function onHistory(s) {
      if (!active || s.symbol !== symbol || s.timeframe !== timeframe) return
      lastTickAt = Date.now()
      if (staleLoading) staleLoading = false
      applyDigits(s.digits)
      const arr = s.candles.slice()
      if (s.forming) arr.push(s.forming)
      cacheRef.current = arr
      mainRef.current?.setData(toSeriesData(arr, chartTypeRef.current))
      const last = arr.length ? arr[arr.length - 1] : null
      lastTimeRef.current = last ? last.time : 0
      lastCloseRef.current = last ? last.close : null
      targetRef.current = last
      dispRef.current = last ? { time: last.time, close: last.close } : null
      // restore this symbol's saved zoom (bar spacing), else use the default
      chartRef.current?.timeScale().applyOptions({ barSpacing: zoomRef.current[symbol] || DEFAULT_BAR_SPACING })
      chartRef.current?.timeScale().scrollToRealTime()
      const elapsed = Date.now() - loaderStart
      if (elapsed >= MIN_LOADER_MS) setLoading(false)
      else {
        clearTimeout(loaderTimer)
        loaderTimer = setTimeout(() => active && setLoading(false), MIN_LOADER_MS - elapsed)
      }
    }
    function onCandle(p) {
      if (!active || p.symbol !== symbol || p.tf !== timeframe) return
      lastTickAt = Date.now()
      if (staleLoading) { staleLoading = false; setLoading(false) }
      const c = p.candle
      if (c.time < lastTimeRef.current) return
      // keep cache in sync (replace last or append)
      const cache = cacheRef.current
      const isNewBar = !(cache.length && cache[cache.length - 1].time === c.time)
      if (isNewBar) {
        // finalize the bar that just closed at its exact OHLC, then ease the new one from its open
        if (cache.length) mainRef.current?.update(oneBar(cache[cache.length - 1], chartTypeRef.current))
        cache.push(c)
        dispRef.current = { time: c.time, close: c.open }
      } else {
        cache[cache.length - 1] = c
      }
      // the smoothing loop renders the bar; just record the target here
      targetRef.current = c
      lastTimeRef.current = c.time
      if (p.closed) {
        // snap to the final value so the closed candle is exact
        dispRef.current = { time: c.time, close: c.close }
        mainRef.current?.update(oneBar(c, chartTypeRef.current))
        lastCloseRef.current = c.close
      }
    }

    // ---- smoothing loop: ease the forming candle toward the latest target ----
    // Speed scales with timeframe: 5s glides fast, 10s slower, 30s slower still, etc.
    const tfSec = TF_SECONDS[timeframe] || 60
    const SMOOTH = Math.min(0.3, Math.max(0.05, 0.6 / Math.sqrt(tfSec))) // ~0.27@5s, 0.19@10s, 0.11@30s, 0.08@1m
    function animate() {
      rafRef.current = requestAnimationFrame(animate)
      const t = targetRef.current
      const series = mainRef.current
      if (!t || !series) return
      let d = dispRef.current
      if (!d || d.time !== t.time) {
        d = { time: t.time, close: t.open }
        dispRef.current = d
      }
      const eps = (Math.abs(t.close) || 1) * 1e-6
      const next = d.close + (t.close - d.close) * SMOOTH
      // snap instantly on a big gap (e.g. switching real<->simulated data source)
      // so we never ease across it and draw one tall bridging candle
      const bigGap = Math.abs(t.close - d.close) > (Math.abs(t.close) || 1) * 0.02
      d.close = bigGap || Math.abs(t.close - next) <= eps ? t.close : next
      const high = Math.max(t.high, d.close)
      const low = Math.min(t.low, d.close)
      series.update(
        chartTypeRef.current === 'area'
          ? { time: t.time, value: d.close }
          : { time: t.time, open: t.open, high, low, close: d.close }
      )
      lastCloseRef.current = d.close
    }
    rafRef.current = requestAnimationFrame(animate)

    // admin switched this asset's data source (real <-> simulated): wipe the chart
    // completely, show the loader, and re-request fresh history so old candles and
    // any bridging line vanish.
    function onReset(d) {
      if (!active || (d && d.symbol && d.symbol !== symbol)) return
      clearTimeout(loaderTimer)
      lastTickAt = Date.now()
      setLoading(true)
      cacheRef.current = []
      lastTimeRef.current = 0
      targetRef.current = null
      dispRef.current = null
      lastCloseRef.current = null
      mainRef.current?.setData([])
      if (d?.loading) return
      if (sock) sock.emit('subscribe', { symbol, timeframe })
    }

    // network drop -> show the chart loader so the user sees "loading" instead
    // of a silently frozen candle. On reconnect, re-subscribe; the loader stays
    // visible until fresh history arrives.
    function onDisconnect() {
      if (!active) return
      clearTimeout(loaderTimer)
      setLoading(true)
    }
    function onReconnect() {
      if (!active) return
      sock?.emit('subscribe', { symbol, timeframe })
    }

    // stale guard: if the socket looks "connected" but no tick has arrived in
    // 8s (silent NAT/proxy drop), show the loader until data resumes.
    const STALE_MS = 8000
    const staleTimer = setInterval(() => {
      if (!active) return
      if (Date.now() - lastTickAt > STALE_MS && !staleLoading) {
        staleLoading = true
        setLoading(true)
      }
    }, 2000)

    getSocket().then((s) => {
      if (!active) return
      sock = s
      s.on('history', onHistory)
      s.on('candle', onCandle)
      s.on('chart_reset', onReset)
      s.on('disconnect', onDisconnect)
      s.on('connect', onReconnect)
      s.emit('subscribe', { symbol, timeframe })
    })
    return () => {
      active = false
      clearTimeout(loaderTimer)
      clearInterval(staleTimer)
      cancelAnimationFrame(rafRef.current)
      if (sock) {
        sock.emit('unsubscribe', { symbol, timeframe })
        sock.off('history', onHistory)
        sock.off('candle', onCandle)
        sock.off('chart_reset', onReset)
        sock.off('disconnect', onDisconnect)
        sock.off('connect', onReconnect)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe])

  // ---- trade open lines ----
  useEffect(() => {
    redrawTradeLines()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTrades, symbol])

  // ---- forming-candle countdown timer ----
  useEffect(() => {
    const tf = TF_SECONDS[timeframe] || 60
    const tick = () => {
      const nowSec = Date.now() / 1000
      const left = Math.max(0, Math.ceil(Math.ceil(nowSec / tf) * tf - nowSec))
      const series = mainRef.current
      const price = lastCloseRef.current
      let y = null
      if (series && price != null) {
        const c = series.priceToCoordinate(price)
        if (c != null) y = c
      }
      setCountdown(y == null ? null : { left, y })
    }
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeframe])

  function zoom(factor) {
    const ts = chartRef.current?.timeScale()
    if (!ts) return
    const cur = ts.options().barSpacing || 9
    ts.applyOptions({ barSpacing: Math.min(60, Math.max(2, cur * factor)) })
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={containerRef} className="h-full w-full" />

      {/* green "Trade opened" banner (slides down from top) */}
      <TradeOpenNotice />

      {/* buyers/sellers sentiment gauge (left edge, desktop) */}
      <SentimentBar />

      {/* OHLC legend — follows the crosshair, otherwise shows the latest bar */}
      {ohlc && (
        <div className="pointer-events-none absolute bottom-10 left-14 z-10 select-none text-[11px] font-semibold leading-snug md:bottom-12 md:left-24">
          {[
            ['Open', ohlc.open],
            ['Close', ohlc.close],
            ['High', ohlc.high],
            ['Low', ohlc.low],
          ].map(([label, value]) => (
            <div key={label} className="flex gap-2">
              <span className="w-10 text-qx-textDim">{label}:</span>
              <span className="tabular-nums text-white">
                {value == null ? '—' : Number(value).toFixed(digitsRef.current)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* loading overlay while candle history streams in */}
      {loading && <ChartLoader />}

      {/* drawing layer — transparent until a pencil tool is active */}
      <canvas
        ref={drawCanvasRef}
        className={`absolute inset-0 z-20 h-full w-full ${drawTool ? 'cursor-crosshair' : 'pointer-events-none'}`}
        style={drawTool ? { touchAction: 'none' } : undefined}
        onPointerDown={onDrawStart}
        onPointerMove={onDrawMove}
        onPointerUp={onDrawEnd}
        onPointerCancel={onDrawEnd}
      />

      {/* left vertical toolbar. On desktop it sits in the lower-left like the
          real terminal (inset to clear the sentiment bar at the edge); on mobile
          it stays at the top, unchanged. */}
      <div className="absolute left-2 top-5 z-30 flex flex-col gap-2 md:left-8 md:top-auto md:bottom-16">
        {/* ⋯ toggle — opens the tool strip (mobile); strip is always shown on md+ */}
        <button
          onClick={() => { setToolbarOpen((o) => !o); setTfMenu(false); setTypeMenu(false); setDealsOpen(false) }}
          className={`relative flex h-9 w-9 items-center justify-center rounded-lg shadow-panel backdrop-blur-sm transition md:hidden ${toolbarOpen ? 'bg-[#2F8FEE] text-white' : 'bg-qx-panel2/70 text-white/85'}`}
          aria-label="Tools"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></svg>
          {toolbarOpen && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-qx-panel text-[10px] text-white shadow-panel">✕</span>
          )}
        </button>

        {/* briefcase — open trades; hidden while the tool strip is open */}
        {!toolbarOpen && (
          <button
            onClick={() => setDealsOpen((o) => !o)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-lg shadow-panel backdrop-blur-sm transition md:hidden ${dealsOpen ? 'bg-[#2F8FEE] text-white' : 'bg-qx-panel2/70 text-white/85'}`}
            aria-label="Open trades"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="7" width="18" height="13" rx="2" /><path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" />
            </svg>
            {dealsOpen ? (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-qx-panel text-[10px] text-white shadow-panel">✕</span>
            ) : (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2F8FEE] px-1 text-[10px] font-bold text-white">{openTrades.length}</span>
            )}
          </button>
        )}

        <div className={`flex-col gap-2 ${toolbarOpen ? 'flex' : 'hidden'} md:flex`}>
          <ToolBtn
            title="Draw"
            active={drawMenu || !!drawTool}
            onClick={() => { setDrawMenu((m) => !m); setTfMenu(false); setTypeMenu(false) }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </ToolBtn>

          {/* timeframe marker */}
          <button
            onClick={() => { setTfMenu((m) => !m); setTypeMenu(false) }}
            className="flex h-9 min-w-9 items-center justify-center rounded-lg bg-white px-2 text-xs font-bold text-qx-bg shadow-panel transition hover:brightness-95"
          >
            {timeframe}
          </button>

          {/* chart type */}
          <ToolBtn title="Chart type" active={typeMenu} onClick={() => { setTypeMenu((m) => !m); setTfMenu(false) }}>
            <TypeIcon id={chartType} />
          </ToolBtn>
        </div>

        {/* drawing tools menu */}
        <div
          className={`absolute left-12 top-0 z-40 md:top-auto md:bottom-0 max-h-[340px] w-48 origin-top-left md:origin-bottom-left overflow-y-auto rounded-xl border border-qx-border bg-qx-panel p-2 shadow-panel transition-all duration-200 ease-out ${
            drawMenu ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
          }`}
        >
          <button
            onClick={() => { setDrawTool(null); setDrawMenu(false) }}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${!drawTool ? 'bg-qx-panel2 text-white' : 'text-qx-textDim hover:bg-qx-panel2/60 hover:text-white'}`}
          >
            <DrawIcon id="cursor" />
            Cursor
          </button>
          {DRAW_TOOLS.map((t) => (
            <button
              key={t.id}
              onClick={() => { setDrawTool(t.id); setDrawMenu(false) }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                drawTool === t.id ? 'bg-qx-panel2 text-white' : 'text-qx-textDim hover:bg-qx-panel2/60 hover:text-white'
              }`}
            >
              <DrawIcon id={t.id} />
              {t.label}
            </button>
          ))}

          <div className="my-2 border-t border-qx-border" />
          {/* color + width */}
          <div className="flex items-center justify-between px-2 py-1.5">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setDrawColor(c)}
                className={`h-5 w-5 rounded-full border-2 ${drawColor === c ? 'border-white' : 'border-transparent'}`}
                style={{ background: c }}
                title={c}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5 px-2 py-1.5">
            {DRAW_WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setDrawWidth(w)}
                className={`flex h-7 flex-1 items-center justify-center rounded-md transition ${drawWidth === w ? 'bg-qx-panel2' : 'hover:bg-qx-panel2/60'}`}
                title={`${w}px`}
              >
                <span className="w-5 rounded-full bg-white" style={{ height: w }} />
              </button>
            ))}
          </div>

          <div className="my-2 border-t border-qx-border" />
          <button
            onClick={undoDrawing}
            disabled={!drawCount}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-qx-textDim transition enabled:hover:bg-qx-panel2/60 enabled:hover:text-white disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Undo
          </button>
          <button
            onClick={() => { clearDrawings(); setDrawMenu(false) }}
            disabled={!drawCount}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-qx-red transition enabled:hover:bg-qx-panel2/60 disabled:opacity-40"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Delete all
          </button>
        </div>

        {/* menus — anchored to the top of the chart beside the strip so they never collide with the trade panel */}
        <div
          className={`absolute left-12 top-0 z-40 md:top-auto md:bottom-0 max-h-[240px] w-44 origin-top-left md:origin-bottom-left overflow-y-auto rounded-xl border border-qx-border bg-qx-panel p-2 shadow-panel transition-all duration-200 ease-out ${
            tfMenu ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
          }`}
        >
          <div className="grid grid-cols-3 gap-1.5">
            {TF_LIST.map((tf) => (
              <button key={tf} onClick={() => { setTimeframe(tf); setTfMenu(false) }}
                className={`rounded-lg py-2 text-sm font-semibold transition ${tf === timeframe ? 'bg-white text-qx-bg' : 'bg-qx-panel2 text-qx-textDim hover:text-white'}`}>
                {tf}
              </button>
            ))}
          </div>
        </div>

        <div
          className={`absolute left-12 top-0 z-40 md:top-auto md:bottom-0 max-h-[240px] w-44 origin-top-left md:origin-bottom-left overflow-y-auto rounded-xl border border-qx-border bg-qx-panel p-1.5 shadow-panel transition-all duration-200 ease-out ${
            typeMenu ? 'scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
          }`}
        >
          {CHART_TYPES.map((o) => (
            <button key={o.id} onClick={() => { setChartType(o.id); setTypeMenu(false) }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition ${chartType === o.id ? 'bg-qx-panel2 text-white' : 'text-qx-textDim hover:bg-qx-panel2/60 hover:text-white'}`}>
              <TypeIcon id={o.id} />
              {o.label}
            </button>
          ))}
          <button disabled className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-qx-textMute">
            <TypeIcon id="candles" />
            Heiken Ashi
          </button>
        </div>
      </div>

      {/* drawing quick controls — always visible while drawing / drawings exist */}
      {(drawTool || drawCount > 0) && (
        <div className="absolute left-1/2 top-2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-lg bg-qx-panel/95 p-1 shadow-panel md:top-[72px]">
          <button
            onClick={undoDrawing}
            disabled={!drawCount}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-white transition enabled:hover:bg-qx-panel2 disabled:opacity-40"
            title="Undo (Ctrl+Z)"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Undo
          </button>
          <button
            onClick={clearDrawings}
            disabled={!drawCount}
            className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-semibold text-qx-red transition enabled:hover:bg-qx-panel2 disabled:opacity-40"
            title="Delete all drawings"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Clear
          </button>
          {drawTool && (
            <button
              onClick={() => { setDrawTool(null); setDrawMenu(false) }}
              className="flex h-8 items-center gap-1.5 rounded-md bg-[#2F8FEE] px-2.5 text-xs font-bold text-white transition hover:brightness-110"
              title="Stop drawing (Esc)"
            >
              Done
            </button>
          )}
        </div>
      )}

      {/* zoom buttons (bottom center) */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1">
        <button onClick={() => zoom(0.8)} className="flex h-8 w-8 items-center justify-center rounded bg-qx-panel2 text-lg text-white hover:bg-qx-border">−</button>
        <button onClick={() => zoom(1.25)} className="flex h-8 w-8 items-center justify-center rounded bg-qx-panel2 text-lg text-white hover:bg-qx-border">+</button>
      </div>

      {/* forming-candle countdown — pinned to the right at current price */}
      {countdown && (
        <div
          className="pointer-events-none absolute right-[68px] z-10 -translate-y-1/2"
          style={{ top: countdown.y }}
        >
          <span
            className={`rounded px-1.5 py-0.5 text-xs font-bold tabular-nums shadow-panel ${
              countdown.left <= 5 ? 'bg-qx-red text-white' : 'bg-qx-panel2 text-white'
            }`}
          >
            {fmtCountdown(countdown.left)}
          </span>
        </div>
      )}

      {flash && (
        <div key={flash.ts} className={`pointer-events-none absolute inset-0 ${flash.type === 'win' ? 'animate-flashGreen' : 'animate-flashRed'}`} />
      )}

      {/* open-trades sheet (briefcase) */}
      {dealsOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setDealsOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 flex max-h-[75%] flex-col rounded-t-2xl bg-qx-panel p-3 pt-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="text-base font-bold text-white">Trades</span>
              <button onClick={() => setDealsOpen(false)} className="text-xl text-qx-textDim hover:text-white">✕</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <BottomTabs />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ToolBtn({ children, title, active, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`flex h-9 w-9 items-center justify-center rounded-lg shadow-panel backdrop-blur-sm transition ${
        active ? 'bg-white text-qx-bg' : 'bg-qx-panel2/70 text-white/85 hover:bg-qx-panel2 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

// Buyers/sellers sentiment gauge pinned to the left edge of the chart (desktop):
// red (down) on top, green (up) on the bottom, with the split drifting over time
// like the real terminal. Pure UI — no real order-flow data behind it.
function SentimentBar() {
  const [up, setUp] = useState(57) // % of green (buyers)
  useEffect(() => {
    const id = setInterval(() => {
      setUp((g) => {
        const next = g + (Math.random() - 0.5) * 9
        return Math.round(Math.max(6, Math.min(94, next)))
      })
    }, 2500)
    return () => clearInterval(id)
  }, [])
  const down = 100 - up
  return (
    <div className="pointer-events-none absolute bottom-12 left-1 top-20 z-10 hidden flex-col items-center md:flex">
      <span className="mb-1.5 text-[11px] font-bold tabular-nums text-qx-red drop-shadow">{down}%</span>
      <div className="relative w-1.5 flex-1 overflow-hidden rounded-full bg-qx-red/90">
        <div
          className="absolute inset-x-0 bottom-0 rounded-full bg-qx-green transition-[height] duration-700 ease-out"
          style={{ height: `${up}%` }}
        />
      </div>
      <span className="mt-1.5 text-[11px] font-bold tabular-nums text-qx-green drop-shadow">{up}%</span>
    </div>
  )
}
