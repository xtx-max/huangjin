<template>
  <div class="page">
    <!-- 最新行情卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :xs="24" :sm="12">
        <el-card shadow="never" class="stat-card">
          <div class="stat-title">
            <el-icon><Coin /></el-icon>
            <span>国际金价 XAU/USD</span>
            <el-tag size="small" type="warning" effect="plain">美元/盎司</el-tag>
          </div>
          <div class="stat-main">
            <span class="stat-price">{{ formatPrice(intlStat.close) }}</span>
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
            <span class="stat-price">{{ formatPrice(domesticStat.close) }}</span>
            <span class="stat-change" :class="changeClass(domesticStat.change)">
              {{ formatSigned(domesticStat.change) }}
              <span class="stat-pct">({{ formatSigned(domesticStat.changePct, 2) }}%)</span>
            </span>
          </div>
          <div class="stat-date">截至 {{ domesticStat.date || '--' }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 走势图 -->
    <el-card shadow="never" class="chart-card">
      <template #header>
        <div class="chart-header">
          <div class="chart-title">
            <el-icon><TrendCharts /></el-icon>
            <span>金价走势</span>
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
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { Coin, TrendCharts } from '@element-plus/icons-vue'
import { loadGoldPrices, type PricePoint } from '@/data/goldPrices'

const data = loadGoldPrices()

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

const RANGE_DAYS: Record<RangeKey, number | null> = {
  '1m': 30,
  '6m': 180,
  '1y': 365,
  '5y': 1825,
  all: null,
}

const currentSeries = computed<PricePoint[]>(() =>
  series.value === 'intl' ? data.internationalDaily : data.domestic,
)

const filtered = computed<PricePoint[]>(() => {
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

// ---- ECharts ----
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function renderChart() {
  if (!chartRef.value) return
  if (!chart) {
    chart = echarts.init(chartRef.value)
  }
  const points = filtered.value
  if (points.length === 0) {
    chart.clear()
    return
  }
  chart.setOption(
    {
      grid: { left: 60, right: 24, top: 24, bottom: 48 },
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{ axisValue: string; data: number }>
          const p = list[0]
          return `${p.axisValue}<br/>${seriesName.value}：${p.data.toFixed(2)} ${unit.value}`
        },
      },
      xAxis: {
        type: 'category',
        data: points.map((p) => p.date),
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        scale: true,
        name: unit.value,
      },
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

watch([series, range], () => {
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

// 国内习惯：红涨绿跌
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
@media (max-width: 768px) {
  .chart {
    height: 300px;
  }
  .stat-price {
    font-size: 24px;
  }
}
</style>
