<template>
  <div class="page" ref="pageRoot">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><DataAnalysis /></el-icon>
            <span>金价波动分析</span>
            <el-tag size="small" type="warning" effect="plain">国际金价 XAU/USD</el-tag>
            <el-tag size="small" type="info" effect="plain">▲ 图上标记为区间内重大事件</el-tag>
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
      <el-row :gutter="12" class="stats-row reveal">
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

      <!-- 价格与均线图（含事件标注） -->
      <div ref="priceChartRef" class="chart reveal"></div>
      <!-- 回撤子图 -->
      <div ref="ddChartRef" class="chart dd-chart reveal"></div>
    </el-card>

    <!-- 区间事件归因 -->
    <el-card shadow="never" class="page-card attribution-card reveal">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Flag /></el-icon>
            <span>区间事件归因</span>
            <span class="count">本区间内 {{ rangeEvents.length }} 件影响金价的事件</span>
          </div>
          <span class="attribution-tip">点击行可定位图上标注并查看完整分析；1970-2004 为月度数据</span>
        </div>
      </template>
      <el-table v-if="rangeEvents.length > 0" :data="rangeEvents" size="small" stripe class="motion-rows">
        <el-table-column label="事件" min-width="250">
          <template #default="{ row }">
            <span class="event-link" @click="jumpToEvent(row)">{{ row.event.title }}</span>
            <div class="event-date-sub">{{ row.event.date }}</div>
          </template>
        </el-table-column>
        <el-table-column label="影响" width="100" align="center">
          <template #default="{ row }">
            <el-tag size="small" :type="impactTagType(row.event.impact)" effect="dark">
              {{ row.event.impact }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="后30日" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.post30 === null">--</span>
            <span v-else :class="changeClass(row.post30)">{{ formatSigned(row.post30, 1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="后90日" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.post90 === null">--</span>
            <span v-else :class="changeClass(row.post90)">{{ formatSigned(row.post90, 1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="后365日" width="100" align="right">
          <template #default="{ row }">
            <span v-if="row.post365 === null">--</span>
            <span v-else :class="changeClass(row.post365)">{{ formatSigned(row.post365, 1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="事件摘要" min-width="200">
          <template #default="{ row }">
            <span class="event-summary">{{ row.event.summary }}</span>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-else description="所选区间内没有记录在库的重大事件" />
    </el-card>

    <EventDetailDialog v-model="detailVisible" :event="selectedEvent" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { DataAnalysis, Flag } from '@element-plus/icons-vue'
import { loadGoldPrices } from '@/data/goldPrices'
import { loadEvents, type GoldEvent } from '@/data/events'
import {
  buildMergedIntlSeries,
  computeEventStats,
  type EventStat,
} from '@/utils/eventStats'
import { usePageMotion } from '@/composables/usePageMotion'
import EventDetailDialog from '@/components/EventDetailDialog.vue'

const data = loadGoldPrices()
const events = loadEvents()

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

// 国际合并序列（1970-2004 月度 + 2004 起日线）：指标与事件标注统一使用
const merged = buildMergedIntlSeries(data)
const eventStats = computed(() => computeEventStats(events, merged))

type RangeKey = '1y' | '5y' | '10y' | '20y' | 'all'
const range = ref<RangeKey>('20y')

const RANGE_DAYS: Record<RangeKey, number | null> = {
  '1y': 365,
  '5y': 1825,
  '10y': 3650,
  '20y': 7300,
  all: null,
}

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
  points: { date: string; close: number }[]
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

const rangeText = computed(() => {
  const a = analysis.value
  if (!a.firstDate || !a.lastDate) return '--'
  return `${a.firstDate} ~ ${a.lastDate}（${a.points.length} 个数据点）`
})

const analysis = computed<Analysis>(() => {
  let points = merged
  const days = RANGE_DAYS[range.value]
  if (days !== null && points.length > 0) {
    const lastDate = points[points.length - 1].date
    const cutoff = new Date(lastDate)
    cutoff.setDate(cutoff.getDate() - days)
    const cutoffStr = cutoff.toISOString().slice(0, 10)
    points = points.filter((p) => p.date >= cutoffStr)
  }
  if (points.length === 0) return EMPTY_ANALYSIS

  const closes = points.map((p) => p.close)

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

  let volatility: number | null = null
  if (returns.length > 1) {
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance =
      returns.reduce((s, r) => s + (r - mean) * (r - mean), 0) / (returns.length - 1)
    volatility = Math.sqrt(variance) * Math.sqrt(252) * 100
  }

  let annualized: number | null = null
  if (closes.length > 1 && closes[0] > 0) {
    annualized =
      (Math.pow(closes[closes.length - 1] / closes[0], 252 / (closes.length - 1)) - 1) * 100
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

// ---- 区间事件归因 ----
const rangeEvents = computed<EventStat[]>(() => {
  const a = analysis.value
  if (!a.firstDate) return []
  return eventStats.value.filter(
    (s) => s.baselineDate !== null && s.baselineDate >= a.firstDate && s.baselineDate <= a.lastDate,
  )
})

const detailVisible = ref(false)
const selectedEvent = ref<GoldEvent | null>(null)
const highlightEventId = ref('')

function openDetail(ev: GoldEvent) {
  selectedEvent.value = ev
  detailVisible.value = true
}

function jumpToEvent(row: EventStat) {
  highlightEventId.value = row.event.id
  openDetail(row.event)
  if (priceChartRef.value) {
    priceChartRef.value.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
}

// ---- 图表 ----
const priceChartRef = ref<HTMLDivElement | null>(null)
const ddChartRef = ref<HTMLDivElement | null>(null)
let priceChart: echarts.ECharts | null = null
let ddChart: echarts.ECharts | null = null
let clickBound = false

function renderCharts() {
  const a = analysis.value
  if (!priceChartRef.value || !ddChartRef.value) return
  if (!priceChart) {
    priceChart = echarts.init(priceChartRef.value)
    if (!clickBound) {
      priceChart.on('click', (params: echarts.ECElementEvent) => {
        if (params.componentType === 'markPoint' && params.data) {
          const d = params.data as { value?: string }
          const ev = events.find((e) => e.title === d.value)
          if (ev) openDetail(ev)
        }
      })
      clickBound = true
    }
  }
  if (!ddChart) ddChart = echarts.init(ddChartRef.value)

  if (a.points.length === 0) {
    priceChart.clear()
    ddChart.clear()
    return
  }
  const dates = a.points.map((p) => p.date)
  const priceOption: echarts.EChartsOption = {
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
        showSymbol: false, lineStyle: { width: 2, color: '#b08a3e' },
        itemStyle: { color: '#b08a3e' },
      },
      {
        name: 'MA20', type: 'line', data: a.ma20, showSymbol: false,
        lineStyle: { width: 1.2, color: '#5b7c99' }, itemStyle: { color: '#5b7c99' },
      },
      {
        name: 'MA60', type: 'line', data: a.ma60, showSymbol: false,
        lineStyle: { width: 1.2, color: '#c65f57' }, itemStyle: { color: '#c65f57' },
      },
      {
        name: 'MA120', type: 'line', data: a.ma120, showSymbol: false,
        lineStyle: { width: 1.2, color: '#6e8b6e' }, itemStyle: { color: '#6e8b6e' },
      },
    ],
  }
  // 事件标注
  const inRange = new Set(dates)
  const markers = eventStats.value
    .filter((s) => s.baselineDate !== null && inRange.has(s.baselineDate) && s.baseline !== null)
    .map((s) => ({
      name: s.event.title,
      coord: [s.baselineDate as string, s.baseline as number],
      value: s.event.title,
      symbol: 'pin',
      symbolSize: s.event.id === highlightEventId.value ? 44 : 28,
      itemStyle: {
        color: s.event.id === highlightEventId.value ? '#c65f57' : '#8a6d1f',
      },
      label: { show: false },
    }))
  ;(priceOption.series as echarts.LineSeriesOption[])[0].markPoint = {
    data: markers,
    label: { show: false },
    tooltip: {
      formatter: (p: unknown) => {
        const d = p as { data: { value: string; coord: [string, number] } }
        return `${d.data.value}<br/>${d.data.coord[0]} 收盘 ${d.data.coord[1].toFixed(2)} 美元/盎司`
      },
    },
  }
  priceChart.setOption(priceOption, { notMerge: true })

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
          lineStyle: { width: 1.2, color: '#c65f57' }, itemStyle: { color: '#c65f57' },
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

watch([range, highlightEventId], () => {
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

function impactTagType(impact: string): 'danger' | 'success' | 'info' {
  if (impact === '利好金价') return 'danger'
  if (impact === '利空金价') return 'success'
  return 'info'
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
.attribution-card {
  margin-top: 16px;
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
  flex-wrap: wrap;
}
.count {
  font-size: 12px;
  font-weight: 400;
  color: #8a877d;
}
.attribution-tip {
  font-size: 12px;
  color: #8a877d;
}
.stats-row {
  margin-bottom: 16px;
}
.stat-item {
  background: #ffffff;
  border: 1px solid #e8e4da;
  border-left: 3px solid #b08a3e;
  border-radius: 10px;
  padding: 14px 16px;
  box-shadow: 0 1px 2px rgba(28, 26, 21, 0.03), 0 6px 18px rgba(28, 26, 21, 0.04);
}
.stat-label {
  font-size: 12px;
  color: #8a877d;
}
.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #2b2924;
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
  height: 380px;
  margin-top: 8px;
}
.dd-chart {
  height: 220px;
}
.event-link {
  color: #5b7c99;
  cursor: pointer;
  font-weight: 500;
}
.event-date-sub {
  font-size: 12px;
  color: #8a877d;
}
.event-summary {
  font-size: 12px;
  color: #57544c;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
@media (max-width: 768px) {
  .chart {
    height: 280px;
  }
}
</style>
