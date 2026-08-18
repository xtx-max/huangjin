<template>
  <div class="page" ref="pageRoot">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Reading /></el-icon>
            <span>黄金新闻</span>
            <span class="count">人工整理 {{ items.length }} 条</span>
          </div>
          <div class="header-actions">
            <el-button
              size="small"
              type="primary"
              :loading="fetchState === 'loading'"
              @click="fetchLiveNews"
            >
              <el-icon v-if="fetchState !== 'loading'"><Refresh /></el-icon>
              {{ fetchState === 'loading' ? '抓取中…' : '刷新最新快讯' }}
            </el-button>
          </div>
        </div>
      </template>

      <!-- 实时快讯（本次会话有效） -->
      <div class="live-section reveal">
        <div class="live-header">
          <span class="live-title">
            <span class="live-dot"></span>实时快讯
          </span>
          <span v-if="liveUpdatedAt" class="live-meta">
            更新于 {{ liveUpdatedAt }} · {{ liveItems.length }} 条 · 来源：东方财富公开接口
          </span>
          <span v-else class="live-meta">
            点击右上「刷新最新快讯」实时抓取金价相关快讯（本会话内有效）
          </span>
        </div>
        <div v-if="liveItems.length > 0" class="live-list">
          <div v-for="n in liveItems" :key="n.id" class="live-item" @click="openDetail(n)">
            <div class="live-item-title">{{ n.title }}</div>
            <div class="live-item-meta">{{ n.time }} · {{ n.source }}</div>
          </div>
        </div>
        <div v-else class="live-empty">尚未抓取实时快讯</div>
      </div>

      <!-- 人工整理快讯（每日自动更新） -->
      <div class="curated-title reveal">
        <el-icon><Document /></el-icon>
        <span>快讯归档</span>
        <span class="count">每日由 GitHub Actions 自动抓取并入档</span>
      </div>
      <div v-if="items.length > 0" class="news-list motion-list">
        <div v-for="n in items" :key="n.id" class="news-item" @click="openDetail(n)">
          <div class="news-title-row">
            <span class="news-title">{{ n.title }}</span>
          </div>
          <div class="news-meta">
            <span class="news-time">{{ n.time }}</span>
            <el-tag size="small" effect="plain">{{ n.source }}</el-tag>
            <el-tag size="small" :type="impactTagType(n.impact)" effect="dark">{{ n.impact }}</el-tag>
          </div>
          <p class="news-summary">{{ n.summary }}</p>
        </div>
      </div>
      <el-empty v-else description="暂无新闻" />

      <el-dialog
        v-model="dialogVisible"
        :title="selected?.title ?? ''"
        width="640px"
        top="8vh"
      >
        <template v-if="selected">
          <div class="detail-meta">
            <span class="detail-time">{{ selected.time }}</span>
            <el-tag size="small" effect="plain">{{ selected.source }}</el-tag>
            <el-tag size="small" :type="impactTagType(selected.impact)" effect="dark">
              {{ selected.impact }}
            </el-tag>
          </div>
          <p class="detail-summary">{{ selected.summary }}</p>
          <div class="detail-content-title">正文</div>
          <p class="detail-content">{{ selected.content }}</p>
          <el-button
            v-if="selected.link"
            size="small"
            type="primary"
            link
            class="source-link"
            @click="openSource(selected.link)"
          >
            <el-icon><Link /></el-icon> 查看原文
          </el-button>
          <div class="analysis-box">
            <div class="detail-content-title analysis-title">
              <el-icon><DataAnalysis /></el-icon>
              <span>影响分析</span>
            </div>
            <div class="analysis-sections">
              <template v-for="(sec, i) in analysisSections" :key="i">
                <div v-if="sec.heading" class="sec-heading">{{ sec.heading }}</div>
                <p v-for="(para, j) in sec.paragraphs" :key="j" class="analysis-text">{{ para }}</p>
              </template>
            </div>
          </div>
        </template>
        <template #footer>
          <el-button @click="dialogVisible = false">关闭</el-button>
        </template>
      </el-dialog>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DataAnalysis,
  Document,
  Link,
  Reading,
  Refresh,
} from '@element-plus/icons-vue'
import { loadNews, type NewsItem } from '@/data/news'
import { classifyEvent } from '@/utils/eventClassify'
import { buildAutoAnalysis } from '@/utils/autoAnalysis'
import { usePageMotion } from '@/composables/usePageMotion'

const items = loadNews()
const dialogVisible = ref(false)
const selected = ref<NewsItem | null>(null)

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

interface Section {
  heading: string
  paragraphs: string[]
}

/** 把 analysis 按【小节标题】拆分渲染 */
const analysisSections = computed<Section[]>(() => {
  const text = selected.value?.analysis ?? ''
  const lines = text.split(/\r?\n/)
  const sections: Section[] = []
  let current: Section = { heading: '', paragraphs: [] }
  const headingRe = /^【([^】]{1,14})】\s*$/
  const flush = () => {
    if (current.heading || current.paragraphs.length > 0) sections.push(current)
    current = { heading: '', paragraphs: [] }
  }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const m = headingRe.exec(line)
    if (m) {
      flush()
      current = { heading: m[1], paragraphs: [] }
    } else {
      current.paragraphs.push(line)
    }
  }
  flush()
  return sections
})

// ---- 实时快讯（东方财富公开接口，CORS 开放，无需密钥；双源回退） ----
const LIVE_SEARCH_API =
  'https://search-api-web.eastmoney.com/search/jsonp?cb=x&param=' +
  encodeURIComponent(
    JSON.stringify({
      uid: '',
      keyword: '黄金',
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

type FetchState = 'idle' | 'loading' | 'ok' | 'error'
const fetchState = ref<FetchState>('idle')
const liveItems = ref<NewsItem[]>([])
const liveUpdatedAt = ref('')

interface EmItem {
  date?: string
  showTime?: string
  code?: string
  title?: string
  content?: string
  summary?: string
  mediaName?: string
  url?: string
  uniqueUrl?: string
}

const GOLD_RE = /黄金|金价|央行购金/

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim()
}

function toNewsItem(raw: EmItem, idx: number): NewsItem {
  const title = stripTags(raw.title || '')
  const content = stripTags(raw.content || raw.summary || '')
  const time = (raw.date || raw.showTime || '').slice(0, 16)
  return {
    id: `live-${raw.code || idx}`,
    title,
    time,
    source: raw.mediaName || '东方财富',
    summary: content.length > 60 ? content.slice(0, 60) + '…' : content,
    content: content || title,
    link: raw.url || raw.uniqueUrl,
    impact: classifyEvent(title).impact,
    analysis: buildAutoAnalysis({
      title,
      date: time,
      source: raw.mediaName || '东方财富',
      summary: content,
      category: classifyEvent(title).category,
      impact: classifyEvent(title).impact,
    }),
  }
}

async function fetchJsonOrJsonp(url: string): Promise<EmItem[]> {
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const text = await resp.text()
  const start = text.indexOf('(')
  const end = text.lastIndexOf(')')
  const json = start >= 0 && end > start ? JSON.parse(text.slice(start + 1, end)) : JSON.parse(text)
  return json?.result?.cmsArticleWebOld ?? json?.data?.list ?? []
}

async function fetchLiveNews() {
  if (fetchState.value === 'loading') return
  fetchState.value = 'loading'
  try {
    let list: EmItem[] = []
    try {
      list = await fetchJsonOrJsonp(LIVE_SEARCH_API)
    } catch {
      list = []
    }
    if (list.length === 0) {
      list = await fetchJsonOrJsonp(LIVE_COLUMNS_API)
    }
    const gold = list.filter((r) => GOLD_RE.test(stripTags(r.title || ''))).slice(0, 20)
    if (gold.length === 0) {
      throw new Error('接口未返回金价相关快讯')
    }
    liveItems.value = gold.map(toNewsItem)
    liveUpdatedAt.value = new Date().toLocaleString('zh-CN', { hour12: false })
    fetchState.value = 'ok'
    ElMessage.success(`已抓取 ${liveItems.value.length} 条最新金价快讯`)
  } catch (e) {
    fetchState.value = 'error'
    ElMessage.error(
      `实时快讯抓取失败（${e instanceof Error ? e.message : '网络错误'}），请稍后重试；已保留原有内容。`,
    )
  }
}

function openDetail(n: NewsItem) {
  selected.value = n
  dialogVisible.value = true
}

function openSource(url?: string) {
  if (url) window.open(url, '_blank', 'noopener')
}

function impactTagType(impact: string): 'danger' | 'success' | 'info' {
  if (impact === '利好金价') return 'danger'
  if (impact === '利空金价') return 'success'
  return 'info'
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
.live-section {
  border: 1px dashed #b08a3e;
  border-radius: 10px;
  padding: 14px 16px;
  margin-bottom: 20px;
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
  gap: 4px;
}
.live-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.live-item:hover {
  background-color: rgba(176, 138, 62, 0.08);
}
.live-item-title {
  font-size: 13px;
  color: #2b2924;
  line-height: 1.5;
}
.live-item-meta {
  font-size: 12px;
  color: #b3afa4;
  margin-top: 2px;
}
.live-empty {
  font-size: 13px;
  color: #b3afa4;
  padding: 6px 0;
}
.curated-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 14px;
  color: #2b2924;
  margin: 4px 0 12px;
}
.news-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.news-item {
  border: 1px solid #e8e4da;
  border-radius: 12px;
  padding: 14px 18px;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, border-color 0.25s ease;
}
.news-item:hover {
  border-color: #b08a3e;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
  transform: translateY(-3px);
}
.news-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.news-title {
  font-size: 15px;
  font-weight: 600;
  color: #2b2924;
}
.news-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.news-time {
  font-size: 12px;
  color: #8a877d;
}
.news-summary {
  margin: 8px 0 0;
  font-size: 13px;
  color: #57544c;
  line-height: 1.6;
}
.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-time {
  font-size: 13px;
  color: #8a877d;
}
.detail-summary {
  margin: 12px 0;
  font-size: 14px;
  color: #57544c;
  line-height: 1.7;
}
.detail-content-title {
  font-size: 14px;
  font-weight: 600;
  color: #2b2924;
  margin-bottom: 8px;
}
.detail-content {
  font-size: 14px;
  color: #2b2924;
  line-height: 1.9;
  text-align: justify;
}
.source-link {
  margin-bottom: 8px;
}
.analysis-box {
  margin-top: 24px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(176, 138, 62, 0.08), rgba(176, 138, 62, 0.03));
  border: 1px solid rgba(176, 138, 62, 0.25);
  border-radius: 10px;
}
.analysis-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8a6d1f;
  margin-bottom: 8px;
}
.analysis-sections {
  max-height: 46vh;
  overflow-y: auto;
  padding-right: 6px;
}
.sec-heading {
  font-size: 13px;
  font-weight: 700;
  color: #8a6d1f;
  margin: 10px 0 4px;
}
.sec-heading:first-child {
  margin-top: 0;
}
.analysis-text {
  margin: 0 0 8px;
  font-size: 14px;
  color: #5f5030;
  line-height: 1.9;
  text-align: justify;
}
</style>
