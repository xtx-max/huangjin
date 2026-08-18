<template>
  <div class="page" ref="pageRoot">
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      class="disclaimer reveal"
      title="统计预测声明"
      description="本页预测为基于历史价格的纯统计外推（线性回归 / Holt 双指数平滑），仅用于学习与演示，不构成任何投资建议。金价受宏观政策、地缘事件与央行行为影响，实际走势可能显著偏离预测区间，请勿据此交易。"
    />

    <el-card shadow="never" class="page-card reveal">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Compass /></el-icon>
            <span>金价预测</span>
            <el-tag size="small" type="warning" effect="plain">{{ seriesName }}</el-tag>
            <el-tag size="small" type="info" effect="plain">数据截至 {{ lastDate }}</el-tag>
            <el-tag v-if="livePoint" size="small" type="success" effect="plain">
              实时 {{ livePoint.close.toFixed(2) }} {{ unit }}（已纳入预测）
            </el-tag>
          </div>
          <div class="header-controls">
            <span class="control-label">品种</span>
            <el-radio-group v-model="kind" size="small">
              <el-radio-button label="domestic">国内金价</el-radio-button>
              <el-radio-button label="intl">国际金价</el-radio-button>
            </el-radio-group>
            <span class="control-label">拟合区间</span>
            <el-radio-group v-model="fitRange" size="small">
              <el-radio-button label="6m">近6月</el-radio-button>
              <el-radio-button label="1y">近1年</el-radio-button>
              <el-radio-button label="3y">近3年</el-radio-button>
              <el-radio-button label="5y">近5年</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>

      <!-- 预测结论卡：一眼看出涨跌 -->
      <div class="verdict" :class="verdict.dir">
        <div class="verdict-left">
          <div class="verdict-label">
            未来 6 个月（约 126 个交易日） · {{ seriesName }} · 统计模型预测
          </div>
          <div class="verdict-main">
            <span class="verdict-arrow">{{ verdict.dir === 'up' ? '↗' : verdict.dir === 'down' ? '↘' : '→' }}</span>
            <span class="verdict-word">{{ verdict.word }}</span>
          </div>
          <div class="verdict-sub">
            当前 {{ lastClose.toFixed(2) }} {{ unit }} → 预计 {{ verdict.target.toFixed(2) }} {{ unit }}（{{ formatSigned(verdict.pct, 2) }}%）
          </div>
        </div>
        <div class="verdict-right">
          <div class="verdict-band">
            90% 预测区间：{{ verdict.low.toFixed(0) }} ~ {{ verdict.high.toFixed(0) }} {{ unit }}
          </div>
          <div class="verdict-meta">
            线性回归 {{ verdict.reg.toFixed(2) }} · Holt {{ verdict.holt.toFixed(2) }} · 拟合优度 R²={{ fc.r2.toFixed(3) }}
          </div>
        </div>
      </div>

      <!-- 四个小预测卡：明天 / 一周后 / 一个月后 / 三个月后 -->
      <div class="mini-grid">
        <div v-for="m in miniCards" :key="m.label" class="mini-card">
          <div class="mini-label">{{ m.label }} · {{ m.date }}</div>
          <div class="mini-price">{{ m.price.toFixed(2) }} <span class="mini-unit">{{ unit }}</span></div>
          <div class="mini-pct" :class="m.dir">
            {{ m.dir === 'up' ? '↗' : m.dir === 'down' ? '↘' : '→' }} {{ formatSigned(m.pct, 2) }}%
          </div>
        </div>
      </div>

      <!-- 预测详细分析 -->
      <div class="analysis-card">
        <div class="analysis-title">
          <el-icon><DataAnalysis /></el-icon>
          <span>预测详细分析</span>
        </div>
        <div class="analysis-sections">
          <template v-for="(sec, i) in analysisSections" :key="i">
            <div v-if="sec.heading" class="sec-heading">{{ sec.heading }}</div>
            <p v-for="(para, j) in sec.paragraphs" :key="j" class="sec-para">{{ para }}</p>
          </template>
        </div>
      </div>

      <!-- 指标卡片 -->
      <el-row :gutter="12" class="stats-row">
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">最新收盘价</div>
            <div class="stat-value">{{ fmt(lastClose) }}</div>
            <div class="stat-sub">{{ lastDate }} · {{ unit }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">趋势斜率（年化）</div>
            <div class="stat-value" :class="changeClass(annualSlope)">
              {{ formatSigned(annualSlope, 1) }}%
            </div>
            <div class="stat-sub">线性回归斜率 × 252 交易日 / 当前价</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">拟合优度 R²</div>
            <div class="stat-value">{{ fmtR2 }}</div>
            <div class="stat-sub">越接近 1 表示线性趋势解释力越强</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">残差标准差</div>
            <div class="stat-value">{{ fmtResidStd }}</div>
            <div class="stat-sub">模型历史误差水平，决定区间宽度</div>
          </div>
        </el-col>
      </el-row>

      <!-- 预测图 -->
      <div ref="chartRef" class="chart"></div>

      <!-- 预测结果表 -->
      <el-table :data="rows" size="small" stripe class="forecast-table">
        <el-table-column label="关键时点" width="140">
          <template #default="{ row }">
            <span class="future-date">{{ row.date }}</span>
            <el-tag size="small" type="info" effect="plain">第{{ row.k }}日</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="线性回归预测" align="right">
          <template #default="{ row }">
            <span :class="changeClass(row.reg - lastClose)">{{ fmt(row.reg) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Holt 指数平滑预测" align="right">
          <template #default="{ row }">
            <span :class="changeClass(row.holt - lastClose)">{{ fmt(row.holt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="90% 预测区间" align="right" width="240">
          <template #default="{ row }">{{ fmt(row.low) }} ~ {{ fmt(row.high) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 模型说明 -->
    <el-card shadow="never" class="page-card model-card reveal">
      <template #header>
        <div class="header-title">
          <el-icon><InfoFilled /></el-icon>
          <span>模型说明与局限</span>
        </div>
      </template>
      <ul class="model-notes">
        <li><b>线性回归</b>：对所选区间收盘价做时间趋势最小二乘拟合后外推，反映区间内的平均趋势方向。</li>
        <li><b>Holt 双指数平滑</b>：对近期数据赋予更高权重并捕捉趋势变化（自动网格寻优 α={{ fc.alpha }}、β={{ fc.beta }}），对拐点更敏感但容易把短期动能外推过头。</li>
        <li><b>预测区间</b>：按 90% 置信度简化计算（±1.645 × 残差标准差 × √(1+h/n)），随预测步长扩大。</li>
        <li><b>局限</b>：统计模型不知道美联储议息、地缘冲突、央行购金等基本面事件（请参考「事件时间线」与「波动分析-事件归因」页），事件冲击会让价格大幅跳出区间；预测日期按跳过周末的近似交易日计算，不含节假日日历。</li>
      </ul>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { Compass, DataAnalysis, InfoFilled } from '@element-plus/icons-vue'
import { loadGoldPrices } from '@/data/goldPrices'
import { loadEvents } from '@/data/events'
import { loadNews } from '@/data/news'
import { fetchLiveQuotes, type LiveQuotes } from '@/utils/liveQuotes'
import { forecastSeries } from '@/utils/forecast'
import { CHART_LEGEND, CHART_TOOLTIP, CHART_X, CHART_Y } from '@/utils/chartTheme'
import { usePageMotion } from '@/composables/usePageMotion'

const data = loadGoldPrices()
const eventLib = loadEvents()
const newsLib = loadNews()

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

type Kind = 'domestic' | 'intl'
type FitRange = '6m' | '1y' | '3y' | '5y'
const kind = ref<Kind>('domestic')
const fitRange = ref<FitRange>('1y')
const HORIZON = 126 // 6 个月 ≈ 126 个交易日

const RANGE_DAYS: Record<FitRange, number> = { '6m': 180, '1y': 365, '3y': 1095, '5y': 1825 }

const seriesName = computed(() => (kind.value === 'domestic' ? '国内金价 Au99.99' : '国际金价 XAU/USD'))
const unit = computed(() => (kind.value === 'domestic' ? '元/克' : '美元/盎司'))

const liveQuotes = ref<LiveQuotes | null>(null)
let quoteTimer: number | null = null
const todayIso = new Date().toISOString().slice(0, 10)

function scheduleQuotes(ms: number) {
  if (quoteTimer !== null) window.clearTimeout(quoteTimer)
  quoteTimer = window.setTimeout(refreshQuotes, ms)
}

async function refreshQuotes() {
  try {
    liveQuotes.value = await fetchLiveQuotes()
    scheduleQuotes(30000)
  } catch {
    scheduleQuotes(10000)
  }
}

/** 当日实时价（若晚于静态数据尾端，则注入序列参与预测） */
const livePoint = computed<{ date: string; close: number } | null>(() => {
  if (kind.value === 'domestic' && liveQuotes.value?.domestic) {
    return { date: todayIso, close: liveQuotes.value.domestic.price }
  }
  if (kind.value === 'intl' && liveQuotes.value?.intl) {
    return { date: todayIso, close: liveQuotes.value.intl.price }
  }
  return null
})

const allSeries = computed<Array<{ date: string; close: number }>>(() => {
  const base =
    kind.value === 'domestic'
      ? data.domestic.map((p) => ({ date: p.date, close: p.close }))
      : data.internationalDaily.map((p) => ({ date: p.date, close: p.close }))
  const lp = livePoint.value
  if (lp && lp.date > base[base.length - 1].date) {
    return [...base, lp]
  }
  return base
})

const fitted = computed<number[]>(() => {
  const all = allSeries.value
  const lastDate = all[all.length - 1].date
  const cutoff = new Date(lastDate)
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[fitRange.value])
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return all.filter((p) => p.date >= cutoffStr).map((p) => p.close)
})

const lastDate = computed(() => allSeries.value[allSeries.value.length - 1].date)
const lastClose = computed(() => allSeries.value[allSeries.value.length - 1].close)

const fc = computed(() => forecastSeries(fitted.value, HORIZON, lastDate.value))

const annualSlope = computed(() =>
  lastClose.value > 0 ? (fc.value.regSlope * 252 / lastClose.value) * 100 : null,
)
const fmtR2 = computed(() => (fc.value.r2 ?? 0).toFixed(3))
const fmtResidStd = computed(() => `${fc.value.residStd.toFixed(1)} ${unit.value}`)

interface Verdict {
  dir: 'up' | 'down' | 'flat'
  word: string
  target: number
  pct: number
  low: number
  high: number
  reg: number
  holt: number
}

const verdict = computed<Verdict>(() => {
  const h = HORIZON - 1
  const reg = fc.value.reg[h]
  const holt = fc.value.holt[h]
  const target = (reg + holt) / 2
  const pct = lastClose.value > 0 ? ((target - lastClose.value) / lastClose.value) * 100 : 0
  const dir: Verdict['dir'] = pct > 0.3 ? 'up' : pct < -0.3 ? 'down' : 'flat'
  const word = dir === 'up' ? '预计上涨' : dir === 'down' ? '预计下跌' : '预计横盘'
  return {
    dir,
    word,
    target,
    pct,
    low: fc.value.low[h],
    high: fc.value.high[h],
    reg,
    holt,
  }
})

interface Section {
  heading: string
  paragraphs: string[]
}

/** 预测详细分析：全部结论由真实数据计算得出 */
const analysisSections = computed<Section[]>(() => {
  const closes = allSeries.value.map((p) => p.close)
  const n = closes.length
  const last = closes[n - 1]
  const residRel = last > 0 ? (fc.value.residStd / last) * 100 : 0
  const sections: Section[] = []

  // ================= 宏观环境画像 =================
  const macroParas: string[] = []
  const sorted = [...closes].sort((a, b) => a - b)
  const histHigh = sorted[sorted.length - 1]
  const histLow = sorted[0]
  const mean = closes.reduce((a, b) => a + b, 0) / n
  let rank = 0
  for (const v of sorted) if (v <= last) rank++
  const percentile = (rank / n) * 100
  macroParas.push(
    `价格定位：当前 ${last.toFixed(2)} ${unit.value} 处于 ${seriesName.value} 全部历史（${n} 个交易日）的 ${percentile.toFixed(0)}% 分位——即有 ${percentile.toFixed(0)}% 的交易日低于现价。较历史最高 ${histHigh.toFixed(2)} 回撤 ${(((last - histHigh) / histHigh) * 100).toFixed(1)}%，较历史最低 ${histLow.toFixed(2)} 上涨 ${(((last - histLow) / histLow) * 100).toFixed(0)}%，较历史均值 ${mean.toFixed(2)} 高出 ${(((last - mean) / mean) * 100).toFixed(0)}%。${percentile >= 95 ? '当前处于历史极高位区域，意味着"均值回归"与"趋势延续"两种力量并存，波动通常放大。' : percentile >= 80 ? '当前处于历史高位区域，向上空间取决于趋势与事件催化。' : '当前处于历史中枢附近，定价环境相对均衡。'}`,
  )
  // 高位参照：收盘进入历史高点 95% 区域的交易日后 60 日表现
  let hiCnt = 0, hiSum = 0, hiWins = 0
  for (let i = 0; i + 60 < n; i++) {
    if (closes[i] >= histHigh * 0.95) {
      const fwd = ((closes[i + 60] - closes[i]) / closes[i]) * 100
      hiCnt++; hiSum += fwd; if (fwd > 0) hiWins++
    }
  }
  if (hiCnt > 0) {
    macroParas.push(
      `高位参照：历史上收盘价进入历史高点 95% 区域内的交易日共 ${hiCnt} 天，其后 60 个交易日平均涨跌 ${formatSigned(hiSum / hiCnt, 1)}%、上涨概率 ${((hiWins / hiCnt) * 100).toFixed(0)}%——该统计说明当前价位水平下，历史样本的后续表现分布。`,
    )
  }
  // 年度涨幅排名
  const byYear: Record<string, number[]> = {}
  allSeries.value.forEach((p) => {
    const y = p.date.slice(0, 4)
    if (!byYear[y]) byYear[y] = []
    byYear[y].push(p.close)
  })
  const yearReturns: Array<{ y: string; r: number }> = []
  for (const y of Object.keys(byYear).sort()) {
    const arr = byYear[y]
    if (arr.length > 1) yearReturns.push({ y, r: ((arr[arr.length - 1] - arr[0]) / arr[0]) * 100 })
  }
  const ytd = (() => {
    const arr = byYear[lastDate.value.slice(0, 4)] ?? []
    return arr.length > 1 ? ((arr[arr.length - 1] - arr[0]) / arr[0]) * 100 : null
  })()
  if (ytd !== null && yearReturns.length > 0) {
    const better = yearReturns.filter((x) => x.r < ytd).length
    const pos = yearReturns.length - better
    macroParas.push(
      `年度表现：今年迄今（${lastDate.value.slice(0, 4)} 年）累计 ${formatSigned(ytd, 1)}%，在 ${yearReturns.length} 个完整年度中，当前年度涨幅可排第 ${pos} 位；历史上年度涨幅超过 ${Math.abs(ytd).toFixed(0)}% 的年份有 ${yearReturns.filter((x) => Math.abs(x.r) > Math.abs(ytd)).length} 个。`,
    )
  }
  // 事件面
  const recentEvents = eventLib.filter((e) => e.date >= '2023-01-01')
  const posE = recentEvents.filter((e) => e.impact === '利好金价').length
  const negE = recentEvents.filter((e) => e.impact === '利空金价').length
  if (recentEvents.length > 0) {
    const tilt = posE > negE ? '偏多' : posE < negE ? '偏空' : '均衡'
    macroParas.push(
      `事件面：事件库 2023 年以来收录重大事件 ${recentEvents.length} 件（利好 ${posE} / 利空 ${negE} / 中性 ${recentEvents.length - posE - negE}），整体${tilt}。近期标志性事件：${recentEvents.slice(-3).map((e) => e.title.split('：')[0]).join('、')}。事件面决定了金价的"风险溢价"底色：${tilt === '偏多' ? '地缘与信用叙事持续为金价提供支撑。' : tilt === '偏空' ? '事件面压制力量占优，需警惕溢价回吐。' : '事件面多空交织，波动来源分散。'}`,
    )
  }
  // 消息面（标题关键词分类）
  const newsSince = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)
  const recentNews = newsLib.filter((nn) => (nn.time || '').slice(0, 10) >= newsSince)
  const POS_RE = /降息|购金|避险|冲突|战争|制裁|危机|新高|大涨|飙升|突破|刺激|宽松|QE|降准|增持/
  const NEG_RE = /加息|鹰派|缩表|暴跌|抛售|崩盘|违约|爆雷|衰退|通缩|暂停增持|下调评级/
  const posN = recentNews.filter((nn) => POS_RE.test(nn.title)).length
  const negN = recentNews.filter((nn) => NEG_RE.test(nn.title)).length
  if (recentNews.length > 0) {
    macroParas.push(
      `消息面：新闻库近 60 天收录快讯 ${recentNews.length} 条，按标题归类利好 ${posN} / 利空 ${negN} / 中性 ${recentNews.length - posN - negN}，市场情绪${posN > negN ? '偏暖' : posN < negN ? '偏冷' : '中性'}。`,
    )
  }
  // 内外联动（隐含汇率口径）
  const intlLast = data.internationalDaily[data.internationalDaily.length - 1].close
  const intlRef = liveQuotes.value?.intl?.price ?? intlLast
  if (intlRef > 0 && last > 0) {
    const usdPerGram = intlRef / 31.1035
    const impliedFx = last / usdPerGram
    macroParas.push(
      `内外联动：国际金价 ${intlRef.toFixed(2)} 美元/盎司折合 ${usdPerGram.toFixed(2)} 美元/克；国内 Au99.99 现价 ${last.toFixed(2)} 元/克对应隐含汇率 ${impliedFx.toFixed(2)} 元/美元（含税费与内外供需价差）。隐含汇率相对即期汇率的偏离即内外价差：溢价走阔通常对应内盘买需偏强、走弱情绪敏感，收窄则相反。`,
    )
  }
  if (macroParas.length > 0) sections.push({ heading: '宏观环境画像', paragraphs: macroParas })

  // ================= 各时点深度分析 =================
  const PERIODS = [
    { key: 1, label: '明天', risk: '隔夜风险最大：国内金价开盘跟随隔夜国际盘与汇率，单一交易日噪声极高，该时点预测仅供参考。', watch: '隔夜 COMEX 金价与人民币汇率决定次日开盘价；关注当日有无重要数据发布或官员讲话。' },
    { key: 5, label: '一周后', risk: '一周窗口内突发新闻（美联储官员讲话、地缘消息）可能造成跳空，短期预测容易被事件打断。', watch: '本周美国通胀/就业数据与美联储官员讲话可能引发波动，注意 ETF/CFTC 持仓的边际变化。' },
    { key: 22, label: '一个月后', risk: '一个月窗口可能跨越美联储议息会议与重要经济数据，利率预期的变化是主要扰动源。', watch: '该窗口大概率跨越美联储议息会议，利率路径预期是核心宏观变量；同时关注央行月度购金数据。' },
    { key: 66, label: '三个月后', risk: '三个月窗口足以容纳一轮政策转向或地缘冲突的演化，趋势外推的失效概率明显上升。', watch: '关注全球央行购金季度数据、地缘局势演变与美元指数趋势，三者决定中期方向。' },
    { key: 126, label: '六个月后', risk: '六个月维度上基本面（实际利率、央行购金节奏、美元周期）可能整体漂移，模型外推仅代表"当前趋势不变"的假设情形。', watch: '美元周期、实际利率中枢与央行购金节奏的持续性，是六个月维度的核心宏观主线。' },
  ]

  // 均线结构（全序列，与品种一致）
  const MAS = [5, 10, 20, 60]
  const maVals = MAS.map((d) => (n >= d ? closes.slice(-d).reduce((a, b) => a + b, 0) / d : null))
  const maNames = ['5日', '10日', '20日', '60日']
  const maText = maVals.map((v, i2) => (v !== null ? `${maNames[i2]}均线 ${v.toFixed(1)}` : '')).filter(Boolean).join('、')
  const alignUp = maVals.every((v, i2) => i2 === 0 || v === null || maVals[i2 - 1] === null || (maVals[i2 - 1] as number) >= v)
  const alignDown = maVals.every((v, i2) => i2 === 0 || v === null || maVals[i2 - 1] === null || (maVals[i2 - 1] as number) <= v)
  const maState = alignUp ? '短均线整体位于长均线之上，呈多头排列，趋势结构对多头有利' : alignDown ? '短均线整体位于长均线之下，呈空头排列，趋势结构对空头有利' : '均线交织，趋势方向不清晰，行情更可能以震荡为主'

  // 近端动能
  const r5 = n > 5 ? ((last - closes[n - 6]) / closes[n - 6]) * 100 : null
  const r10 = n > 10 ? ((last - closes[n - 11]) / closes[n - 11]) * 100 : null
  let upStreak = 0
  let iUp = n - 1
  while (iUp > 0 && closes[iUp] > closes[iUp - 1]) { upStreak++; iUp-- }
  let downStreak = 0
  let iDn = n - 1
  while (iDn > 0 && closes[iDn] < closes[iDn - 1]) { downStreak++; iDn-- }
  const streakText = upStreak > 0 ? `已连涨 ${upStreak} 个交易日` : downStreak > 0 ? `已连跌 ${downStreak} 个交易日` : '近两日涨跌交替'

  for (const P of PERIODS) {
    const i = P.key - 1
    const reg = fc.value.reg[i]
    const holt = fc.value.holt[i]
    const price = (reg + holt) / 2
    const pctVal = last > 0 ? ((price - last) / last) * 100 : 0
    const low = fc.value.low[i]
    const high = fc.value.high[i]
    const width = price > 0 ? ((high - low) / price) * 100 : 0
    const divergence = price > 0 ? (Math.abs(reg - holt) / price) * 100 : 0

    const curRet = (() => {
      if (n <= P.key) return null
      return ((last - closes[n - P.key - 1]) / closes[n - P.key - 1]) * 100
    })()
    let cnt = 0, sum = 0, wins = 0, best = -Infinity, worst = Infinity
    if (curRet !== null) {
      for (let j = P.key; j + P.key < n; j++) {
        const pastRet = ((closes[j] - closes[j - P.key]) / closes[j - P.key]) * 100
        if (Math.abs(pastRet - curRet) <= 1.5) {
          const fwd = ((closes[j + P.key] - closes[j]) / closes[j]) * 100
          cnt++; sum += fwd
          if (fwd > 0) wins++
          if (fwd > best) best = fwd
          if (fwd < worst) worst = fwd
        }
      }
    }
    const analogAvg = cnt > 0 ? sum / cnt : null
    const analogWin = cnt > 0 ? (wins / cnt) * 100 : null

    const paras: string[] = []
    paras.push(
      `预测值：${fc.value.dates[i]}（${P.label}），线性回归 ${reg.toFixed(2)} ${unit.value}、Holt 平滑 ${holt.toFixed(2)} ${unit.value}，两者均值 ${price.toFixed(2)} ${unit.value}，较当前 ${formatSigned(pctVal, 2)}%；90% 区间 ${low.toFixed(0)} ~ ${high.toFixed(0)} ${unit.value}（宽度 ${width.toFixed(0)}%）。`,
    )
    paras.push(
      `两模型分别解读：线性回归外推的是"区间平均趋势"，其斜率对应年化 ${formatSigned(annualSlope.value, 1)}%，代表慢变量；Holt 平滑（α=${fc.value.alpha}、β=${fc.value.beta}）对近端数据加权，代表近期节奏。${divergence < 1 ? `两模型相差仅 ${divergence.toFixed(1)}%，结论互相印证，可靠性相对较高。` : `两模型相差 ${divergence.toFixed(1)}%，说明"区间平均趋势"与"近期动能"存在张力，可将两者均值视为基准情形、区间视为波动范围。`}`,
    )
    paras.push(`区间含义：${width.toFixed(0)}% 的区间宽度由历史残差波动 ${residRel.toFixed(1)}% 与预测步长共同决定——按历史统计，未来 ${P.key} 日价格约有 90% 的概率落在该区间内，约 5% 概率高于上沿、5% 低于下沿。步长越长、历史波动越大，区间越宽，这是不确定性随时间的自然放大。`)
    if (analogAvg !== null) {
      paras.push(
        `历史参照（${P.label}维度）：历史上与当前近 ${P.key} 日动能（${formatSigned(curRet, 1)}%）相近的情形共 ${cnt} 次，其后 ${P.key} 个交易日平均 ${formatSigned(analogAvg, 1)}%，上涨概率 ${(analogWin ?? 0).toFixed(0)}%；其中最好情形 ${formatSigned(best, 1)}%、最差情形 ${formatSigned(worst, 1)}%——这组数据展示了同样动能条件下，历史结果的完整分布而非单点结论。`,
      )
    }
    paras.push(`均线结构：${maText}。${maState}。`)
    paras.push(`近端动能：近 5 日 ${formatSigned(r5, 1)}%、近 10 日 ${formatSigned(r10, 1)}%；${streakText}。`)
    paras.push(`时段风险：${P.risk}`)
    paras.push(`宏观关注：${P.watch}`)
    const conclusion = pctVal > 0.3 ? '模型倾向向上，但请以区间而非点值作为决策基准' : pctVal < -0.3 ? '模型倾向向下，同样请以区间为决策基准' : '模型倾向横盘震荡，方向不明时区间中轴参考价值有限'
    paras.push(`结论：${P.label}（${fc.value.dates[i]}）模型预计 ${formatSigned(pctVal, 1)}%（均值口径），${conclusion}。`)
    sections.push({ heading: `${P.label}（${fc.value.dates[i]}）`, paragraphs: paras })
  }

  return sections
})

const MINI_HORIZONS = [
  { key: 1, label: '明天' },
  { key: 5, label: '一周后' },
  { key: 22, label: '一个月后' },
  { key: 66, label: '三个月后' },
]

const miniCards = computed(() =>
  MINI_HORIZONS.map(({ key, label }) => {
    const i = key - 1
    const reg = fc.value.reg[i]
    const holt = fc.value.holt[i]
    const target = (reg + holt) / 2
    const pct = lastClose.value > 0 ? ((target - lastClose.value) / lastClose.value) * 100 : 0
    const dir: 'up' | 'down' | 'flat' = pct > 0.15 ? 'up' : pct < -0.15 ? 'down' : 'flat'
    return { label, date: fc.value.dates[i], price: target, pct, dir }
  }),
)

interface Row {
  k: number
  date: string
  reg: number
  holt: number
  low: number
  high: number
}
const KEY_DAYS = [1, 5, 22, 66, 126]
const rows = computed<Row[]>(() =>
  KEY_DAYS.map((k) => ({
    k,
    date: fc.value.dates[k - 1],
    reg: fc.value.reg[k - 1],
    holt: fc.value.holt[k - 1],
    low: fc.value.low[k - 1],
    high: fc.value.high[k - 1],
  })),
)

// ---- 图表 ----
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function renderChart() {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)
  const hist = fitted.value
  const f = fc.value
  const histDates = allSeries.value.slice(-hist.length).map((p) => p.date)
  const allDates = [...histDates, ...f.dates]
  const padHist = (v: number[], total: number) => [...v, ...new Array(total - v.length).fill(null)]
  const padFut = (v: number[], total: number) => [...new Array(total - v.length).fill(null), ...v]

  chart.setOption(
    {
      animationDuration: 900,
      animationEasing: 'cubicOut',
      animationDurationUpdate: 600,
      animationEasingUpdate: 'cubicOut',
      grid: { left: 60, right: 24, top: 40, bottom: 44 },
      legend: { ...CHART_LEGEND, data: ['历史收盘', '线性回归预测', 'Holt 预测', '90% 预测区间'], top: 4 },
      tooltip: {
        ...CHART_TOOLTIP,
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{ seriesName: string; axisValue: string; data: number | null }>
          const lines = list
            .filter((p) => p.data !== null)
            .map((p) => `${p.seriesName}：${p.data!.toFixed(2)}`)
          return `${list[0]?.axisValue ?? ''}<br/>${lines.join('<br/>')}`
        },
      },
      xAxis: { ...CHART_X, type: 'category', data: allDates },
      yAxis: { ...CHART_Y, type: 'value', scale: true, name: unit.value },
      series: [
        {
          name: '历史收盘', type: 'line', data: padHist(hist, allDates.length),
          showSymbol: false, lineStyle: { width: 2.5, color: '#b08a3e' }, itemStyle: { color: '#b08a3e' },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(176, 138, 62, 0.18)' },
              { offset: 1, color: 'rgba(176, 138, 62, 0.02)' },
            ]),
          },
        },
        {
          name: '线性回归预测', type: 'line', data: padFut(f.reg, allDates.length),
          showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: '#5b7c99' },
          itemStyle: { color: '#5b7c99' },
        },
        {
          name: 'Holt 预测', type: 'line', data: padFut(f.holt, allDates.length),
          showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: '#b0654e' },
          itemStyle: { color: '#b0654e' },
        },
        {
          name: '区间下沿', type: 'line', data: padFut(f.low, allDates.length),
          showSymbol: false, stack: 'band', lineStyle: { opacity: 0 }, itemStyle: { opacity: 0 },
        },
        {
          name: '90% 预测区间', type: 'line',
          data: padFut(f.high.map((h, i) => h - f.low[i]), allDates.length),
          showSymbol: false, stack: 'band', lineStyle: { opacity: 0 },
          areaStyle: { color: 'rgba(91, 124, 153, 0.12)' },
        },
      ],
    },
    { notMerge: true },
  )
}

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleResize)
  refreshQuotes()
})

watch([kind, fitRange], () => {
  renderChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (quoteTimer !== null) window.clearTimeout(quoteTimer)
  chart?.dispose()
  chart = null
})

// ---- 格式化 ----
function fmt(v: number | null | undefined): string {
  return v === null || v === undefined ? '--' : v.toFixed(2)
}
function formatSigned(v: number | null, digits = 1): string {
  if (v === null) return '--'
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`
}
function changeClass(v: number | null): string {
  if (v === null) return ''
  if (v > 0) return 'up'
  if (v < 0) return 'down'
  return ''
}
</script>

<style scoped>
.page {
  padding: 12px 0 48px;
}
.disclaimer {
  margin-bottom: 20px;
}
.page-card {
  border: none;
  border-radius: 18px;
}
.model-card {
  margin-top: 24px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 17px;
  letter-spacing: -0.01em;
  flex-wrap: wrap;
}
.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.control-label {
  font-size: 12px;
  color: #4a4a50;
}
.verdict {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  border-radius: 16px;
  padding: 22px 26px;
  margin-bottom: 20px;
  color: #fff;
}
.verdict.up {
  background: linear-gradient(135deg, #7e2a24 0%, #a8453b 100%);
}
.verdict.down {
  background: linear-gradient(135deg, #1f5136 0%, #3c6b4c 100%);
}
.verdict.flat {
  background: linear-gradient(135deg, #3a3a40 0%, #55555a 100%);
}
.verdict-label {
  font-size: 14px;
  font-weight: 600;
  color: #ffffff;
}
.verdict-main {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 8px;
}
.verdict-arrow {
  font-size: 38px;
  font-weight: 800;
  color: #ffffff;
}
.verdict-word {
  font-size: 34px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: #ffffff;
}
.verdict-sub {
  margin-top: 8px;
  font-size: 15px;
  font-weight: 500;
  color: #ffffff;
}
.verdict-right {
  text-align: right;
}
.verdict-band {
  font-size: 15px;
  font-weight: 700;
  color: #ffffff;
}
.verdict-meta {
  margin-top: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.95);
}
.mini-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.mini-card {
  background: #ffffff;
  border: 1px solid #e6e6ec;
  border-radius: 14px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.03);
}
.mini-label {
  font-size: 12px;
  color: #4a4a50;
}
.mini-price {
  font-size: 20px;
  font-weight: 600;
  color: #1d1d1f;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  margin-top: 6px;
}
.mini-unit {
  font-size: 11px;
  font-weight: 400;
  color: #4a4a50;
}
.mini-pct {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 600;
}
.mini-pct.up {
  color: #c65f57;
}
.mini-pct.down {
  color: #4c8a63;
}
.mini-pct.flat {
  color: #6e6e73;
}
.analysis-card {
  background: #ffffff;
  border: none;
  border-radius: 16px;
  padding: 22px 26px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 12px 32px rgba(0, 0, 0, 0.05);
  margin-bottom: 20px;
}
.analysis-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.01em;
  margin-bottom: 14px;
}
.sec-heading {
  font-size: 14px;
  font-weight: 700;
  color: #8a6d1f;
  margin: 14px 0 6px;
}
.sec-heading:first-child {
  margin-top: 0;
}
.sec-para {
  margin: 0 0 8px;
  font-size: 14px;
  color: #1d1d1f;
  line-height: 2;
  text-align: justify;
}
.stats-row {
  margin-bottom: 20px;
}
.stat-item {
  background: #ffffff;
  border: none;
  border-radius: 16px;
  padding: 18px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03), 0 12px 32px rgba(0, 0, 0, 0.05);
}
.stat-label {
  font-size: 12px;
  color: #4a4a50;
}
.stat-value {
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #1d1d1f;
  margin-top: 4px;
}
.stat-sub {
  font-size: 12px;
  color: #4a4a50;
  margin-top: 4px;
}
.up {
  color: #c65f57;
}
.down {
  color: #5a9167;
}
.chart {
  width: 100%;
  height: 440px;
}
.forecast-table {
  margin-top: 20px;
}
.future-date {
  font-weight: 600;
  margin-right: 6px;
}
.model-notes {
  margin: 0;
  padding-left: 20px;
  line-height: 2;
  font-size: 13px;
  color: #232326;
}
@media (max-width: 768px) {
  .chart {
    height: 300px;
  }
  .verdict-word {
    font-size: 24px;
  }
  .mini-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
