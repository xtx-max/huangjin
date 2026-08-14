<template>
  <div id="app">
    <el-container class="layout-container">
      <el-header class="app-header">
        <div class="left">
          <div class="logo">
            <img :src="logoUrl" class="logo-icon" alt="Logo" />
            <span class="brand">黄金市场行情分析</span>
          </div>
          <el-menu
            mode="horizontal"
            router
            :ellipsis="false"
            :default-active="activePath"
            background-color="var(--color-header-bg)"
            text-color="var(--color-menu-text)"
            active-text-color="var(--color-menu-active-text)"
            class="nav-menu"
          >
            <el-menu-item index="/">
              <el-icon><Odometer /></el-icon>
              <span>行情总览</span>
            </el-menu-item>
            <el-menu-item index="/market">
              <el-icon><TrendCharts /></el-icon>
              <span>历史数据</span>
            </el-menu-item>
            <el-menu-item index="/analysis">
              <el-icon><DataAnalysis /></el-icon>
              <span>波动分析</span>
            </el-menu-item>
            <el-menu-item index="/news">
              <el-icon><Reading /></el-icon>
              <span>黄金新闻</span>
            </el-menu-item>
          </el-menu>
        </div>
      </el-header>
      <el-main class="app-main">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </el-main>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Odometer,
  TrendCharts,
  DataAnalysis,
  Reading,
} from '@element-plus/icons-vue'
import logoUrl from '@/assets/logo.svg'

const route = useRoute()
const activePath = computed(() => route.path)
</script>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: var(--bg-color-base);
}
#app {
  width: 100%;
  height: 100vh;
}
</style>

<style scoped>
.layout-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background-color: var(--color-header-bg);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  height: 64px;
}

.left {
  display: flex;
  align-items: center;
  height: 100%;
  flex: 1;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 24px;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  white-space: nowrap;
}

.logo-icon {
  width: 32px;
  height: 32px;
}

.nav-menu {
  border-bottom: none;
  height: 64px;
  flex: 1;
  min-width: 0;
}

:deep(.el-menu--horizontal > .el-menu-item) {
  height: 64px;
  line-height: 64px;
  border-bottom: none;
}

:deep(.el-menu--horizontal > .el-menu-item.is-active) {
  background-color: var(--el-color-primary) !important;
  border-bottom: none;
}

.app-main {
  background-color: var(--bg-color-base);
  padding: 24px;
  overflow-y: auto;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
