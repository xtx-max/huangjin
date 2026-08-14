// 事件-金价统计工具：合并国际序列、事件前后涨跌幅计算（Dashboard 与波动分析页共用）
import type { GoldPrices } from '@/data/goldPrices'
import type { GoldEvent } from '@/data/events'

export interface ClosePoint {
  date: string
  close: number
}

export interface EventStat {
  event: GoldEvent
  baselineDate: string | null
  baseline: number | null
  pre30: number | null
  post30: number | null
  post90: number | null
  post365: number | null
}

/** 国际合并序列：1970-2004 月度定盘价 + 2004-06 起日线，按日期升序去重 */
export function buildMergedIntlSeries(p: GoldPrices): ClosePoint[] {
  const map = new Map<string, ClosePoint>()
  for (const m of p.internationalMonthly) map.set(m.date, { date: m.date, close: m.price })
  for (const d of p.internationalDaily) map.set(d.date, { date: d.date, close: d.close })
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** 日期 ≤ target 的最近一条 */
export function findPrev(points: ClosePoint[], target: string): ClosePoint | null {
  let lo = 0
  let hi = points.length - 1
  let ans: ClosePoint | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].date <= target) {
      ans = points[mid]
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return ans
}

/** 日期 ≥ target 的最近一条 */
export function findNext(points: ClosePoint[], target: string): ClosePoint | null {
  let lo = 0
  let hi = points.length - 1
  let ans: ClosePoint | null = null
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (points[mid].date >= target) {
      ans = points[mid]
      hi = mid - 1
    } else {
      lo = mid + 1
    }
  }
  return ans
}

function pct(base: number, other: number): number {
  return base !== 0 ? ((other - base) / base) * 100 : 0
}

/** 每件事：基准收盘(事件日或其后最近交易日) + 前30/后30/后90/后365日涨跌幅 */
export function computeEventStats(events: GoldEvent[], series: ClosePoint[]): EventStat[] {
  return events.map((ev) => {
    const basePt = findNext(series, ev.date)
    const prePt = findPrev(series, addDays(ev.date, -30))
    const post30Pt = findNext(series, addDays(ev.date, 30))
    const post90Pt = findNext(series, addDays(ev.date, 90))
    const post365Pt = findNext(series, addDays(ev.date, 365))
    const baseline = basePt ? basePt.close : null
    return {
      event: ev,
      baselineDate: basePt ? basePt.date : null,
      baseline,
      pre30: baseline !== null && prePt ? pct(prePt.close, baseline) : null,
      post30: baseline !== null && post30Pt ? pct(baseline, post30Pt.close) : null,
      post90: baseline !== null && post90Pt ? pct(baseline, post90Pt.close) : null,
      post365: baseline !== null && post365Pt ? pct(baseline, post365Pt.close) : null,
    }
  })
}
