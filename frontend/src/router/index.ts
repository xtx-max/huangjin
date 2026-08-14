import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'
import Dashboard from '@/pages/Dashboard.vue'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard,
  },
  {
    path: '/market',
    name: 'Market',
    component: () => import('@/pages/Market.vue'),
  },
  {
    path: '/analysis',
    name: 'Analysis',
    component: () => import('@/pages/Analysis.vue'),
  },
  {
    path: '/events',
    name: 'Events',
    component: () => import('@/pages/Events.vue'),
  },
  {
    path: '/news',
    name: 'News',
    component: () => import('@/pages/News.vue'),
  },
]

const router = createRouter({
  // 哈希路由：兼容 GitHub Pages 等无服务端重写规则的静态托管（/events 等深链接可直接刷新）
  history: createWebHashHistory(),
  routes,
})

export default router
