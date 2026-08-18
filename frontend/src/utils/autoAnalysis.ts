// 实时内容自动深度分析引擎：把真实行情数据注入分析，按类别展开传导机制
import { loadGoldPrices } from '@/data/goldPrices'

export type EventImpact = '利好金价' | '利空金价' | '中性'

interface MarketContext {
  lastDate: string
  lastClose: number
  pct30: number | null
  pct60: number | null
  pct90: number | null
  ytd: number | null
  histHigh: number
  histHighDate: string
  ddFromHigh: number
  vsMa20: number | null
  domesticLast: number
  domesticDate: string
}

let cache: MarketContext | null = null

/** 计算一次并缓存（静态数据，全站共用） */
export function getMarketContext(): MarketContext {
  if (cache) return cache
  const data = loadGoldPrices()
  const il = data.internationalDaily
  const last = il[il.length - 1]
  const lastDate = last.date

  const pct = (days: number): number | null => {
    const cutoff = new Date(lastDate)
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    const rows = il.filter((p) => p.date >= cutoffStr)
    if (rows.length < 2) return null
    return ((last.close - rows[0].close) / rows[0].close) * 100
  }

  let histHigh = 0
  let histHighDate = ''
  for (const p of il) {
    if (p.close > histHigh) {
      histHigh = p.close
      histHighDate = p.date
    }
  }

  let ma20: number | null = null
  if (il.length >= 20) {
    const slice = il.slice(-20)
    ma20 = slice.reduce((s, p) => s + p.close, 0) / slice.length
  }

  const year = lastDate.slice(0, 4)
  const yRows = il.filter((p) => p.date.startsWith(year))
  const ytd = yRows.length > 1 ? ((last.close - yRows[0].close) / yRows[0].close) * 100 : null

  const dom = data.domestic
  const domLast = dom[dom.length - 1]

  cache = {
    lastDate,
    lastClose: last.close,
    pct30: pct(30),
    pct60: pct(60),
    pct90: pct(90),
    ytd,
    histHigh,
    histHighDate,
    ddFromHigh: ((last.close - histHigh) / histHigh) * 100,
    vsMa20: ma20 !== null ? ((last.close - ma20) / ma20) * 100 : null,
    domesticLast: domLast.close,
    domesticDate: domLast.date,
  }
  return cache
}

/** 各类别传导机制详解（自动分析用） */
const MECHANISM: Record<string, string> = {
  货币政策: `货币政策的传导链条分四步。第一步是"预期定价"：市场通常在决议公布前数周就开始交易加息或降息概率，金价往往在"预期形成期"反应最剧烈——2013 年伯南克暗示缩减 QE，金价单月下跌 11%；2015 年 12 月首次加息落地，金价反而在 1046 美元见底，演绎"卖预期、买事实"。第二步是"实际利率"：黄金不生息，持有它的机会成本就是实际利率（名义利率减通胀预期），实际利率下行期黄金吸引力系统性上升。第三步是"美元"：政策宽松通常伴随美元走弱，而黄金以美元计价，美元指数与金价长期负相关。第四步是"资金流"：利率预期改变后，ETF 持仓、期货投机头寸随之调整，放大价格波动。判断政策事件对金价的影响，重点不是单次决议本身，而是政策"路径"：加息/降息的起点、斜率与终点利率，以及央行资产负债表的变化。`,
  战争冲突: `战争冲突通过三条渠道影响金价。第一是"避险需求"：冲突升级期不确定性骤然上升，资金涌入黄金对冲尾部风险，历史上苏联入侵阿富汗、海湾战争、俄乌冲突爆发初期，金价都出现脉冲式冲高。第二是"能源与通胀"：若冲突发生在能源产区，油价与通胀预期同步抬升，实际利率被压低，黄金获得第二重支撑。第三是"美元信用"：当冲突涉及金融制裁、储备资产冻结时，各国对美元体系安全性的疑虑上升，央行购金加速——这是俄乌冲突后黄金最深刻的变化。但必须注意"避险溢价"的消退规律：冲突升级阶段金价最强，停火预期或局势明朗后溢价快速回吐，行情能否延续取决于冲突是否改变利率路径与储备格局。`,
  金融危机: `金融危机对金价的影响呈"两阶段"特征。第一阶段是"流动性冲击"：危机爆发初期，机构为回补保证金、应对赎回，被迫抛售一切可快速变现的资产换取现金，黄金作为少数有浮盈的资产被优先卖出——2008 年雷曼破产后金价两个月内从 1032 美元跌至 712 美元，2020 年 3 月疫情恐慌中金价两周跌逾 13%，都属此类。第二阶段是"央行救市"：危机迫使央行降息、QE、提供流动性工具，实际利率大幅下行，黄金在宽松环境中收复失地并创出新高。规律是：危机越大，央行的宽松越猛，黄金的后续行情越可观；判断拐点的关键是央行政策响应速度与规模。`,
  公共卫生: `公共卫生事件通过"避险+宽松"双通道作用于黄金。恐慌期经济停摆风险推升避险需求，同时各国央行迅速降息、财政大规模扩张，实际利率跌向低位甚至负值——2020 年疫情中全球央行合计降息上百次、QE 规模创纪录，金价当年上涨 25% 并首破 2000 美元。但中间有一个关键插曲：当恐慌演变为流动性危机时，黄金短期也会被抛售换现金（2020 年 3 月 9 日至 19 日金价从 1703 跌至 1474 美元），随后在无限量宽松中 V 型反转。观察这类事件，重点是疫情对经济停摆的深度、财政与货币刺激的规模，以及疫苗/特效药带来的复苏拐点。`,
  地缘政治: `政治与贸易事件通过三条路径影响金价。其一"避险情绪"：政局不稳、选举变数、制裁升级推升风险溢价，黄金获得短期买盘。其二"通胀与增长预期"：关税与贸易壁垒推升进口成本、压制全球增长，滞胀预期利好黄金。其三"美元信用"：政治事件若削弱美国财政纪律或美元体系信誉，黄金的储备替代需求上升。但要警惕"单一题材不足以驱动趋势"：2018 年中美贸易战全年升级，金价却因美元走强而横盘收跌——避险叙事必须与利率、美元方向结合判断。事件冲击多为脉冲式，趋势取决于事件是否改变了货币政策路径或储备格局。`,
  供需变化: `黄金供需结构是价格的中长期基石。需求端：央行购金具有"对价格不敏感、趋势性强"的特征，2022-2024 年全球央行连续三年净购金超千吨，是金价中枢系统性上移的核心动力；ETF 资金流反映投资需求的边际变化，是趋势的放大器；金饰与工业需求对价格敏感，高价时会自然萎缩。供给端：矿山产量刚性（年增约 1-2%）、再生金供给随价格上涨而释放，通常形成价格上方的"软顶"。判断供需事件的要点：官方买盘是否延续（看各国央行月度数据）、ETF 持仓是否持续流入、库存迁徙（如 COMEX 库存激增）是否暴露实物紧张——三者共振时，金价对利率的敏感度会明显下降。`,
  其他: `黄金的定价框架正在从"利率交易"向"信用交易"迁移。传统上，金价与实际利率、美元高度负相关；但 2022 年之后，在美元资产被"武器化"、美国财政赤字高企的背景下，央行与主权资金持续增持黄金对冲信用风险，金价对利率上行的敏感度明显下降，屡次出现"利率上行、金价不跌"的背离。判断这类事件对金价的影响，需要同时看三条线：实际利率与美元的传统定价线、央行购金的储备需求线、以及地缘与财政的信用溢价线。当后两条线占主导时，金价中枢会上移、波动区间抬升；当传统定价线回归主导时，则要防范均值回归的压力。`,
}

const IMPACT_NOTE: Record<EventImpact, string> = {
  利好金价: '综合标题与内容判断，该事件整体偏向利好金价：它可能推升避险需求、压低实际利率预期，或强化央行购金与储备多元化叙事。',
  利空金价: '综合标题与内容判断，该事件整体偏向利空金价：它可能带来实际利率上行、美元走强或风险偏好修复，压制黄金的持有吸引力。',
  中性: '该事件对金价的方向性影响暂不明确，其市场影响取决于后续细节、政策反应与利率和美元的方向。',
}

const TRACKING: Record<string, string> = {
  货币政策: '跟踪要点：关注央行点阵图/会议纪要的措辞边际、通胀与就业数据、以及市场隐含的利率路径变化。',
  战争冲突: '跟踪要点：关注冲突是否升级或出现停火信号、能源供应是否受扰、以及西方制裁与储备资产冻结的后续。',
  金融危机: '跟踪要点：关注央行流动性工具与降息救市的响应速度、银行间利差与信用利差、以及机构持仓去杠杆是否结束。',
  公共卫生: '跟踪要点：关注疫情扩散与防控政策、疫苗与药物进展、以及财政货币刺激的规模与退出节奏。',
  地缘政治: '跟踪要点：关注谈判进展与关税清单细节、汇率与美债收益率的联动、以及事件是否升级为制裁与储备层面的变化。',
  供需变化: '跟踪要点：关注各国央行月度购金数据、黄金 ETF 持仓变化、以及 COMEX 库存与期现价差。',
  其他: '跟踪要点：结合「波动分析-事件归因」页历史同类事件的表现，与「金价预测」页的统计趋势综合判断。',
}

function fmtPct(v: number | null): string {
  if (v === null) return '数据不足'
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`
}

export interface AutoAnalysisInput {
  title: string
  date: string
  source: string
  summary: string
  category: string
  impact: EventImpact
}

/** 生成 900~1200 字的实时内容自动深度分析（注入真实行情数据） */
export function buildAutoAnalysis(input: AutoAnalysisInput): string {
  const ctx = getMarketContext()
  const mech = MECHANISM[input.category] ?? MECHANISM['其他']
  const tracking = TRACKING[input.category] ?? TRACKING['其他']

  const maText =
    ctx.vsMa20 === null
      ? '（20 日均线数据不足）'
      : `现价位于 20 日均线${ctx.vsMa20 >= 0 ? '上方' : '下方'} ${Math.abs(ctx.vsMa20).toFixed(1)}%`

  const verdictLine =
    input.impact === '利好金价'
      ? `本条对金价的影响：利好金价。理由：${IMPACT_NOTE[input.impact].slice(0, 40)}`
      : input.impact === '利空金价'
        ? `本条对金价的影响：利空金价。理由：${IMPACT_NOTE[input.impact].slice(0, 40)}`
        : '本条对金价的影响：中性。方向取决于后续细节与利率、美元走势。'
  return [
    '【对金价的影响判断】',
    `${verdictLine}（详细传导机制见下文）`,
    '【事件概要】',
    `${input.title}（${input.source}，${input.date}）。${input.summary} 本条为实时抓取的全球事件，事件全貌仍在演进中，以上为公开快讯信息，后续细节可能变化。`,
    '【当前市场背景（真实数据）】',
    `截至 ${ctx.lastDate}，国际金价最新收盘 ${ctx.lastClose.toFixed(2)} 美元/盎司，较 30 日前 ${fmtPct(ctx.pct30)}、较 60 日前 ${fmtPct(ctx.pct60)}、较 90 日前 ${fmtPct(ctx.pct90)}，年内 ${fmtPct(ctx.ytd)}；历史最高收盘为 ${ctx.histHighDate} 的 ${ctx.histHigh.toFixed(2)} 美元，当前距历史高点 ${fmtPct(ctx.ddFromHigh)}；${maText}。国内金价 Au99.99 收 ${ctx.domesticLast.toFixed(2)} 元/克（${ctx.domesticDate}）。这些数据说明当前金价处于什么位置、事件冲击发生时的估值环境。`,
    '【对金价的影响机制】',
    `${IMPACT_NOTE[input.impact]}${mech}`,
    '【数据观察】',
    `事件日前 30 日金价表现与上述市场背景共同构成事件的"起点"：若事件发生在数据覆盖期内，可在「波动分析-事件归因」页用同类历史事件做参照——历史同类事件后 30/90/365 日的实际涨跌幅分布，比任何主观判断都更可靠。事件发生后的实际走势，可次日刷新本站观察，或待其进入人工整理的事件库后查看完整复盘。`,
    '【如何进一步跟踪】',
    `${tracking} 同时关注「金价预测」页基于当前数据外推的统计区间，作为方向性参考。`,
    '【风险提示】',
    '本条分析由系统按事件类型自动生成并结合实时行情数据计算，仅供参考，不构成任何投资建议。',
  ].join('\n')
}
