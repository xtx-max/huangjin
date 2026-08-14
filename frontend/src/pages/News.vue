<template>
  <div class="page" ref="pageRoot">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Reading /></el-icon>
            <span>黄金新闻</span>
            <span class="count">共 {{ items.length }} 条</span>
          </div>
          <el-tag size="small" type="info" effect="plain">
            内容为人工整理快讯，可用 scripts/fetch_news.py 更新
          </el-tag>
        </div>
      </template>

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
          <div class="analysis-box">
            <div class="detail-content-title analysis-title">
              <el-icon><DataAnalysis /></el-icon>
              <span>影响分析</span>
            </div>
            <p class="analysis-text">{{ selected.analysis }}</p>
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
import { ref } from 'vue'
import { DataAnalysis, Reading } from '@element-plus/icons-vue'
import { loadNews, type NewsItem } from '@/data/news'
import { usePageMotion } from '@/composables/usePageMotion'

const items = loadNews()
const dialogVisible = ref(false)
const selected = ref<NewsItem | null>(null)

const pageRoot = ref<HTMLElement | null>(null)
usePageMotion(pageRoot)

function openDetail(n: NewsItem) {
  selected.value = n
  dialogVisible.value = true
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
}
.count {
  font-size: 12px;
  font-weight: 400;
  color: #909399;
}
.news-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.news-item {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 16px;
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.25s ease, border-color 0.25s ease;
}
.news-item:hover {
  border-color: #c8a24b;
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
  color: #303133;
}
.news-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}
.news-time {
  font-size: 12px;
  color: #909399;
}
.news-summary {
  margin: 8px 0 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}
.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-time {
  font-size: 13px;
  color: #909399;
}
.detail-summary {
  margin: 12px 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.7;
}
.detail-content-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.detail-content {
  font-size: 14px;
  color: #303133;
  line-height: 1.9;
  text-align: justify;
}
.analysis-box {
  margin-top: 16px;
  padding: 14px 16px;
  background: linear-gradient(135deg, rgba(200, 162, 75, 0.08), rgba(200, 162, 75, 0.03));
  border: 1px solid rgba(200, 162, 75, 0.25);
  border-radius: 10px;
}
.analysis-title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #8a6d1f;
  margin-bottom: 8px;
}
.analysis-text {
  margin: 0;
  font-size: 14px;
  color: #5f5030;
  line-height: 1.9;
  text-align: justify;
}
</style>
