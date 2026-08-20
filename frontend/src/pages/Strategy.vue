<template>
  <div class="page" ref="pageRoot">
    <el-alert
      type="info"
      :closable="false"
      show-icon
      class="disclaimer reveal"
      title="无未来函数保证"
      description="本页所有信号与回测严格按时序因果执行：信号在 T 日收盘后计算，T+1 日生效；任何计算只使用 T 日及之前的数据。回测收益为扣除信号次日的实际日收益累积，不代表真实交易（未计手续费与滑点）。"
    />

    <el-card shadow="never" class="page-card reveal">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Opportunity /></el-icon>
            <span>策略实验室</span>
            <el-tag size="small" type="warning" effect="plain">{{ seriesName }}</el-tag>
            <el-tag size="small" type="info" effect="plain">数据截至 {{ lastDate }}</el-tag>
          </div>
          <div class="header-controls">
            <el-radio-group v-model="kind" size="small">
              <el-radio-button label="maCross">均线交叉</el-radio-button>
              <el-radio-button label="momentum">动量</el-radio-button>
              <el-radio-button label="meanRev">均值回归</el-radio-button>
            </el-radio-group>
            <el-radio-group v-model="range" size="small">
              <el-radio-button label="3y">近3年</el-radio-button>
              <el-radio-button label="5y">近5年</el-radio-button>
              <el-radio-button label="10y">近10年</el-radio-button>
              <el-radio-button label="all">全部</el-radio-button>
            </el-radio-group>
          </div>
        </div>
      </template>

      <div class="strategy-desc">{{ strategyDescription }}</div>

      <el-row :gutter="12" class="stats-row">
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">最优年化收益</div>
            <div class="stat-value" :class="changeClass(result.best.annualReturn)">{{ formatSigned(result.best.annualReturn, 1) }}%</div>
            <div class="stat-sub">最优参数：{{ paramsText }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">买入持有年化</div>
            <div class="stat-value" :class="changeClass(result.buyHoldAnnual)">{{ formatSigned(result.buyHoldAnnual, 1) }}%</div>
            <div class="stat-sub">同期基准（不择时）</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">信号次日胜率</div>
            <div class="stat-value">{{ result.best.signalHitRate === null ? '--' : result.best.signalHitRate.toFixed(1) + '%' }}</div>
            <div class="stat-sub">信号方向与次日涨跌同向的比例</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">最大回撤 / 交易次数</div>
            <div class="stat-value">{{ result.best.maxDrawdown.toFixed(1) }}% / {{ result.best.trades }}</div>
            <div class="stat-sub">共测试 {{ result.tested }} 组参数</div>
          </div>
        </el-col>
      </el-row>

      <div class="signal-box">
        <div class="signal-title">当前最新信号（基于最近收盘，次日生效）</div>
        <div class="signal-desc">{{ result.best.lastSignalDesc }}</div>
      </div>

      <div ref="chartRef" class="chart"></div>
    </el-card>

    <el-card shadow="never" class="page-card model-card reveal">
      <template #header>
        <div class="header-title">
          <el-icon><InfoFilled /></el-icon>
          <span>策略说明与参数范围</span>
        </div>
      </template>
      <ul class="model-notes">
        <li><b>均线交叉</b>：短期均线（5/10/20 日）上穿长期均线（20/60/120 日）持多，下穿持空；捕捉趋势。</li>
        <li><b>动量</b>：过去 N 日（20/60/120 日）涨幅超过阈值（1/3/5/8%）持多，跌破负阈值持空，否则观望；顺势而为。</li>
        <li><b>均值回归</b>：现价偏离 N 日均线超过阈值（3/5/8/12%）时反向操作；押注价格回归。</li>
        <li><b>寻优方式</b>：对全部参数组合逐一回测，按年化收益取最优；全部计算只使用 T 日及之前数据，无未来函数。</li>
        <li><b>提醒</b>：最优参数存在过拟合风险——历史最优不等于未来最优；回测未计手续费与滑点，实际收益会更低。</li>
      </ul>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts'
import { InfoFilled, Opportunity } from '@element-plus/icons-vue'
import { loadGoldPrices } from '@/data/goldPrices'
import { optimizeStrategy, type StrategyKind } from '@/utils/strategy'
import { CHART_LEGEND, CHART_TOOLTIP, CHART_X, CHART_Y } from '@/utils/chartTheme'
import { usePageMotion } from '@/composables/usePageMotion'

const data = loadGoldPrices()
const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

const kind = ref<StrategyKind>('maCross')
const range = ref<'3y' | '5y' | '10y' | 'all'>('10y')

const RANGE_DAYS: Record<string, number | null> = { '3y': 1095, '5y': 1825, '10y': 3650, all: null }

const seriesName = computed(() => '国内金价 Au99.99（元/克）')
const closesAll = computed<number[]>(() => data.domestic.map((p) => p.close))
const lastDate = computed(() => data.domestic[data.domestic.length - 1].date)

const closes = computed<number[]>(() => {
  const all = closesAll.value
  const days = RANGE_DAYS[range.value]
  if (days === null) return all
  return all.slice(-Math.ceil(days / 365 * 244))
})

const result = computed(() => optimizeStrategy(closes.value, kind.value))

const paramsText = computed(() => {
  const p = result.value.best.config.params
  return Object.entries(p)
    .map(([k, v]) => `${k}=${v}`)
    .join('，')
})

const strategyDescription = computed(() => {
  if (kind.value === 'maCross') return '均线交叉策略：短期均线上穿长期均线时持多，下穿时持空，跟随趋势方向。'
  if (kind.value === 'momentum') return '动量策略：过去 N 日涨幅超过阈值持多、跌破负阈值持空、区间内观望，顺势而为。'
  return '均值回归策略：价格偏离均线过远时反向操作，押注价格向均值回归。'
})

// ---- 资金曲线 ----
const chartRef = ref<HTMLDivElement | null>(null)
let chart: echarts.ECharts | null = null

function renderChart() {
  if (!chartRef.value) return
  if (!chart) chart = echarts.init(chartRef.value)
  const r = result.value.best
  const dates = data.domestic.slice(-r.equity.length).map((p) => p.date)
  const bh = (() => {
    const c = closes.value
    const eq: number[] = [1]
    for (let i = 1; i < c.length; i++) {
      eq.push(eq[i - 1] * (c[i] / c[i - 1]))
    }
    return eq
  })()
  const pad = (v: number[], total: number) => [...new Array(total - v.length).fill(1), ...v]
  chart.setOption(
    {
      animationDuration: 800,
      animationEasing: 'cubicOut',
      grid: { left: 60, right: 24, top: 40, bottom: 44 },
      legend: { ...CHART_LEGEND, data: ['策略净值', '买入持有净值'], top: 4 },
      tooltip: {
        ...CHART_TOOLTIP,
        trigger: 'axis',
        formatter: (params: unknown) => {
          const list = params as Array<{ seriesName: string; axisValue: string; data: number }>
          const lines = list.map((p) => `${p.seriesName}：${p.data.toFixed(3)}`)
          return `${list[0]?.axisValue ?? ''}<br/>${lines.join('<br/>')}`
        },
      },
      xAxis: { ...CHART_X, type: 'category', data: dates },
      yAxis: { ...CHART_Y, type: 'value', name: '净值', scale: true },
      series: [
        {
          name: '策略净值', type: 'line', data: r.equity, showSymbol: false,
          lineStyle: { width: 2.5, color: '#b08a3e' }, itemStyle: { color: '#b08a3e' },
        },
        {
          name: '买入持有净值', type: 'line', data: pad(bh, dates.length), showSymbol: false,
          lineStyle: { width: 1.5, color: '#5b7c99' }, itemStyle: { color: '#5b7c99' },
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

watch([kind, range], () => renderChart())

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
  chart?.dispose()
  chart = null
})

function formatSigned(v: number | null, digits = 1): string {
  if (v === null) return '--'
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`
}
function changeClass(v: number): string {
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
  gap: 12px;
  flex-wrap: wrap;
}
.strategy-desc {
  font-size: 14px;
  color: #3a3a3c;
  margin-bottom: 18px;
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
  color: #4c8a63;
}
.signal-box {
  background: linear-gradient(135deg, rgba(176, 138, 62, 0.08), rgba(176, 138, 62, 0.02));
  border: 1px solid rgba(176, 138, 62, 0.25);
  border-radius: 14px;
  padding: 14px 18px;
  margin-bottom: 18px;
}
.signal-title {
  font-size: 13px;
  font-weight: 700;
  color: #8a6d1f;
  margin-bottom: 6px;
}
.signal-desc {
  font-size: 14px;
  color: #3a3a3c;
  line-height: 1.8;
}
.chart {
  width: 100%;
  height: 420px;
}
.model-notes {
  margin: 0;
  padding-left: 20px;
  line-height: 2;
  font-size: 13px;
  color: #3a3a3c;
}
@media (max-width: 768px) {
  .chart {
    height: 300px;
  }
}
</style>
