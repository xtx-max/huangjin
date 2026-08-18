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
import { Compass, InfoFilled } from '@element-plus/icons-vue'
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
  color: #8a877d;
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
  color: #8a877d;
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
  color: #8a877d;
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
  color: #57544c;
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
