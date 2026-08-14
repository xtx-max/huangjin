<template>
  <el-dialog
    v-model="visible"
    :title="event?.title ?? ''"
    width="760px"
    top="6vh"
    class="event-dialog"
  >
    <template v-if="event">
      <div class="detail-meta">
        <span class="detail-date">{{ event.date }}</span>
        <el-tag size="small" :type="categoryTagType(event.category)" effect="plain">
          {{ event.category }}
        </el-tag>
        <el-tag size="small" :type="impactTagType(event.impact)" effect="dark">
          {{ event.impact }}
        </el-tag>
        <span class="detail-region">{{ event.region }}</span>
      </div>
      <div class="detail-summary-box">
        <span class="summary-label">一句话概要</span>
        <p class="detail-summary">{{ event.summary }}</p>
      </div>
      <div class="detail-analysis-title">深度分析</div>
      <div class="analysis-body">
        <template v-for="(sec, i) in analysisSections" :key="i">
          <div v-if="sec.heading" class="sec-heading">{{ sec.heading }}</div>
          <p v-for="(para, j) in sec.paragraphs" :key="j" class="sec-para">{{ para }}</p>
        </template>
      </div>
    </template>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { GoldEvent } from '@/data/events'

const props = defineProps<{
  event: GoldEvent | null
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})

interface Section {
  heading: string
  paragraphs: string[]
}

/** 把 analysis 按【小节标题】拆分为带标题的段落组；无标题则整体作为正文 */
const analysisSections = computed<Section[]>(() => {
  const text = props.event?.analysis ?? ''
  const lines = text.split(/\r?\n/)
  const sections: Section[] = []
  let current: Section = { heading: '', paragraphs: [] }
  const headingRe = /^【([^】]{1,12})】\s*$/
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
.detail-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-date {
  font-size: 13px;
  color: #8a877d;
}
.detail-region {
  font-size: 12px;
  color: #8a877d;
}
.detail-summary-box {
  margin: 14px 0 18px;
  padding: 12px 16px;
  background: #f5f5f7;
  border-radius: 12px;
}
.summary-label {
  font-size: 12px;
  color: #8a877d;
  display: block;
  margin-bottom: 4px;
}
.detail-summary {
  margin: 0;
  font-size: 14px;
  color: #3a3a3c;
  line-height: 1.7;
}
.detail-analysis-title {
  font-size: 15px;
  font-weight: 700;
  color: #1d1d1f;
  letter-spacing: -0.01em;
  margin-bottom: 12px;
}
.analysis-body {
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 8px;
}
.sec-heading {
  font-size: 15px;
  font-weight: 700;
  color: #8a6d1f;
  margin: 18px 0 8px;
  letter-spacing: -0.01em;
}
.sec-heading:first-child {
  margin-top: 0;
}
.sec-para {
  margin: 0 0 12px;
  font-size: 15px;
  color: #1d1d1f;
  line-height: 2;
  text-align: justify;
  white-space: pre-wrap;
}
</style>
