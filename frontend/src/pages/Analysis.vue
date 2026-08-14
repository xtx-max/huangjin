<template>
  <div class="page">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><DataAnalysis /></el-icon>
            <span>金价波动分析</span>
            <el-tag size="small" type="warning" effect="plain">国际金价 XAU/USD</el-tag>
          </div>
          <el-radio-group v-model="range" size="small">
            <el-radio-button label="1y">近1年</el-radio-button>
            <el-radio-button label="5y">近5年</el-radio-button>
            <el-radio-button label="10y">近10年</el-radio-button>
            <el-radio-button label="20y">近20年</el-radio-button>
            <el-radio-button label="all">全部</el-radio-button>
          </el-radio-group>
        </div>
      </template>

      <!-- 指标卡片 -->
      <el-row :gutter="12" class="stats-row">
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">区间总涨幅</div>
            <div class="stat-value" :class="changeClass(analysis.totalChange)">
              {{ formatSigned(analysis.totalChange, 2) }}%
            </div>
            <div class="stat-sub">{{ rangeText }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">年化收益率</div>
            <div class="stat-value" :class="changeClass(analysis.annualized)">
              {{ formatSigned(analysis.annualized, 2) }}%
            </div>
            <div class="stat-sub">按 252 个交易日折算</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">年波动率</div>
            <div class="stat-value">{{ fmtPct(analysis.volatility) }}</div>
            <div class="stat-sub">日收益率标准差 × √252</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">最大回撤</div>
            <div class="stat-value down">{{ fmtPct(analysis.maxDrawdown) }}</div>
            <div class="stat-sub">{{ analysis.maxDrawdownDate || '--' }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- 价格与均线图 -->
      <div ref="priceChartRef" class="chart"></div>
      <!-- 回撤子图 -->
      <div ref="ddChartRef" class="chart dd-chart"></div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { DataAnalysis } from '@element-plus/icons-vue'
import { loadGoldPrices, type PricePoint } from '@/data/goldPrices'

const data = loadGoldPrices()

type RangeKey = '1y' | '5y' | '10y' | '20y' | 'all'
const range = ref<RangeKey>('20y')

const RANGE_DAYS: Record<RangeKey, number | null> = {
  '1y': 365,
  '5y': 1825,
  '10y': 3650,
  '20y': 7300,
  all: null,
}

const rangeText = computed(() => {
  const a = analysis.value
  if (!a.firstDate || !a.lastDate) return '--'
  return `${a.firstDate} ~ ${a.lastDate}（${a.points.length} 个交易日）`
})

function movingAverage(closes: number[], n: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null)
  let sum = 0
  for (let i = 0; i < closes.length; i++) {
    sum += closes[i]
    if (i >= n) sum -= closes[i - n]
    if (i >= n - 1) out[i] = sum / n
  }
  return out
}

interface Analysis {
  points: PricePoint[]
  ma20: (number | null)[]
  ma60: (number | null)[]
  ma120: (number | null)[]
  ddPct: number[]
  totalChange: number | null
  annualized: number | null
  volatility: number | null
  maxDrawdown: number | null
  maxDrawdownDate: string
  firstDate: string
  lastDate: string
}

const EMPTY_ANALYSIS: Analysis = {
  points: [], ma20: [], ma60: [], ma120: [], ddPct: [],
  totalChange: null, annualized: null, volatility: null,
  maxDrawdown: null, maxDrawdownDate: '', firstDate: '', lastDate: '',
}

const analysis = computed<Analysis>(() => {
  const all = data.internationalDaily
  if (!all || all.length === 0) return EMPTY_ANALYSIS
  const days = RANGE_DAYS[range.value]
  let points = all
  if (days !== null) {
    const lastDate = all[all.length - 1].date
    const cutoff = new Date(lastDate)
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    points = all.filter((p) => p.date >= cutoffStr)
  }
  if (points.length === 0) return EMPTY_ANALYSIS

  const closes = points.map((p) => p.close)

  // 日收益率与回撤
  const returns: number[] = []
  let cumMax = closes[0]
  let minDD = 0
  let minDDIdx = 0
  const ddPct: number[] = [0]
  for (let i = 1; i < closes.length; i++) {
    returns.push(closes[i] / closes[i - 1] - 1)
    if (closes[i] > cumMax) cumMax = closes[i]
    const dd = closes[i] / cumMax - 1
    ddPct.push(dd * 100)
    if (dd < minDD) {
      minDD = dd
      minDDIdx = i
    }
  }

  // 年波动率：日收益率标准差(样本) × √252
  let volatility: number | null = null
  if (returns.length > 1) {
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance =
      returns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (returns.length - 1)
    volatility = Math.sqrt(variance) * Math.sqrt(252) * 100
  }

  // 年化收益率：(末/首)^(252/区间交易日) - 1
  let annualized: number | null = null
  if (closes.length > 1 && closes[0] > 0) {
    annualized = (Math.pow(closes[closes.length - 1] / closes[0], 252 / (closes.length - 1)) - 1) * 100
  }

  const totalChange =
    closes[0] > 0 ? ((closes[closes.length - 1] - closes[0]) / closes[0]) * 100 : null

  return {
    points,
    ma20: movingAverage(closes, 20),
    ma60: movingAverage(closes, 60),
    ma120: movingAverage(closes, 120),
    ddPct,
    totalChange,
    annualized,
    volatility,
    maxDrawdown: minDD * 100,
    maxDrawdownDate: points[minDDIdx].date,
    firstDate: points[0].date,
    lastDate: points[points.length - 1].date,
  }
})

// ---- 图表 ----
const priceChartRef = ref<HTMLDivElement | null>(null)
const ddChartRef = ref<HTMLDivElement | null>(null)
let priceChart: echarts.ECharts | null = null
let ddChart: echarts.ECharts | null = null

function renderCharts() {
  const a = analysis.value
  if (!priceChartRef.value || !ddChartRef.value) return
  if (!priceChart) priceChart = echarts.init(priceChartRef.value)
  if (!ddChart) ddChart = echarts.init(ddChartRef.value)

  if (a.points.length === 0) {
    priceChart.clear()
    ddChart.clear()
    return
  }
  const dates = a.points.map((p) => p.date)
  priceChart.setOption(
    {
      grid: { left: 60, right: 24, top: 40, bottom: 44 },
      legend: { data: ['收盘价', 'MA20', 'MA60', 'MA120'], top: 4 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{ seriesName: string; axisValue: string; data: number | null }>
          const lines = list
            .filter((p) => p.data !== null)
            .map((p) => `${p.seriesName}：${p.data!.toFixed(2)}`)
          return `${list[0]?.axisValue ?? ''}<br/>${lines.join('<br/>')}`
        },
      },
      xAxis: { type: 'category', data: dates, boundaryGap: false },
      yAxis: { type: 'value', scale: true, name: '美元/盎司' },
      series: [
        {
          name: '收盘价', type: 'line', data: a.points.map((p) => p.close),
          showSymbol: false, lineStyle: { width: 2, color: '#c8a24b' },
          itemStyle: { color: '#c8a24b' },
        },
        {
          name: 'MA20', type: 'line', data: a.ma20, showSymbol: false,
          lineStyle: { width: 1.2, color: '#409eff' }, itemStyle: { color: '#409eff' },
        },
        {
          name: 'MA60', type: 'line', data: a.ma60, showSymbol: false,
          lineStyle: { width: 1.2, color: '#f56c6c' }, itemStyle: { color: '#f56c6c' },
        },
        {
          name: 'MA120', type: 'line', data: a.ma120, showSymbol: false,
          lineStyle: { width: 1.2, color: '#9266f9' }, itemStyle: { color: '#9266f9' },
        },
      ],
    },
    { notMerge: true },
  )

  ddChart.setOption(
    {
      grid: { left: 60, right: 24, top: 20, bottom: 44 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{ axisValue: string; data: number }>
          return `${list[0]?.axisValue ?? ''}<br/>回撤：${list[0]?.data.toFixed(2) ?? '--'}%`
        },
      },
      xAxis: { type: 'category', data: dates, boundaryGap: false },
      yAxis: { type: 'value', name: '回撤 %', max: 0 },
      series: [
        {
          name: '回撤', type: 'line', data: a.ddPct, showSymbol: false,
          lineStyle: { width: 1.2, color: '#f56c6c' }, itemStyle: { color: '#f56c6c' },
          areaStyle: { color: 'rgba(245, 108, 108, 0.15)' },
        },
      ],
    },
    { notMerge: true },
  )
}

function handleResize() {
  priceChart?.resize()
  ddChart?.resize()
}

onMounted(() => {
  renderCharts()
  window.addEventListener('resize', handleResize)
})

watch(range, () => {
  renderCharts()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  priceChart?.dispose()
  ddChart?.dispose()
  priceChart = null
  ddChart = null
})

// ---- 格式化 ----
function formatSigned(v: number | null, digits = 2): string {
  if (v === null) return '--'
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`
}

function fmtPct(v: number | null): string {
  return v === null ? '--' : `${v.toFixed(2)}%`
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
  padding: 8px 0;
}
.page-card {
  border: none;
  border-radius: 8px;
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
  font-size: 16px;
}
.stats-row {
  margin-bottom: 16px;
}
.stat-item {
  background: #fafafa;
  border-radius: 8px;
  padding: 12px 16px;
}
.stat-label {
  font-size: 12px;
  color: #909399;
}
.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #303133;
  margin-top: 4px;
}
.stat-sub {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}
.up {
  color: #f56c6c;
}
.down {
  color: #67c23a;
}
.chart {
  width: 100%;
  height: 380px;
  margin-top: 8px;
}
.dd-chart {
  height: 220px;
}
@media (max-width: 768px) {
  .chart {
    height: 280px;
  }
}
</style>
