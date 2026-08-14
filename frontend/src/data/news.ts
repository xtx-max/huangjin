// 新闻数据加载与类型定义（本地 JSON，无网络请求）
export interface NewsItem {
  id: string
  title: string
  time: string // YYYY-MM-DD HH:mm
  source: string
  summary: string
  content: string
}

import raw from './news.json?raw'

export function loadNews(): NewsItem[] {
  return (JSON.parse(raw) as { items: NewsItem[] }).items
}
