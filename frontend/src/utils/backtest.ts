// 历史回测：滚动窗口评估预测模型，并关联事件库解释偏差原因
import type { GoldEvent } from '@/data/events'
import { holtAutoFit, linearRegression } from '@/utils/forecast'

export interface BacktestPoint {
  anchorDate: string
  targetDate: string
  predictedPct: number
  actualPct: number
  errorPct: number
  predictedPrice: number
  actualPrice: number
  low: number
  high: number
  dirCorrect: boolean
  inBand: boolean
  events: GoldEvent[]
}

export interface BacktestResult {
  points: BacktestPoint[]
  count: number
  dirHitRate: number
  meanAbsErrorPct: number
  bandCoverage: number
  worst: BacktestPoint[]
}

/**
 * 滚动回测：从第 fitDays 个交易日开始，每 step 个交易日取一个锚点，
 * 用此前 fitDays 个交易日拟合（线性回归 + Holt），预测其后 horizon 个交易日的涨跌，
 * 与真实结果对比。区间按 90% 简化区间（1.645 × 残差标准差 × √(1+h/n)）。
 */
export function runBacktest(
  dates: string[],
  closes: number[],
  events: GoldEvent[],
  fitDays = 250,
  horizon = 60,
  step = 22,
): BacktestResult {
  const n = closes.length
  const points: BacktestPoint[] = []

  for (let i = fitDays - 1; i + horizon < n; i += step) {
    const windowCloses = closes.slice(i - fitDays + 1, i + 1)
    const w = windowCloses.length
    const reg = linearRegression(windowCloses)
    const holt = holtAutoFit(windowCloses, horizon)
    const regPred = reg.intercept + reg.slope * (w - 1 + horizon)
    const holtPred = holt.forecast[horizon - 1]
    const predictedPrice = (regPred + holtPred) / 2
    const actualPrice = closes[i + horizon]
    const base = closes[i]
    const predictedPct = base > 0 ? ((predictedPrice - base) / base) * 100 : 0
    const actualPct = base > 0 ? ((actualPrice - base) / base) * 100 : 0
    const errorPct = predictedPct - actualPct
    const half = 1.645 * reg.residStd * Math.sqrt(1 + horizon / w)
    const low = predictedPrice - half
    const high = predictedPrice + half
    const windowEvents = events.filter((e) => e.date > dates[i] && e.date <= dates[i + horizon])

    points.push({
      anchorDate: dates[i],
      targetDate: dates[i + horizon],
      predictedPct,
      actualPct,
      errorPct,
      predictedPrice,
      actualPrice,
      low,
      high,
      dirCorrect: (predictedPct >= 0) === (actualPct >= 0),
      inBand: actualPrice >= low && actualPrice <= high,
      events: windowEvents,
    })
  }

  const count = points.length
  const dirHit = count > 0 ? points.filter((p) => p.dirCorrect).length / count : 0
  const mae = count > 0 ? points.reduce((s, p) => s + Math.abs(p.errorPct), 0) / count : 0
  const coverage = count > 0 ? points.filter((p) => p.inBand).length / count : 0
  const worst = [...points].sort((a, b) => Math.abs(b.errorPct) - Math.abs(a.errorPct)).slice(0, 5)

  return {
    points,
    count,
    dirHitRate: dirHit * 100,
    meanAbsErrorPct: mae,
    bandCoverage: coverage * 100,
    worst,
  }
}
