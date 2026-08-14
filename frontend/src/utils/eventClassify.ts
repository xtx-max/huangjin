// 实时世界事件：标题关键词自动分类 / 影响方向 / 自动生成机制分析
import type { GoldEvent } from '@/data/events'
import { buildAutoAnalysis } from '@/utils/autoAnalysis'

export type EventImpact = GoldEvent['impact']

const CATEGORY_RULES: Array<[RegExp, string]> = [
  [/美联储|央行|加息|降息|利率|缩表|QE|量化宽松|点阵图|鲍威尔|降准|准备金/, '货币政策'],
  [/战争|冲突|袭击|入侵|军事|导弹|停火|制裁|军演|核/, '战争冲突'],
  [/危机|崩盘|暴跌|倒闭|挤兑|违约|爆雷|衰退|熔断|流动性/, '金融危机'],
  [/疫情|病毒|疫苗|封锁|大流行|公共卫生|猴痘/, '公共卫生'],
  [/关税|贸易战|脱欧|大选|选举|政变|谈判|峰会|制裁清单/, '地缘政治'],
  [/购金|黄金储备|ETF持仓|库存|产量|需求|供应|开采|金矿/, '供需变化'],
]

const IMPACT_POS: RegExp = /降息|购金|避险|冲突|战争|制裁|危机|违约|衰退担忧|新高|大涨|飙升|突破|刺激|宽松|QE|降准/
const IMPACT_NEG: RegExp = /加息|鹰派|缩表|暴跌|抛售|崩盘|违约|爆雷|衰退|通缩|打压|下调评级|暂停增持/

const REGION_RULES: Array<[RegExp, string]> = [
  [/美联储|美国|特朗普|拜登|白宫|华尔街|美元|硅谷/, '美国'],
  [/欧洲|欧盟|欧元|英国|法国|德国|欧央行|脱欧/, '欧洲'],
  [/中东|伊朗|以色列|沙特|加沙|巴勒斯坦|也门|胡塞/, '中东'],
  [/俄|乌|乌克兰|莫斯科|基辅/, '欧洲'],
  [/中国|央行|人民银行|上海|人民币|国务院|北京/, '中国'],
  [/日本|韩国|印度|亚洲|亚太/, '亚洲'],
]

export interface LiveEventInput {
  title: string
  date: string
  source: string
  content: string
  link?: string
}

export function classifyEvent(title: string): { category: string; impact: EventImpact } {
  const category = CATEGORY_RULES.find(([re]) => re.test(title))?.[1] ?? '其他'
  let impact: EventImpact = '中性'
  if (IMPACT_POS.test(title)) impact = '利好金价'
  if (IMPACT_NEG.test(title)) impact = '利空金价'
  return { category, impact }
}

export function guessRegion(title: string): string {
  return REGION_RULES.find(([re]) => re.test(title))?.[1] ?? '全球'
}

/** 自动生成实时事件的结构化分析（明确标注自动生成、不构成投资建议） */
export function buildLiveAnalysis(input: LiveEventInput, category: string, impact: EventImpact): string {
  return buildAutoAnalysis({
    title: input.title,
    date: input.date,
    source: input.source,
    summary: input.content.slice(0, 80) + (input.content.length > 80 ? '…' : ''),
    category,
    impact,
  })
}

export function toLiveEvent(
  input: LiveEventInput,
  idx: number,
  fallbackCategory?: string,
  fallbackImpact?: EventImpact,
): GoldEvent & { link?: string } {
  const cls = classifyEvent(input.title)
  const category = fallbackCategory ?? cls.category
  const impact = fallbackImpact ?? cls.impact
  return {
    id: `live-event-${idx}`,
    date: (input.date || '').slice(0, 10),
    title: input.title,
    category,
    region: guessRegion(input.title),
    summary: input.content.slice(0, 80) + (input.content.length > 80 ? '…' : ''),
    impact,
    analysis: buildLiveAnalysis(input, category, impact),
    link: input.link,
  }
}
