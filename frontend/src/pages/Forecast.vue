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
            <span>金价统计预测</span>
            <el-tag size="small" type="warning" effect="plain">国际金价 XAU/USD</el-tag>
          </div>
          <div class="header-controls">
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

      <!-- 指标卡片 -->
      <el-row :gutter="12" class="stats-row">
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">最新收盘价</div>
            <div class="stat-value">{{ fmt(lastClose) }}</div>
            <div class="stat-sub">{{ lastDate }}</div>
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
        <el-table-column label="预测时点" width="120">
          <template #default="{ row }">
            <span class="future-date">{{ row.date }}</span>
            <el-tag size="small" type="info" effect="plain">第{{ row.k }}个交易日</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="线性回归预测" align="right">
          <template #default="{ row }">
            <span :class="changeClass(row.reg - (lastClose ?? 0))">{{ fmt(row.reg) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="Holt 指数平滑预测" align="right">
          <template #default="{ row }">
            <span :class="changeClass(row.holt - (lastClose ?? 0))">{{ fmt(row.holt) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="90% 预测区间" align="right" width="220">
          <template #default="{ row }">{{ fmt(row.low) }} ~ {{ fmt(row.high) }}</template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 模型说明 -->
    <el-card shadow="never" class="page-card model-card">
      <template #header>
        <div class="header-title">
          <el-icon><InfoFilled /></el-icon>
          <span>模型说明与局限</span>
        </div>
      </template>
      <ul class="model-notes">
        <li><b>线性回归</b>：对所选区间收盘价做时间趋势最小二乘拟合后外推，反映区间内的平均趋势方向。</li>
        <li><b>Holt 双指数平滑</b>：对近期数据赋予更高权重并捕捉趋势变化（本页自动网格寻优 α={{ fc.alpha }}、β={{ fc.beta }}），对拐点更敏感但更容易把短期动能外推过头。</li>
        <li><b>预测区间</b>：按 90% 置信度简化计算（±1.645 × 残差标准差 × √(1+h/n)），随预测步长扩大——历史波动越大、预测越远，区间越宽。</li>
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
import { usePageMotion } from '@/composables/usePageMotion'
import { forecastSeries } from '@/utils/forecast'

const data = loadGoldPrices()

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

type FitRange = '6m' | '1y' | '3y' | '5y'
const fitRange = ref<FitRange>('1y')
const horizon = ref<number>(60)

const RANGE_DAYS: Record<FitRange, number> = { '6m': 180, '1y': 365, '3y': 1095, '5y': 1825 }

const fitted = computed<number[]>(() => {
  const all = data.internationalDaily
  const lastDate = all[all.length - 1].date
  const cutoff = new Date(lastDate)
  cutoff.setDate(cutoff.getDate() - RANGE_DAYS[fitRange.value])
  const cutoffStr = cutoff.toISOString().slice(0, 10)
  return all.filter((p) => p.date >= cutoffStr).map((p) => p.close)
})

const lastDate = computed(() => data.internationalDaily[data.internationalDaily.length - 1].date)
const lastClose = computed(() => data.internationalDaily[data.internationalDaily.length - 1].close)

const fc = computed(() => forecastSeries(fitted.value, horizon.value, lastDate.value))

const annualSlope = computed(() =>
  lastClose.value > 0 ? (fc.value.regSlope * 252 / lastClose.value) * 100 : null,
)
const fmtR2 = computed(() => (fc.value.r2 ?? 0).toFixed(3))
const fmtResidStd = computed(() => `${fc.value.residStd.toFixed(1)} 美元`)

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
  const histDates = data.internationalDaily
    .slice(-hist.length)
    .map((p) => p.date)
  const allDates = [...histDates, ...f.dates]
  const padHist = (v: number[], total: number) => [...v, ...new Array(total - v.length).fill(null)]
  const padFut = (v: number[], total: number) => [...new Array(total - v.length).fill(null), ...v]

  chart.setOption(
    {
      grid: { left: 60, right: 24, top: 40, bottom: 44 },
      legend: { data: ['历史收盘', '线性回归预测', 'Holt 预测', '90% 预测区间'], top: 4 },
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
      xAxis: { type: 'category', data: allDates, boundaryGap: false },
      yAxis: { type: 'value', scale: true, name: '美元/盎司' },
      series: [
        {
          name: '历史收盘', type: 'line', data: padHist(hist, allDates.length),
          showSymbol: false, lineStyle: { width: 2, color: '#c8a24b' }, itemStyle: { color: '#c8a24b' },
        },
        {
          name: '线性回归预测', type: 'line', data: padFut(f.reg, allDates.length),
          showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: '#409eff' },
          itemStyle: { color: '#409eff' },
        },
        {
          name: 'Holt 预测', type: 'line', data: padFut(f.holt, allDates.length),
          showSymbol: false, lineStyle: { width: 2, type: 'dashed', color: '#9266f9' },
          itemStyle: { color: '#9266f9' },
        },
        {
          name: '区间下沿', type: 'line', data: padFut(f.low, allDates.length),
          showSymbol: false, stack: 'band', lineStyle: { opacity: 0 }, itemStyle: { opacity: 0 },
        },
        {
          name: '90% 预测区间', type: 'line',
          data: padFut(f.high.map((h, i) => h - f.low[i]), allDates.length),
          showSymbol: false, stack: 'band', lineStyle: { opacity: 0 },
          areaStyle: { color: 'rgba(64, 158, 255, 0.12)' },
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

watch([fitRange, horizon], () => {
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
  padding: 8px 0;
}
.disclaimer {
  margin-bottom: 16px;
}
.page-card {
  border: none;
  border-radius: 8px;
}
.model-card {
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
.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.control-label {
  font-size: 12px;
  color: #909399;
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
  height: 420px;
}
.forecast-table {
  margin-top: 16px;
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
  color: #606266;
}
@media (max-width: 768px) {
  .chart {
    height: 300px;
  }
}
</style>
