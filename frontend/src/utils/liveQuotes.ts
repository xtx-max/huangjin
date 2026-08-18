// 实时行情报价（东方财富 push2 公开接口，CORS 开放，无需密钥）
// COMEX 黄金: 101.GC00Y（美元/盎司）；上海金 Au99.99: 118.Au9999（元/克）
// 接口价格字段为实际价格 ×100，前端除以 100
export interface LiveQuote {
  price: number
  prevClose: number
  change: number
  changePct: number
  /** 行情时间戳（HH:mm:ss） */
  time: string
}

export interface LiveQuotes {
  intl: LiveQuote | null
  domestic: LiveQuote | null
}

const QUOTE_FIELDS = 'f57,f58,f43,f60,f86'

interface RawQuote {
  f57: string
  f58: string
  f43?: number
  f60?: number
  f86?: number
}

function fmtTime(epochSec: number): string {
  const d = new Date(epochSec * 1000)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

function toQuote(raw: RawQuote | null | undefined, scale: number): LiveQuote | null {
  if (!raw || raw.f43 === undefined || raw.f60 === undefined) return null
  const price = raw.f43 / scale
  const prevClose = raw.f60 / scale
  const change = price - prevClose
  return {
    price,
    prevClose,
    change,
    changePct: prevClose !== 0 ? (change / prevClose) * 100 : 0,
    time: raw.f86 ? fmtTime(raw.f86) : '',
  }
}

/** 单个 secid 请求；双主机(主站/延迟站)×重试，任一成功即返回。scale：接口价格放大倍数（COMEX ×10、上海金 ×100） */
const QUOTE_HOSTS = ['push2.eastmoney.com', 'push2delay.eastmoney.com']

async function fetchOne(secid: string, scale: number): Promise<LiveQuote | null> {
  for (const host of QUOTE_HOSTS) {
    const url = `https://${host}/api/qt/stock/get?secid=${secid}&fields=${QUOTE_FIELDS}`
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const resp = await fetch(url)
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
        const payload = (await resp.json()) as { data?: RawQuote | RawQuote[] }
        const data = payload.data
        const raw = Array.isArray(data) ? data[0] : data
        const quote = toQuote(raw, scale)
        if (quote) return quote
        throw new Error('响应缺少行情字段')
      } catch {
        if (attempt === 2) break
        await new Promise((r) => setTimeout(r, 700))
      }
    }
  }
  return null
}

/** 两个品种并行拉取（任一失败不影响另一个，页面各自回退到日线数据） */
export async function fetchLiveQuotes(): Promise<LiveQuotes> {
  const [intl, domestic] = await Promise.all([
    fetchOne('101.GC00Y', 10),
    fetchOne('118.Au9999', 100),
  ])
  return { intl, domestic }
}
