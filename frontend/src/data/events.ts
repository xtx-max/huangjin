// 事件库数据加载与类型定义（本地 JSON，无网络请求）
export interface GoldEvent {
  id: string
  date: string // YYYY-MM-DD
  title: string
  category: string // 地缘政治|货币政策|金融危机|战争冲突|公共卫生|供需变化|其他
  region: string
  summary: string
  impact: '利好金价' | '利空金价' | '中性'
  analysis: string
}

import raw from './events.json?raw'

export function loadEvents(): GoldEvent[] {
  return (JSON.parse(raw) as { events: GoldEvent[] }).events
}
