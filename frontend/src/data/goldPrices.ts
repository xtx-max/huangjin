// 金价数据加载与类型定义（本地 JSON，无网络请求）
export interface PricePoint {
  date: string // YYYY-MM-DD
  open: number
  high: number
  low: number
  close: number
}

export interface MonthlyPoint {
  date: string // YYYY-MM-01
  price: number
}

export interface GoldPrices {
  internationalDaily: PricePoint[]
  internationalMonthly: MonthlyPoint[]
  domestic: PricePoint[]
}

// 以 ?raw 字符串方式导入，避免 TS 对近万行对象做字面量类型推断拖慢类型检查
import raw from './gold-prices.json?raw'

export function loadGoldPrices(): GoldPrices {
  return JSON.parse(raw) as GoldPrices
}
