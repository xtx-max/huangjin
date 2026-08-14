// 实时世界事件：标题关键词自动分类 / 影响方向 / 自动生成机制分析
import type { GoldEvent } from '@/data/events'

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

const MECHANISM: Record<string, string> = {
  货币政策:
    '利率与货币条件是黄金定价的核心变量：央行加息/缩表会推升实际利率、走强美元，抬高持有黄金的机会成本，压制金价；反之降息/宽松压低实际利率，黄金相对吸引力上升。市场通常提前交易政策预期，决议落地后常有"卖预期、买事实"的反转。',
  战争冲突:
    '地缘冲突通过避险需求渠道影响金价：不确定性上升时资金涌入黄金对冲尾部风险，历史经验显示冲突升级阶段金价脉冲式冲高，而局势明朗或停火预期形成后避险溢价快速回吐。若冲突波及能源供应或美元信用，影响会更持久。',
  金融危机:
    '金融动荡对金价的影响分两阶段：危机初期"现金为王"，机构为回补流动性被迫抛售黄金，金价可能不涨反跌；随后央行出手救市、利率走低，黄金在宽松环境中收复失地并走强。危机的规模越大，央行的宽松力度越大，黄金的后续行情越可观。',
  公共卫生:
    '公共卫生事件通过"避险+宽松"双通道影响黄金：经济停摆风险推升避险需求，同时各国央行降息放水、财政扩张，实际利率下行利好黄金。但当恐慌演变为流动性危机时，黄金短期也会被抛售换现金。',
  地缘政治:
    '政治与贸易事件通过避险情绪、通胀预期与美元信用三条渠道作用于金价：关税与制裁推升通胀预期，政局不稳削弱风险偏好，美元信用受损时黄金的储备替代需求上升。事件冲击多为脉冲式，趋势仍需结合利率与美元方向判断。',
  供需变化:
    '黄金的供需结构是价格的中长期基石：央行购金、ETF 资金流入代表刚性需求，矿山产量与再生金供应相对稳定。官方买盘对价格不敏感、趋势性强，是近年金价中枢上移的重要支撑；而供给端的大规模抛售或库存迁徙会带来阶段性压力。',
}

const IMPACT_NOTE: Record<EventImpact, string> = {
  利好金价: '综合标题信息判断，该事件整体偏向利好金价，可能推动避险或宽松预期交易。',
  利空金价: '综合标题信息判断，该事件整体偏向利空金价，可能带来实际利率上行或风险偏好修复。',
  中性: '该事件对金价的方向性影响暂不明确，市场影响取决于后续细节与政策反应。',
}

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
  const mech = MECHANISM[category] ?? MECHANISM['地缘政治']
  const summary = input.content.length > 80 ? input.content.slice(0, 80) + '…' : input.content
  return [
    '【事件背景】',
    `${input.title}（${input.source}，${input.date}）。${summary} 本条为实时抓取的全球事件，事件全貌仍在演进中，以上为公开快讯信息，后续细节可能变化。`,
    '【对金价的影响机制】',
    `${IMPACT_NOTE[impact]}${mech}`,
    '【如何进一步跟踪】',
    '可在本站「波动分析-事件归因」查看历史同类事件前后 30/90/365 日的实际金价表现，在「金价预测」页结合统计趋势与当前行情综合判断；待本事件进入人工整理的事件库后，将补充完整的市场反应数据与历史启示。',
    '【风险提示】',
    '本条分析由系统按事件类型自动生成，仅供参考，不构成任何投资建议。',
  ].join('\n')
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
