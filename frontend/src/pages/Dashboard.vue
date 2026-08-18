<template>
  <div class="page" ref="pageRoot">
    <!-- 最新行情 Hero（实时报价，30 秒自动刷新） -->
    <div class="hero reveal">
      <div class="hero-head">
        <span class="hero-title">实时行情</span>
        <span class="hero-badge">
          <span class="live-dot"></span>
          实时报价 · 约 1 分钟延迟 · {{ quotesUpdatedAt || '连接中…' }}
        </span>
      </div>
      <div class="hero-inner">
        <div class="hero-col">
          <div class="hero-label">
            国际金价 XAU/USD
            <el-tag size="small" effect="plain" class="hero-unit">美元/盎司</el-tag>
          </div>
          <div class="hero-price">{{ heroIntl.price }}</div>
          <div class="hero-sub">
            <span class="hero-pill" :class="changeClass(heroIntl.change)">
              {{ formatSigned(heroIntl.change) }}（{{ formatSigned(heroIntl.changePct, 2) }}%）
            </span>
            <span class="hero-date">{{ heroIntl.note }}</span>
          </div>
        </div>
        <div class="hero-divider"></div>
        <div class="hero-col">
          <div class="hero-label">
            国内金价 Au99.99
            <el-tag size="small" effect="plain" class="hero-unit">元/克</el-tag>
          </div>
          <div class="hero-price">{{ heroDomestic.price }}</div>
          <div class="hero-sub">
            <span class="hero-pill" :class="changeClass(heroDomestic.change)">
              {{ formatSigned(heroDomestic.change) }}（{{ formatSigned(heroDomestic.changePct, 2) }}%）
            </span>
            <span class="hero-date">{{ heroDomestic.note }}</span>
          </div>
        </div>
      </div>
    </div>

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
import { Flag, TrendCharts } from '@element-plus/icons-vue'
import { loadGoldPrices, type PricePoint } from '@/data/goldPrices'
import { fetchLiveQuotes, type LiveQuotes } from '@/utils/liveQuotes'
import { loadEvents, type GoldEvent } from '@/data/events'
import {
  buildMergedIntlSeries,
  computeEventStats,
  type ClosePoint,
  type EventStat,
} from '@/utils/eventStats'
import { usePageMotion } from '@/composables/usePageMotion'
import { CHART_TOOLTIP, CHART_X, CHART_Y } from '@/utils/chartTheme'
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

// ---- 实时报价（30 秒自动刷新；失败时回退到静态日线数据） ----
const quotes = ref<LiveQuotes | null>(null)
const quotesUpdatedAt = ref('')
let quoteTimer: number | null = null

async function refreshQuotes() {
  try {
    quotes.value = await fetchLiveQuotes()
    quotesUpdatedAt.value = new Date().toLocaleTimeString('zh-CN', { hour12: false })
  } catch {
    /* 网络失败时保留静态数据展示 */
  }
}

interface HeroStat {
  price: string
  change: number | null
  changePct: number | null
  note: string
}

const heroIntl = computed<HeroStat>(() => {
  const q = quotes.value?.intl
  if (q) {
    return { price: q.price.toFixed(2), change: q.change, changePct: q.changePct, note: `行情时间 ${q.time} · 实时` }
  }
  const st = intlStat.value
  return { price: formatPrice(st.close), change: st.change, changePct: st.changePct, note: `截至 ${st.date} · 日线` }
})

const heroDomestic = computed<HeroStat>(() => {
  const q = quotes.value?.domestic
  if (q) {
    return { price: q.price.toFixed(2), change: q.change, changePct: q.changePct, note: `行情时间 ${q.time} · 实时` }
  }
  const st = domesticStat.value
  return { price: formatPrice(st.close), change: st.change, changePct: st.changePct, note: `截至 ${st.date} · 日线` }
})

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
    animationDuration: 900,

    animationEasing: 'cubicOut',

    animationDurationUpdate: 600,

    animationEasingUpdate: 'cubicOut',

    grid: { left: 60, right: 24, top: 24, bottom: 48 },
    tooltip: { ...CHART_TOOLTIP, trigger: 'axis',
      formatter: (params: unknown) => {
        const list = params as Array<{ axisValue: string; data: number }>
        const p = list[0]
        return `${p.axisValue}<br/>${seriesName.value}：${p.data.toFixed(2)} ${unit.value}`
      },
    },
    xAxis: { ...CHART_X, type: 'category', data: dates },
    yAxis: { ...CHART_Y, type: 'value', scale: true, name: unit.value },
    series: [
      {
        name: seriesName.value,
        type: 'line',
        data: points.map((p) => p.close),
        showSymbol: false,
        smooth: false,
        lineStyle: { width: 2, color: '#b08a3e' },
        itemStyle: { color: '#b08a3e' },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: 'rgba(176, 138, 62, 0.25)' },
            { offset: 1, color: 'rgba(176, 138, 62, 0.02)' },
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
          color: s.event.id === highlightEventId.value ? '#c65f57' : '#8a6d1f',
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
  refreshQuotes()
  quoteTimer = window.setInterval(refreshQuotes, 30000)
})

watch([series, range, highlightEventId], () => {
  renderChart()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  if (quoteTimer !== null) window.clearInterval(quoteTimer)
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
  padding: 12px 0 48px;
}
.hero {
  background: linear-gradient(135deg, #1c1a16 0%, #2b2721 60%, #38322a 100%);
  border-radius: 20px;
  padding: 26px 32px 30px;
  color: #fff;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
}
.hero::after {
  content: '';
  position: absolute;
  right: -80px;
  top: -80px;
  width: 260px;
  height: 260px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(217, 178, 95, 0.16), transparent 70%);
  pointer-events: none;
}
.hero-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}
.hero-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #d9b25f;
}
.hero-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.55);
}
.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #34c759;
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.75); }
}
.hero-inner {
  display: flex;
  align-items: stretch;
  gap: 32px;
}
.hero-col {
  flex: 1;
  min-width: 0;
}
.hero-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.6);
}
.hero-unit {
  background: rgba(255, 255, 255, 0.08) !important;
  border-color: rgba(255, 255, 255, 0.15) !important;
  color: rgba(255, 255, 255, 0.7) !important;
}
.hero-price {
  font-size: 54px;
  font-weight: 600;
  letter-spacing: -0.03em;
  line-height: 1.15;
  color: #f7f3ea;
  font-variant-numeric: tabular-nums;
  margin-top: 8px;
}
.hero-sub {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
  flex-wrap: wrap;
}
.hero-pill {
  padding: 4px 12px;
  border-radius: 980px;
  font-size: 13px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
}
.hero-pill.up {
  background: rgba(255, 69, 58, 0.18);
  color: #ff8178;
}
.hero-pill.down {
  background: rgba(52, 199, 89, 0.18);
  color: #5ce084;
}
.hero-date {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}
.hero-divider {
  width: 1px;
  background: rgba(255, 255, 255, 0.12);
}
.up {
  color: #ff8178;
}
.down {
  color: #5ce084;
}
@media (max-width: 768px) {
  .hero-inner {
    flex-direction: column;
    gap: 20px;
  }
  .hero-divider {
    display: none;
  }
  .hero-price {
    font-size: 40px;
  }
}
.chart-card {
  border: none;
  border-radius: 16px;
}
.impact-card {
  margin-top: 24px;
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
  color: #2b2924;
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
  height: 460px;
}
.impact-tip {
  font-size: 12px;
  font-weight: 400;
  color: #8a877d;
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
@media (max-width: 768px) {
  .chart {
    height: 300px;
  }
  .stat-price {
    font-size: 24px;
  }
}
</style>
