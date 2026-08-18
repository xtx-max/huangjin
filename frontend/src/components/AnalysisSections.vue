<template>
  <div class="as-wrap">
    <div v-for="(sec, i) in sections" :key="i" class="as-sec">
      <div class="as-head">
        <span class="as-num">{{ String(i + 1).padStart(2, '0') }}</span>
        <span class="as-title">{{ sec.heading }}</span>
        <span class="as-rule"></span>
      </div>
      <p v-for="(para, j) in sec.paragraphs" :key="j" class="as-para" v-html="renderPara(para)"></p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { renderPara, type Section } from '@/utils/analysisText'

defineProps<{
  sections: Section[]
}>()
</script>

<style scoped>
.as-wrap {
  max-height: 62vh;
  overflow-y: auto;
  padding-right: 10px;
}
.as-sec {
  padding: 16px 0;
  border-top: 1px dashed #e6e6ec;
}
.as-sec:first-child {
  border-top: none;
  padding-top: 2px;
}
.as-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.as-num {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: #b08a3e;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}
.as-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #1d1d1f;
  flex-shrink: 0;
}
.as-rule {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, rgba(176, 138, 62, 0.35), rgba(176, 138, 62, 0));
  align-self: center;
}
.as-para {
  margin: 0 0 14px;
  font-size: 15px;
  line-height: 2;
  color: #2b2924;
  text-align: justify;
}
.as-para:last-child {
  margin-bottom: 2px;
}
.as-para :deep(b.num) {
  color: #8a6d1f;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 0 1px;
}
</style>
