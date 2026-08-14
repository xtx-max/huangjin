<template>
  <div class="page">
    <el-card shadow="never" class="page-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <el-icon><Reading /></el-icon>
            <span>黄金新闻</span>
          </div>
        </div>
      </template>
      <el-empty description="黄金新闻功能开发中，敬请期待" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { Reading } from '@element-plus/icons-vue'
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
  justify-content: space-between;
  align-items: center;
}
.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
}
.header-title .el-icon {
  color: #409eff;
}
</style>
