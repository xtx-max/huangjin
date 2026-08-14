<template>
  <div class="page" ref="pageRoot">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Flag /></el-icon>
            <span>影响黄金的全球事件</span>
            <span class="count">共 {{ filtered.length }} 件</span>
          </div>
          <div class="header-controls">
            <el-select
              v-model="filterCategory"
              placeholder="全部类别"
              clearable
              size="small"
              class="filter-select"
            >
              <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
            </el-select>
            <el-select
              v-model="filterImpact"
              placeholder="全部影响"
              clearable
              size="small"
              class="filter-select"
            >
              <el-option v-for="i in impacts" :key="i" :label="i" :value="i" />
            </el-select>
          </div>
        </div>
      </template>

      <!-- 按年份分组的时间线 -->
      <div v-if="years.length > 0" class="motion-timeline">
        <div v-for="year in years" :key="year" class="year-group">
          <div class="year-title">{{ year }} 年</div>
          <el-timeline class="event-timeline">
            <el-timeline-item
              v-for="e in groups[year]"
              :key="e.id"
              :timestamp="e.date"
              placement="top"
              :type="nodeType(e.impact)"
              :hollow="false"
            >
              <div class="event-card" @click="openDetail(e)">
                <div class="event-title-row">
                  <span class="event-title">{{ e.title }}</span>
                  <el-tag size="small" :type="impactTagType(e.impact)" effect="dark">
                    {{ e.impact }}
                  </el-tag>
                </div>
                <div class="event-meta">
                  <el-tag size="small" :type="categoryTagType(e.category)" effect="plain">
                    {{ e.category }}
                  </el-tag>
                  <span class="event-region">{{ e.region }}</span>
                  <span class="event-summary">{{ e.summary }}</span>
                </div>
              </div>
            </el-timeline-item>
          </el-timeline>
        </div>
      </div>
      <el-empty v-else description="没有符合筛选条件的事件" />

      <!-- 详情对话框（共享组件） -->
      <EventDetailDialog v-model="dialogVisible" :event="selected" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { Flag } from '@element-plus/icons-vue'
import { loadEvents, type GoldEvent } from '@/data/events'
import { usePageMotion } from '@/composables/usePageMotion'
import EventDetailDialog from '@/components/EventDetailDialog.vue'

const events = loadEvents()

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

const categories = [...new Set(events.map((e) => e.category))]
const impacts: Array<GoldEvent['impact']> = ['利好金价', '利空金价', '中性']

const filterCategory = ref<string>('')
const filterImpact = ref<string>('')
const dialogVisible = ref(false)
const selected = ref<GoldEvent | null>(null)

const filtered = computed<GoldEvent[]>(() =>
  events.filter(
    (e) =>
      (!filterCategory.value || e.category === filterCategory.value) &&
      (!filterImpact.value || e.impact === filterImpact.value),
  ),
)

const years = computed<string[]>(() => [...new Set(filtered.value.map((e) => e.date.slice(0, 4)))])

const groups = computed<Record<string, GoldEvent[]>>(() => {
  const g: Record<string, GoldEvent[]> = {}
  for (const e of filtered.value) {
    const y = e.date.slice(0, 4)
    if (!g[y]) g[y] = []
    g[y].push(e)
  }
  return g
})

function openDetail(e: GoldEvent) {
  selected.value = e
  dialogVisible.value = true
}

function nodeType(impact: string): 'primary' | 'success' | 'info' {
  if (impact === '利好金价') return 'primary'
  if (impact === '利空金价') return 'success'
  return 'info'
}

// 利好金价=红、利空金价=绿、中性=灰（国内习惯）
function impactTagType(impact: string): 'danger' | 'success' | 'info' {
  if (impact === '利好金价') return 'danger'
  if (impact === '利空金价') return 'success'
  return 'info'
}

function categoryTagType(category: string): 'primary' | 'success' | 'warning' | 'danger' | 'info' {
  switch (category) {
    case '货币政策':
      return 'primary'
    case '地缘政治':
      return 'warning'
    case '金融危机':
      return 'danger'
    case '战争冲突':
      return 'danger'
    case '公共卫生':
      return 'success'
    case '供需变化':
      return 'success'
    default:
      return 'info'
  }
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
.count {
  font-size: 12px;
  font-weight: 400;
  color: #8a877d;
}
.header-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.filter-select {
  width: 140px;
}
.year-group {
  margin-bottom: 8px;
}
.year-title {
  font-size: 18px;
  font-weight: 700;
  color: #b08a3e;
  margin: 12px 0 8px;
  padding-left: 4px;
}
.event-timeline {
  padding-left: 4px;
}
.event-card {
  border: 1px solid #e8e4da;
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, border-color 0.25s ease;
}
.event-card:hover {
  border-color: #b08a3e;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-3px);
}
.event-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.event-title {
  font-size: 15px;
  font-weight: 600;
  color: #2b2924;
}
.event-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}
.event-region {
  font-size: 12px;
  color: #8a877d;
}
.event-summary {
  font-size: 13px;
  color: #57544c;
}
</style>
