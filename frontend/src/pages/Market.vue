<template>
  <div class="page" ref="pageRoot">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><TrendCharts /></el-icon>
            <span>历史数据</span>
          </div>
          <div class="header-controls">
            <el-radio-group v-model="mode" size="small">
              <el-radio-button label="intl">国际日线</el-radio-button>
              <el-radio-button label="domestic">国内日线</el-radio-button>
              <el-radio-button label="monthly">全部历史(月度)</el-radio-button>
            </el-radio-group>
            <el-date-picker
              v-model="range"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              size="small"
              :clearable="true"
            />
            <el-button size="small" @click="resetRange">重置区间</el-button>
          </div>
        </div>
      </template>

      <!-- 区间统计 -->
      <el-row :gutter="12" class="stats-row reveal">
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">区间最高收盘价</div>
            <div class="stat-value up">{{ stats.high ?? '--' }}</div>
            <div class="stat-sub">{{ stats.highDate || '--' }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">区间最低收盘价</div>
            <div class="stat-value down">{{ stats.low ?? '--' }}</div>
            <div class="stat-sub">{{ stats.lowDate || '--' }}</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">区间平均收盘价</div>
            <div class="stat-value">{{ stats.avg ?? '--' }}</div>
            <div class="stat-sub">{{ stats.count }} 条记录</div>
          </div>
        </el-col>
        <el-col :xs="12" :sm="6">
          <div class="stat-item">
            <div class="stat-label">区间累计涨跌幅</div>
            <div class="stat-value" :class="changeClass(stats.totalChange)">
              {{ formatSigned(stats.totalChange, 2) }}%
            </div>
            <div class="stat-sub">{{ stats.firstDate || '--' }} → {{ stats.lastDate || '--' }}</div>
          </div>
        </el-col>
      </el-row>

      <!-- 明细表格 -->
      <div v-if="pagedRows.length > 0">
        <el-table :data="pagedRows" size="small" stripe class="motion-rows">
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="open" label="开" align="right">
            <template #default="{ row }">{{ fmt(row.open) }}</template>
          </el-table-column>
          <el-table-column prop="high" label="高" align="right">
            <template #default="{ row }">{{ fmt(row.high) }}</template>
          </el-table-column>
          <el-table-column prop="low" label="低" align="right">
            <template #default="{ row }">{{ fmt(row.low) }}</template>
          </el-table-column>
          <el-table-column prop="close" label="收" align="right">
            <template #default="{ row }">{{ fmt(row.close) }}</template>
          </el-table-column>
          <el-table-column label="涨跌幅" align="right" width="110">
            <template #default="{ row }">
              <span v-if="row.changePct === null">--</span>
              <span v-else :class="changeClass(row.changePct)">
                {{ formatSigned(row.changePct, 2) }}%
              </span>
            </template>
          </el-table-column>
        </el-table>
        <div class="pagination-wrap">
          <el-pagination
            v-model:current-page="page"
            :page-size="PAGE_SIZE"
            :total="filteredRows.length"
            layout="total, prev, pager, next, jumper"
            background
            small
          />
        </div>
      </div>
      <el-empty v-else description="所选区间内暂无数据" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { TrendCharts } from '@element-plus/icons-vue'
import { loadGoldPrices, type PricePoint } from '@/data/goldPrices'
import { usePageMotion } from '@/composables/usePageMotion'

const data = loadGoldPrices()
const PAGE_SIZE = 50

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

type ModeKey = 'intl' | 'domestic' | 'monthly'

const mode = ref<ModeKey>('domestic')
const range = ref<[string, string] | null>(null)
const page = ref(1)

interface Row {
  date: string
  open: number
  high: number
  low: number
  close: number
  changePct: number | null
}

/** 全部历史(月度)：月度定盘价(1970-2004) + 国际日线(2004-06 起) 合并 */
function buildMergedRows(): Row[] {
  const merged: Row[] = data.internationalMonthly.map((m) => ({
    date: m.date,
    open: m.price,
    high: m.price,
    low: m.price,
    close: m.price,
    changePct: null,
  }))
  const lastMonthlyDate = merged.length ? merged[merged.length - 1].date : ''
  for (const p of data.internationalDaily) {
    if (p.date > lastMonthlyDate) {
      merged.push({
        date: p.date,
        open: p.open,
        high: p.high,
        low: p.low,
        close: p.close,
        changePct: null,
      })
    }
  }
  merged.sort((a, b) => a.date.localeCompare(b.date))
  fillChangePct(merged)
  return merged
}

function fillChangePct(rows: Row[]) {
  for (let i = 0; i < rows.length; i++) {
    if (i === 0) {
      rows[i].changePct = null
      continue
    }
    const prev = rows[i - 1].close
    rows[i].changePct = prev !== 0 ? ((rows[i].close - prev) / prev) * 100 : null
  }
}

const baseRows = computed<Row[]>(() => {
  if (mode.value === 'monthly') return buildMergedRows()
  const src: PricePoint[] =
    mode.value === 'intl' ? data.internationalDaily : data.domestic
  const rows: Row[] = src.map((p) => ({
    date: p.date,
    open: p.open,
    high: p.high,
    low: p.low,
    close: p.close,
    changePct: null,
  }))
  fillChangePct(rows)
  return rows
})

/** 应用日期区间；无区间时（日线模式）默认最近 100 条 */
const filteredRows = computed<Row[]>(() => {
  const rows = baseRows.value
  if (range.value && range.value.length === 2) {
    const [start, end] = range.value
    return rows.filter((r) => r.date >= start && r.date <= end)
  }
  if (mode.value === 'monthly') return rows
  return rows.slice(-100)
})

const pagedRows = computed<Row[]>(() => {
  const start = (page.value - 1) * PAGE_SIZE
  return filteredRows.value.slice(start, start + PAGE_SIZE)
})

interface Stats {
  high: string
  highDate: string
  low: string
  lowDate: string
  avg: string
  totalChange: number | null
  count: number
  firstDate: string
  lastDate: string
}

const stats = computed<Stats>(() => {
  const rows = filteredRows.value
  const empty: Stats = {
    high: '--', highDate: '', low: '--', lowDate: '', avg: '--',
    totalChange: null, count: 0, firstDate: '', lastDate: '',
  }
  if (rows.length === 0) return empty
  let max = rows[0], min = rows[0], sum = 0
  for (const r of rows) {
    if (r.close > max.close) max = r
    if (r.close < min.close) min = r
    sum += r.close
  }
  const first = rows[0].close
  return {
    high: max.close.toFixed(2),
    highDate: max.date,
    low: min.close.toFixed(2),
    lowDate: min.date,
    avg: (sum / rows.length).toFixed(2),
    totalChange: first !== 0 ? ((rows[rows.length - 1].close - first) / first) * 100 : null,
    count: rows.length,
    firstDate: rows[0].date,
    lastDate: rows[rows.length - 1].date,
  }
})

watch([mode, range], () => {
  page.value = 1
})

function resetRange() {
  range.value = null
}

function fmt(v: number): string {
  return v.toFixed(2)
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
.page-card {
  border: none;
  border-radius: 18px;
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
}
.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
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
  color: #5b5b61;
}
.stat-value {
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #2b2924;
  margin-top: 4px;
}
.stat-sub {
  font-size: 12px;
  color: #5b5b61;
  margin-top: 4px;
}
.up {
  color: #c65f57;
}
.down {
  color: #5a9167;
}
.pagination-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 14px;
}
</style>
