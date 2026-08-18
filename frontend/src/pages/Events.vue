<template>
  <div class="page" ref="pageRoot">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Flag /></el-icon>
            <span>影响黄金的全球事件</span>
            <span class="count">当前范围内 {{ filtered.length }} 件</span>
          </div>
          <div class="header-controls">
            <el-button
              size="small"
              type="primary"
              :loading="liveState === 'loading'"
              @click="fetchLiveEvents"
            >
              <el-icon v-if="liveState !== 'loading'"><Refresh /></el-icon>
              {{ liveState === 'loading' ? '抓取中…' : '刷新最新事件' }}
            </el-button>
            <el-date-picker
              v-model="dateRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              value-format="YYYY-MM-DD"
              size="small"
              :clearable="true"
            />
            <el-button size="small" @click="resetRange">重置范围</el-button>
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

      <!-- 实时事件（本次会话有效，自动分类与自动分析） -->
      <div class="live-section">
        <div class="live-header">
          <span class="live-title">
            <span class="live-dot"></span>实时事件
          </span>
          <span v-if="liveUpdatedAt" class="live-meta">
            更新于 {{ liveUpdatedAt }} · {{ liveEvents.length }} 件 · 自动分类与分析，仅供参考
          </span>
          <span v-else class="live-meta">
            点击右上「刷新最新事件」抓取正在发生的全球宏观事件（自动分类并生成机制分析）
          </span>
        </div>
        <div v-if="liveEvents.length > 0" class="live-list">
          <div
            v-for="e in liveEvents"
            :key="e.id"
            class="live-item"
            @click="openDetail(e)"
          >
            <div class="live-item-title">
              {{ e.title }}
              <el-tag size="small" :type="categoryTagType(e.category)" effect="plain">
                {{ e.category }}
              </el-tag>
              <el-tag size="small" :type="impactTagType(e.impact)" effect="dark">
                {{ e.impact }}
              </el-tag>
            </div>
            <div class="live-item-meta">{{ e.date }} · {{ e.region }} · {{ e.summary }}</div>
          </div>
        </div>
        <div v-else class="live-empty">尚未抓取实时事件</div>
      </div>

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
      <el-empty v-else description="当前筛选条件下没有事件" />

      <!-- 详情对话框（共享组件） -->
      <EventDetailDialog v-model="dialogVisible" :event="selected" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Flag, Refresh } from '@element-plus/icons-vue'
import { loadEvents, type GoldEvent } from '@/data/events'
import { toLiveEvent, type LiveEventInput } from '@/utils/eventClassify'
import { usePageMotion } from '@/composables/usePageMotion'
import EventDetailDialog from '@/components/EventDetailDialog.vue'

const events = loadEvents()

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

// 打开页面即自动抓取实时事件；之后每 5 分钟自动刷新一次（按钮可手动即时刷新）
let liveTimer: number | null = null
onMounted(() => {
  fetchLiveEvents()
  liveTimer = window.setInterval(fetchLiveEvents, 300000)
})
onBeforeUnmount(() => {
  if (liveTimer !== null) window.clearInterval(liveTimer)
})

const categories = [...new Set(events.map((e) => e.category))]
const impacts: Array<GoldEvent['impact']> = ['利好金价', '利空金价', '中性']

const filterCategory = ref<string>('')
const filterImpact = ref<string>('')
const dateRange = ref<[string, string] | null>(null)

// ---- 实时事件（东方财富公开接口，双源回退，自动分类） ----
const LIVE_SEARCH_API =
  'https://search-api-web.eastmoney.com/search/jsonp?cb=x&param=' +
  encodeURIComponent(
    JSON.stringify({
      uid: '',
      keyword: '美联储',
      type: ['cmsArticleWebOld'],
      client: 'web',
      clientType: 'web',
      clientVersion: 'curr',
      param: {
        cmsArticleWebOld: {
          searchScope: 'default',
          sort: 'default',
          pageIndex: 1,
          pageSize: 20,
          preTag: '<em>',
          postTag: '</em>',
        },
      },
    }),
  )
const LIVE_COLUMNS_API =
  'https://np-listapi.eastmoney.com/comm/web/getNewsByColumns?client=web&biz=web_news_col' +
  '&column=351&order=1&needInteractData=0&page_index=1&page_size=50&req_trace=1'

const EVENT_KEYWORDS =
  /美联储|央行|加息|降息|利率|缩表|QE|战争|冲突|袭击|危机|崩盘|暴跌|倒闭|违约|衰退|关税|制裁|通胀|大选|选举|购金|黄金/

type LiveState = 'idle' | 'loading' | 'ok' | 'error'
const liveState = ref<LiveState>('idle')
const liveEvents = ref<Array<GoldEvent & { link?: string }>>([])
const liveUpdatedAt = ref('')

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

async function fetchJsonOrJsonp(url: string): Promise<LiveEventInput[]> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const text = await resp.text()
  const start = text.indexOf('(')
  const end = text.lastIndexOf(')')
  const json = start >= 0 && end > start ? JSON.parse(text.slice(start + 1, end)) : JSON.parse(text)
  const raw: Array<Record<string, unknown>> = json?.result?.cmsArticleWebOld ?? json?.data?.list ?? []
  return raw.map((r) => ({
    title: stripTags(String(r.title ?? '')),
    date: String(r.date ?? r.showTime ?? '').slice(0, 16),
    source: String(r.mediaName ?? '东方财富'),
    content: stripTags(String(r.content ?? r.summary ?? '')),
    link: r.url ? String(r.url) : r.uniqueUrl ? String(r.uniqueUrl) : undefined,
  }))
}

async function fetchLiveEvents() {
  if (liveState.value === 'loading') return
  liveState.value = 'loading'
  try {
    let list: LiveEventInput[] = []
    try {
      list = await fetchJsonOrJsonp(LIVE_SEARCH_API)
    } catch {
      list = []
    }
    if (list.length === 0) list = await fetchJsonOrJsonp(LIVE_COLUMNS_API)
    const picked = list.filter((i) => EVENT_KEYWORDS.test(i.title)).slice(0, 15)
    if (picked.length === 0) throw new Error('未发现正在发生的宏观事件')
    liveEvents.value = picked.map((i, idx) => toLiveEvent(i, idx))
    liveUpdatedAt.value = new Date().toLocaleString('zh-CN', { hour12: false })
    liveState.value = 'ok'
    ElMessage.success(`已抓取 ${liveEvents.value.length} 件最新全球事件（自动分类+自动分析）`)
  } catch (e) {
    liveState.value = 'error'
    ElMessage.error(
      `实时事件抓取失败（${e instanceof Error ? e.message : '网络错误'}），请稍后重试。`,
    )
  }
}

// ---- 筛选 ----
const filtered = computed<GoldEvent[]>(() =>
  events.filter((e) => {
    const okCategory = !filterCategory.value || e.category === filterCategory.value
    const okImpact = !filterImpact.value || e.impact === filterImpact.value
    const okDate =
      !dateRange.value || (e.date >= dateRange.value[0] && e.date <= dateRange.value[1])
    return okCategory && okImpact && okDate
  }),
)

function resetRange() {
  dateRange.value = null
}

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

// ---- 详情 ----
const dialogVisible = ref(false)
const selected = ref<GoldEvent | null>(null)

function openDetail(e: GoldEvent) {
  selected.value = e
  dialogVisible.value = true
}

function nodeType(impact: string): 'primary' | 'success' | 'info' {
  if (impact === '利好金价') return 'primary'
  if (impact === '利空金价') return 'success'
  return 'info'
}

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
    case '战争冲突':
      return 'danger'
    case '公共卫生':
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
  width: 130px;
}
.live-section {
  border: 1px dashed #b08a3e;
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 24px;
  background: linear-gradient(135deg, rgba(176, 138, 62, 0.05), rgba(255, 255, 255, 0));
}
.live-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}
.live-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 700;
  color: #5f4a17;
}
.live-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #b08a3e;
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.35; transform: scale(0.8); }
}
.live-meta {
  font-size: 12px;
  color: #8a877d;
}
.live-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.live-item {
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.live-item:hover {
  background-color: rgba(176, 138, 62, 0.08);
}
.live-item-title {
  font-size: 13px;
  color: #1d1d1f;
  line-height: 1.6;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.live-item-meta {
  font-size: 12px;
  color: #8a877d;
  margin-top: 2px;
}
.live-empty {
  font-size: 13px;
  color: #8a877d;
  padding: 6px 0;
}
.year-group {
  margin-bottom: 8px;
}
.year-title {
  font-size: 20px;
  font-weight: 700;
  color: #b08a3e;
  margin: 16px 0 8px;
  padding-left: 4px;
  letter-spacing: -0.01em;
}
.event-timeline {
  padding-left: 4px;
}
.event-card {
  border: 1px solid #e8e8ed;
  border-radius: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease, border-color 0.25s ease;
}
.event-card:hover {
  border-color: #b08a3e;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-2px);
}
.event-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.event-title {
  font-size: 15px;
  font-weight: 600;
  color: #1d1d1f;
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
