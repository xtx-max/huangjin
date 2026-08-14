<template>
  <el-dialog
    v-model="visible"
    :title="event?.title ?? ''"
    width="640px"
    top="8vh"
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
      <p class="detail-summary">{{ event.summary }}</p>
      <div class="detail-analysis-title">详细分析</div>
      <p class="detail-analysis">{{ event.analysis }}</p>
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
  color: #909399;
}
.detail-region {
  font-size: 12px;
  color: #909399;
}
.detail-summary {
  margin: 12px 0;
  font-size: 14px;
  color: #606266;
  line-height: 1.7;
}
.detail-analysis-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.detail-analysis {
  font-size: 14px;
  color: #303133;
  line-height: 1.9;
  text-align: justify;
  white-space: pre-wrap;
}
</style>
