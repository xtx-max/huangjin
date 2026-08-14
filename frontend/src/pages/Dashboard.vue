<template>
  <div class="page" ref="pageRoot">
    <!-- 最新行情卡片 -->
    <el-row :gutter="16" class="stats-row reveal">
      <el-col :xs="24" :sm="12">
        <el-card shadow="never" class="stat-card">
          <div class="stat-title">
            <el-icon><Coin /></el-icon>
            <span>国际金价 XAU/USD</span>
            <el-tag size="small" type="warning" effect="plain">美元/盎司</el-tag>
          </div>
          <div class="stat-main">
            <span class="stat-price motion-count" :data-value="intlStat.close ?? undefined" data-decimals="2">{{ formatPrice(intlStat.close) }}</span>
            <span class="stat-change" :class="changeClass(intlStat.change)">
              {{ formatSigned(intlStat.change) }}
              <span class="stat-pct">({{ formatSigned(intlStat.changePct, 2) }}%)</span>
            </span>
          </div>
          <div class="stat-date">截至 {{ intlStat.date || '--' }}</div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12">
        <el-card shadow="never" class="stat-card">
          <div class="stat-title">
            <el-icon><Coin /></el-icon>
            <span>国内金价 Au99.99</span>
            <el-tag size="small" type="success" effect="plain">元/克</el-tag>
          </div>
          <div class="stat-main">
            <span class="stat-price motion-count" :data-value="domesticStat.close ?? undefined" data-decimals="2">{{ formatPrice(domesticStat.close) }}</span>
            <span class="stat-change" :class="changeClass(domesticStat.change)">
              {{ formatSigned(domesticStat.change) }}
              <span class="stat-pct">({{ formatSigned(domesticStat.changePct, 2) }}%)</span>
            </span>
          </div>
          <div class="stat-date">截至 {{ domesticStat.date || '--' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 走势图（国际视图含事件标注） -->
    <el-card shadow="never" class="chart-card reveal">
      <template #header>
        <div class="chart-header">
          <div class="chart-title">
            <el-icon><TrendCharts /></el-icon>
            <span>金价走势</span>
            <el-tag v-if="series === 'intl'" size="small" type="info" effect="plain">
              ▲ 标记为影响黄金的重大事件，点击查看详情
            </el-tag>
          </div>
          <div class="chart-controls">
            <el-radio-group v-model="series" size="small">
              <el-radio-button label="intl">国际金价</el-radio-button>
              <el-radio-button label="domestic">国内金价</el-radio-button>
            </el-radio-group>
            <el-radio-group v-model="range" size="small" class="range-group">
              <el-radio-button label="1m">1月</el-radio-button>
              <el-radio-button label="6m">6月</el-radio-button>
              <el-radio-button label="1y">1年</el-radio-button>
              <el-radio-button label="5y">5年</el-radio-button>
              <el-radio-button label="all">全部</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>
      <div ref="chartRef" class="chart"></div>
    </el-card>

    <!-- 事件影响统计 -->
    <el-card shadow="never" class="chart-card impact-card reveal">
      <template #header>
        <div class="chart-header">
          <div class="chart-title">
            <el-icon><Flag /></el-icon>
            <span>事件影响统计</span>
            <span class="impact-tip">点击行定位图上事件标注（按 |后30日| 排序）</span>
          </div>
        </div>
      </template>
      <el-table :data="sortedStats" size="small" stripe class="motion-rows">
        <el-table-column label="事件" min-width="240">
          <template #default="{ row }">
            <span class="event-link" @click="jumpToEvent(row)">{{ row.event.title }}</span>
            <div class="event-date-sub">{{ row.event.date }}</div>
          </template>
        </el-table-column>
        <el-table-column label="前30日" align="right" width="100">
          <template #default="{ row }">
            <span v-if="row.pre30 === null">--</span>
            <span v-else :class="changeClass(row.pre30)">{{ formatSigned(row.pre30, 1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="后30日" align="right" width="100">
          <template #default="{ row }">
            <span v-if="row.post30 === null">--</span>
            <span v-else :class="changeClass(row.post30)">{{ formatSigned(row.post30, 1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="后90日" align="right" width="100">
          <template #default="{ row }">
            <span v-if="row.post90 === null">--</span>
            <span v-else :class="changeClass(row.post90)">{{ formatSigned(row.post90, 1) }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="后365日" align="right" width="100">
          <template #default="{ row }">
            <span v-if="row.post365 === null">--</span>
            <span v-else :class="changeClass(row.post365)">{{ formatSigned(row.post365, 1) }}%</span>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <EventDetailDialog v-model="detailVisible" :event="selectedEvent" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { Coin, Flag, TrendCharts } from '@element-plus/icons-vue'
import { loadGoldPrices, type PricePoint } from '@/data/goldPrices'
import { loadEvents, type GoldEvent } from '@/data/events'
import {
  buildMergedIntlSeries,
  computeEventStats,
  type ClosePoint,
  type EventStat,
} from '@/utils/eventStats'
import { usePageMotion } from '@/composables/usePageMotion'
import EventDetailDialog from '@/components/EventDetailDialog.vue'

const data = loadGoldPrices()
const events = loadEvents()

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

type SeriesKey = 'intl' | 'domestic'
type RangeKey = '1m' | '6m' | '1y' | '5y' | 'all'

const series = ref<SeriesKey>('intl')
const range = ref<RangeKey>('1y')

interface Stat {
  close: number | null
  change: number | null
  changePct: number | null
  date: string
}

function computeStat(points: PricePoint[]): Stat {
  if (!points || points.length === 0) {
    return { close: null, change: null, changePct: null, date: '' }
  }
  const last = points[points.length - 1]
  const prev = points.length > 1 ? points[points.length - 2] : last
  const change = last.close - prev.close
  const changePct = prev.close !== 0 ? (change / prev.close) * 100 : null
  return { close: last.close, change, changePct, date: last.date }
}

const intlStat = computed(() => computeStat(data.internationalDaily))
const domesticStat = computed(() => computeStat(data.domestic))

// 国际合并序列与事件涨跌幅统计（共享工具）
const mergedIntl = buildMergedIntlSeries(data)
const eventStats = computed(() => computeEventStats(events, mergedIntl))

const RANGE_DAYS: Record<RangeKey, number | null> = {
  '1m': 30,
  '6m': 180,
  '1y': 365,
  '5y': 1825,
  all: null,
}

const currentSeries = computed<ClosePoint[]>(() => {
  if (series.value === 'intl') return mergedIntl
  return data.domestic.map((p) => ({ date: p.date, close: p.close }))
})

const filtered = computed<ClosePoint[]>(() => {
  const points = currentSeries.value
  const days = RANGE_DAYS[range.value]
  if (days === null || points.length === 0) return points
  const lastDate = points[points.length - 1].date
  const cutoff = new Date(lastDate)
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return points.filter((p) => p.date >= cutoffStr)
})

const unit = computed(() => (series.value === 'intl' ? '美元/盎司' : '元/克'))
const seriesName = computed(() => (series.value === 'intl' ? '国际金价' : '国内金价'))

const sortedStats = computed<EventStat[]>(() => {
  const list = [...eventStats.value]
  list.sort((a, b) => {
    const va = a.post30 === null ? -1 : Math.abs(a.post30)
    const vb = b.post30 === null ? -1 : Math.abs(b.post30)
    return vb - va
  })
  return list
})

// ---- 图表 ----
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null
let clickBound = false
const highlightEventId = ref<string>('')

const detailVisible = ref(false)
const selectedEvent = ref<GoldEvent | null>(null)

function openDetail(ev: GoldEvent) {
  selectedEvent.value = ev
  detailVisible.value = true
}

function jumpToEvent(row: EventStat) {
  highlightEventId.value = row.event.id
  series.value = 'intl'
  range.value = 'all'
  openDetail(row.event)
  if (chartRef.value) {
    chartRef.value.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

function renderChart() {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
    if (!clickBound) {
      chart.on('click', (params: echarts.ECElementEvent) => {
        if (params.componentType === 'markPoint' && params.data) {
          const d = params.data as { value?: string }
          const ev = events.find((e) => e.title === d.value)
          if (ev) openDetail(ev)
        }
      })
      clickBound = true
    }
  }
  const points = filtered.value
  if (points.length === 0) {
    chart.clear()
    return
  }
  const dates = points.map((p) => p.date)
  const option: echarts.EChartsOption = {
    grid: { left: 60, right: 24, top: 24, bottom: 48 },
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = params as Array<{ axisValue: string; data: number }>
        const p = list[0]
        return `${p.axisValue}<br/>${seriesName.value}：${p.data.toFixed(2)} ${unit.value}`
      },
    },
    xAxis: { type: 'category', data: dates, boundaryGap: false },
    yAxis: { type: 'value', scale: true, name: unit.value },
    series: [
      {
        name: seriesName.value,
        type: 'line',
        data: points.map((p) => p.close),
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, color: '#c8a24b' },
        itemStyle: { color: '#c8a24b' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(200, 162, 75, 0.25)' },
            { offset: 1, color: 'rgba(200, 162, 75, 0.02)' },
          ]),
        },
      },
    ],
  }
  // 国际视图叠加事件标注
  if (series.value === 'intl') {
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
          color: s.event.id === highlightEventId.value ? '#f56c6c' : '#8a6d1f',
        },
        label: { show: false },
      }))
    ;(option.series as echarts.LineSeriesOption[])[0].markPoint = {
      data: markers,
      label: { show: false },
      tooltip: {
        formatter: (p: unknown) => {
          const d = p as { data: { value: string; coord: [string, number] } }
          return `${d.data.value}<br/>${d.data.coord[0]} 收盘 ${d.data.coord[1].toFixed(2)} 美元/盎司`
        },
      },
    }
  }
  chart.setOption(option, { notMerge: true })
}

function handleResize() {
  chart?.resize()
}

onMounted(() => {
  renderChart()
  window.addEventListener('resize', handleResize)
})

watch([series, range, highlightEventId], () => {
  renderChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})

// ---- 格式化 ----
function formatPrice(v: number | null): string {
  return v === null ? '--' : v.toFixed(2)
}

function formatSigned(v: number | null, digits = 2): string {
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
  padding: 8px 0;
}
.stats-row {
  margin-bottom: 16px;
}
.stat-card {
  border: none;
  border-radius: 8px;
}
.stat-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #606266;
}
.stat-main {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-top: 12px;
}
.stat-price {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
}
.stat-change {
  font-size: 16px;
  font-weight: 500;
}
.stat-pct {
  font-size: 13px;
  opacity: 0.85;
}
.up {
  color: #f56c6c;
}
.down {
  color: #67c23a;
}
.stat-date {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}
.chart-card {
  border: none;
  border-radius: 8px;
}
.impact-card {
  margin-top: 16px;
}
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}
.chart-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  flex-wrap: wrap;
}
.chart-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.chart {
  width: 100%;
  height: 420px;
}
.impact-tip {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
.event-link {
  color: #409eff;
  cursor: pointer;
  font-weight: 500;
}
.event-date-sub {
  font-size: 12px;
  color: #909399;
}
@media (max-width: 768px) {
  .chart {
    height: 300px;
  }
  .stat-price {
    font-size: 24px;
  }
}
</style>
