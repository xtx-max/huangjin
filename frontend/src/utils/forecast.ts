// 金价统计预测工具：线性回归 + Holt 双指数平滑（纯前端实现，仅用于统计演示，不构成投资建议）

export interface Regression {
  slope: number
  intercept: number
  fitted: number[]
  r2: number
  residStd: number
}

/** 普通最小二乘线性回归（x=时间序号 0..n-1） */
export function linearRegression(ys: number[]): Regression {
  const n = ys.length
  if (n < 2) return { slope: 0, intercept: ys[0] ?? 0, fitted: ys.slice(), r2: 0, residStd: 0 }
  const meanX = (n - 1) / 2
  const meanY = ys.reduce((s, v) => s + v, 0) / n
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (i - meanX) * (ys[i] - meanY)
    sxx += (i - meanX) * (i - meanX)
  }
  const slope = sxx === 0 ? 0 : sxy / sxx
  const intercept = meanY - slope * meanX
  const fitted = ys.map((_, i) => intercept + slope * i)
  const ssRes = ys.reduce((s, v, i) => s + (v - fitted[i]) * (v - fitted[i]), 0)
  const ssTot = ys.reduce((s, v) => s + (v - meanY) * (v - meanY), 0)
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  const residStd = Math.sqrt(ssRes / (n - 2))
  return { slope, intercept, fitted, r2, residStd }
}

export interface HoltResult {
  alpha: number
  beta: number
  level: number[]
  trend: number[]
  /** 未来第 1..horizon 步预测 */
  forecast: number[]
  inSampleSSE: number
}

/** Holt 双指数平滑：一步预测 f_t = level[t-1] + trend[t-1]，未来第 k 步 = level_end + k*trend_end */
export function holt(values: number[], alpha: number, beta: number, horizon = 90): HoltResult {
  const n = values.length
  const level: number[] = [values[0]]
  const trend: number[] = [n > 1 ? values[1] - values[0] : 0]
  let sse = 0
  for (let i = 1; i < n; i++) {
    const oneStep = level[i - 1] + trend[i - 1]
    sse += (values[i] - oneStep) * (values[i] - oneStep)
    level.push(alpha * values[i] + (1 - alpha) * (level[i - 1] + trend[i - 1]))
    trend.push(beta * (level[i] - level[i - 1]) + (1 - beta) * trend[i - 1])
  }
  const forecast: number[] = []
  const endLevel = level[n - 1]
  const endTrend = trend[n - 1]
  for (let k = 1; k <= horizon; k++) {
    forecast.push(endLevel + k * endTrend)
  }
  return { alpha, beta, level, trend, forecast, inSampleSSE: sse }
}

/** 网格搜索最优 (alpha, beta)，最小化样本内一步预测误差平方和 */
export function holtAutoFit(values: number[], horizon = 90): HoltResult {
  let best: HoltResult | null = null
  const grid = [0.05, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
  for (const a of grid) {
    for (const b of grid) {
      const r = holt(values, a, b, horizon)
      if (!best || r.inSampleSSE < best.inSampleSSE) best = r
    }
  }
  return best as HoltResult
}

/** 从 from 日期起生成 count 个交易日（跳过周末；不含节假日日历） */
export function tradingDates(fromIso: string, count: number): string[] {
  const out: string[] = []
  const d = new Date(fromIso)
  d.setDate(d.getDate() + 1)
  while (out.length < count) {
    const day = d.getDay()
    if (day !== 0 && day !== 6) out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export interface ForecastResult {
  dates: string[]
  reg: number[]
  holt: number[]
  low: number[]
  high: number[]
  regSlope: number
  r2: number
  residStd: number
  alpha: number
  beta: number
}

/**
 * 生成未来 horizon 个交易日的预测：
 * - reg：线性回归外推
 * - holt：Holt 双指数平滑（网格寻参）
 * - 区间：90% 简化区间 = 预测值 ± 1.645 × 残差标准差 × √(1 + h/n)
 */
export function forecastSeries(ys: number[], horizon: number, lastDate: string): ForecastResult {
  const n = ys.length
  const reg = linearRegression(ys)
  const h = holtAutoFit(ys, horizon)
  const dates = tradingDates(lastDate, horizon)
  const Z = 1.645
  const regArr: number[] = []
  const holtArr: number[] = []
  const low: number[] = []
  const high: number[] = []
  for (let k = 1; k <= horizon; k++) {
    const rv = reg.intercept + reg.slope * (n - 1 + k)
    const hv = h.forecast[k - 1]
    const half = Z * reg.residStd * Math.sqrt(1 + k / n)
    regArr.push(rv)
    holtArr.push(hv)
    low.push(Math.min(rv, hv) - half)
    high.push(Math.max(rv, hv) + half)
  }
  return {
    dates,
    reg: regArr,
    holt: holtArr,
    low,
    high,
    regSlope: reg.slope,
    r2: reg.r2,
    residStd: reg.residStd,
    alpha: h.alpha,
    beta: h.beta,
  }
}
