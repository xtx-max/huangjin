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
            <span class="control-label">预测步长</span>
            <el-radio-group v-model="horizon" size="small">
              <el-radio-button :label="30">30日</el-radio-button>
              <el-radio-button :label="60">60日</el-radio-button>
              <el-radio-button :label="90">90日</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>

      <!-- 预测结论卡：一眼看出涨跌 -->
      <div class="verdict" :class="verdict.dir">
        <div class="verdict-left">
          <div class="verdict-label">
            未来 {{ horizon }} 个交易日 · {{ seriesName }} · 统计模型预测
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
        <el-table-column label="预测时点" width="130">
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
import { forecastSeries } from '@/utils/forecast'
import { CHART_LEGEND, CHART_TOOLTIP, CHART_X, CHART_Y } from '@/utils/chartTheme'
import { usePageMotion } from '@/composables/usePageMotion'

const data = loadGoldPrices()

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

type Kind = 'domestic' | 'intl'
type FitRange = '6m' | '1y' | '3y' | '5y'
const kind = ref<Kind>('domestic')
const fitRange = ref<FitRange>('1y')
const horizon = ref<number>(60)

const RANGE_DAYS: Record<FitRange, number> = { '6m': 180, '1y': 365, '3y': 1095, '5y': 1825 }

const seriesName = computed(() => (kind.value === 'domestic' ? '国内金价 Au99.99' : '国际金价 XAU/USD'))
const unit = computed(() => (kind.value === 'domestic' ? '元/克' : '美元/盎司'))

const allSeries = computed<Array<{ date: string; close: number }>>(() =>
  kind.value === 'domestic'
    ? data.domestic.map((p) => ({ date: p.date, close: p.close }))
    : data.internationalDaily.map((p) => ({ date: p.date, close: p.close })),
)

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

const fc = computed(() => forecastSeries(fitted.value, horizon.value, lastDate.value))

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
  const h = horizon.value - 1
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
  const fit = fitted.value
  const fitLen = fit.length
  const fitChange = fit[0] > 0 ? ((fit[fitLen - 1] - fit[0]) / fit[0]) * 100 : 0
  const pct = (days: number): number | null => {
    if (n <= days) return null
    return ((last - closes[n - days - 1]) / closes[n - days - 1]) * 100
  }
  const ma = (days: number): number | null => {
    if (n < days) return null
    const slice = closes.slice(-days)
    return slice.reduce((a, b) => a + b, 0) / days
  }
  const ma20 = ma(20)
  const ma60 = ma(60)
  const r2 = fc.value.r2
  const residRel = last > 0 ? (fc.value.residStd / last) * 100 : 0
  const p30 = pct(30)
  const p60 = pct(60)
  const p90 = pct(90)

  // 历史参照：扫描全历史，找"过去 H 日涨幅与当前接近"的时期，统计其后 H 日实际表现
  const h = horizon.value
  const curRet = pct(h)
  let cnt = 0
  let sum = 0
  let wins = 0
  if (curRet !== null) {
    for (let i = h; i + h < n; i++) {
      const pastRet = ((closes[i] - closes[i - h]) / closes[i - h]) * 100
      if (Math.abs(pastRet - curRet) <= 2) {
        const fwd = ((closes[i + h] - closes[i]) / closes[i]) * 100
        cnt++
        sum += fwd
        if (fwd > 0) wins++
      }
    }
  }
  const analogAvg = cnt > 0 ? sum / cnt : null
  const analogWin = cnt > 0 ? (wins / cnt) * 100 : null

  const s1: string[] = [
    `拟合区间（近${fitRange.value === '6m' ? '6个月' : fitRange.value === '1y' ? '1年' : fitRange.value === '3y' ? '3年' : '5年'}，${fitLen} 个交易日）累计涨跌幅 ${formatSigned(fitChange, 2)}%，趋势斜率年化 ${formatSigned(annualSlope.value, 1)}%。`,
    `动量面：近 30 日 ${formatSigned(p30, 1)}%、近 60 日 ${formatSigned(p60, 1)}%、近 90 日 ${formatSigned(p90, 1)}%；现价${ma20 !== null ? `位于 20 日均线${last >= ma20 ? '上方' : '下方'} ${Math.abs(((last - ma20) / ma20) * 100).toFixed(1)}%、` : ''}${ma60 !== null ? `位于 60 日均线${last >= ma60 ? '上方' : '下方'} ${Math.abs(((last - ma60) / ma60) * 100).toFixed(1)}%。` : ''}`,
    `模型质量：线性拟合优度 R²=${r2.toFixed(3)}（${r2 > 0.8 ? '趋势解释力强，外推相对可信' : r2 > 0.5 ? '趋势解释力中等' : '趋势解释力弱，方向判断需谨慎'}）；残差相对波动 ${residRel.toFixed(1)}%，决定预测区间宽度。`,
  ]
  const support: string[] = []
  const risk: string[] = []
  if ((annualSlope.value ?? 0) > 0) support.push('区间趋势斜率为正，模型延续上涨惯性')
  else if ((annualSlope.value ?? 0) < 0) support.push('区间趋势斜率为负，模型延续下跌惯性')
  if (ma20 !== null && last >= ma20) support.push('现价站上 20 日均线，短线动能偏多')
  if (ma60 !== null && last >= ma60) support.push('现价站上 60 日均线，中期趋势偏多')
  if (ma20 !== null && last < ma20) risk.push('现价跌破 20 日均线，短线动能转弱')
  if (ma60 !== null && last < ma60) risk.push('现价跌破 60 日均线，中期趋势承压')
  if (r2 < 0.5) risk.push('R² 偏低，线性趋势对该区间解释力不足，方向存在反转可能')
  if (residRel > 2.5) risk.push('历史波动较大，预测区间很宽，实际落点不确定性高')
  if ((p90 ?? 0) > 15) risk.push('近 90 日已上涨超过 15%，短期追高与均值回归风险上升')
  if ((p90 ?? 0) < -15) risk.push('近 90 日已下跌超过 15%，超跌反弹与惯性下杀并存')
  if (support.length === 0) support.push('当前无显著的多头信号，模型结论主要来自区间趋势外推')
  if (risk.length === 0) risk.push('当前无显著的异常风险信号，主要风险来自基本面事件冲击')

  const s3: string[] = []
  if (analogAvg !== null) {
    s3.push(
      `在 ${seriesName.value} 全部历史中，出现与当前近 ${h} 日动能（${formatSigned(curRet, 1)}%）相近的情形共 ${cnt} 次；这 ${cnt} 次之后的 ${h} 个交易日平均涨跌 ${formatSigned(analogAvg, 1)}%，其中上涨 ${(analogWin ?? 0).toFixed(0)}% / 下跌 ${(100 - (analogWin ?? 0)).toFixed(0)}%。`,
      `注意：历史相似情形只是统计参照，每次行情的宏观环境与事件背景都不同，不能机械套用。`,
    )
  } else {
    s3.push('历史数据长度不足，无法生成动能相似情形的统计参照。')
  }

  const s4: string[] = [
    '统计模型只看到价格本身：它不知道美联储议息、地缘冲突、央行购金等基本面事件。事件冲击会瞬间改写趋势（参考本站「事件时间线」与「波动分析-事件归因」）。',
    '预测区间是 90% 置信度的统计区间，并非"保证落在其中"；预测步长越长、历史波动越大，不确定性越高。本预测不构成投资建议。',
  ]

  return [
    { heading: '趋势依据', paragraphs: s1 },
    { heading: '多空因素', paragraphs: [`【支撑】${support.join('；')}。`, `【风险】${risk.join('；')}。`] },
    { heading: '历史参照', paragraphs: s3 },
    { heading: '风险提示', paragraphs: s4 },
  ]
})

interface Row {
  k: number
  date: string
  reg: number
  holt: number
  low: number
  high: number
}
const rows = computed<Row[]>(() =>
  fc.value.dates.map((d, i) => ({
    k: i + 1,
    date: d,
    reg: fc.value.reg[i],
    holt: fc.value.holt[i],
    low: fc.value.low[i],
    high: fc.value.high[i],
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
})

watch([kind, fitRange, horizon], () => {
  renderChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
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
  background: linear-gradient(135deg, #a33b32 0%, #c65f57 100%);
}
.verdict.down {
  background: linear-gradient(135deg, #2f6b48 0%, #4c8a63 100%);
}
.verdict.flat {
  background: linear-gradient(135deg, #4a4a50 0%, #6e6e73 100%);
}
.verdict-label {
  font-size: 13px;
  opacity: 0.85;
}
.verdict-main {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 8px;
}
.verdict-arrow {
  font-size: 34px;
  font-weight: 700;
}
.verdict-word {
  font-size: 32px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.verdict-sub {
  margin-top: 8px;
  font-size: 14px;
  opacity: 0.92;
}
.verdict-right {
  text-align: right;
}
.verdict-band {
  font-size: 15px;
  font-weight: 600;
}
.verdict-meta {
  margin-top: 8px;
  font-size: 12px;
  opacity: 0.8;
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
}
</style>
