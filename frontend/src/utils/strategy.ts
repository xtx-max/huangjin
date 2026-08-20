// 策略实验室：信号生成与回测。严格执行时序因果——信号在 T 日收盘后计算，T+1 日生效，绝不引用未来数据。
export type StrategyKind = 'maCross' | 'momentum' | 'meanRev'

export interface StrategyConfig {
  kind: StrategyKind
  params: Record<string, number>
}

export interface StrategyResult {
  config: StrategyConfig
  signals: number[] // 长度 n；signals[t] 由 closes[0..t] 计算，作用于第 t+1 个交易日
  equity: number[] // 资金曲线（起点 1.0）
  annualReturn: number
  signalHitRate: number | null
  maxDrawdown: number
  trades: number
  lastSignal: number
  lastSignalDesc: string
}

function movingAverages(closes: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  let sum = 0
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i]
    if (i >= n) sum -= closes[i - n]
    if (i >= n - 1) out[i] = sum / n
  }
  return out
}

/** 按策略生成信号（严格因果） */
function computeSignals(closes: number[], cfg: StrategyConfig): number[] {
  const n = closes.length
  const signals: number[] = new Array(n).fill(0)
  if (cfg.kind === 'maCross') {
    const s = cfg.params.short
    const l = cfg.params.long
    const maS = movingAverages(closes, s)
    const maL = movingAverages(closes, l)
    for (let i = 0; i < n; i++) {
      if (maS[i] !== null && maL[i] !== null) {
        signals[i] = (maS[i] as number) > (maL[i] as number) ? 1 : -1
      }
    }
  } else if (cfg.kind === 'momentum') {
    const N = cfg.params.days
    const X = cfg.params.threshold
    for (let i = N; i < n; i++) {
      const ret = (closes[i] / closes[i - N] - 1) * 100
      signals[i] = ret > X ? 1 : ret < -X ? -1 : 0
    }
  } else {
    const N = cfg.params.days
    const Y = cfg.params.threshold
    const ma = movingAverages(closes, N)
    for (let i = N; i < n; i++) {
      const dev = (closes[i] / (ma[i] as number) - 1) * 100
      signals[i] = dev > Y ? -1 : dev < -Y ? 1 : 0
    }
  }
  return signals
}

/** 回测：signals[t-1] 决定第 t 日持仓收益 */
export function runStrategy(closes: number[], cfg: StrategyConfig): StrategyResult {
  const n = closes.length
  const signals = computeSignals(closes, cfg)
  const equity: number[] = new Array(n).fill(1)
  let hits = 0
  let sample = 0
  let trades = 0
  for (let t = 1; t < n; t++) {
    const dayRet = closes[t] / closes[t - 1] - 1
    equity[t] = equity[t - 1] * (1 + signals[t - 1] * dayRet)
    if (signals[t - 1] !== 0) {
      sample++
      if (Math.sign(dayRet) === Math.sign(signals[t - 1])) hits++
    }
    if (t >= 2 && signals[t - 1] !== signals[t - 2]) trades++
  }
  const annualReturn = (Math.pow(equity[n - 1], 252 / Math.max(1, n - 1)) - 1) * 100
  let peak = equity[0]
  let maxDD = 0
  for (const e of equity) {
    if (e > peak) peak = e
    const dd = (e / peak - 1) * 100
    if (dd < maxDD) maxDD = dd
  }
  const lastSignal = signals[n - 1]
  const desc = describeSignal(cfg, lastSignal)
  return {
    config: cfg,
    signals,
    equity,
    annualReturn,
    signalHitRate: sample > 0 ? (hits / sample) * 100 : null,
    maxDrawdown: maxDD,
    trades,
    lastSignal,
    lastSignalDesc: desc,
  }
}

function describeSignal(cfg: StrategyConfig, sig: number): string {
  const p = cfg.params
  if (cfg.kind === 'maCross') {
    const rel = sig > 0 ? '上穿/高于' : '下穿/低于'
    return `均线交叉（${p.short}/${p.long}）：当前短期均线${rel}长期均线，最新信号为${sig > 0 ? '看多' : '看空'}（信号在最近收盘后生成，次日生效）。`
  }
  if (cfg.kind === 'momentum') {
    if (sig === 0) return `动量（${p.days} 日，阈值 ${p.threshold}%）：当前动量未达阈值，信号为观望。`
    return `动量（${p.days} 日，阈值 ${p.threshold}%）：当前动量${sig > 0 ? '超过' : '跌破'}阈值，信号为${sig > 0 ? '看多' : '看空'}（信号在最近收盘后生成，次日生效）。`
  }
  if (sig === 0) return `均值回归（${p.days} 日均线，阈值 ${p.threshold}%）：当前偏离未达阈值，信号为观望。`
  return `均值回归（${p.days} 日均线，阈值 ${p.threshold}%）：当前偏离${sig > 0 ? '超卖' : '超买'}，信号为${sig > 0 ? '看多（回归）' : '看空（回归）'}（信号在最近收盘后生成，次日生效）。`
}

export interface OptimizationResult {
  best: StrategyResult
  tested: number
  buyHoldAnnual: number
}

/** 参数网格寻优（仅用历史数据；每个组合都严格因果） */
export function optimizeStrategy(closes: number[], kind: StrategyKind): OptimizationResult {
  const grids: Record<StrategyKind, StrategyConfig[]> = {
    maCross: (() => {
      const list: StrategyConfig[] = []
      for (const short of [5, 10, 20]) {
        for (const long of [20, 60, 120]) {
          if (short < long) list.push({ kind, params: { short, long } })
        }
      }
      return list
    })(),
    momentum: (() => {
      const list: StrategyConfig[] = []
      for (const days of [20, 60, 120]) {
        for (const threshold of [1, 3, 5, 8]) {
          list.push({ kind, params: { days, threshold } })
        }
      }
      return list
    })(),
    meanRev: (() => {
      const list: StrategyConfig[] = []
      for (const days of [20, 60, 120]) {
        for (const threshold of [3, 5, 8, 12]) {
          list.push({ kind, params: { days, threshold } })
        }
      }
      return list
    })(),
  }
  let best: StrategyResult | null = null
  for (const cfg of grids[kind]) {
    const r = runStrategy(closes, cfg)
    if (!best || r.annualReturn > best.annualReturn) best = r
  }
  const n = closes.length
  const buyHoldAnnual =
    n > 1 ? (Math.pow(closes[n - 1] / closes[0], 252 / (n - 1)) - 1) * 100 : 0
  return { best: best as StrategyResult, tested: grids[kind].length, buyHoldAnnual }
}
