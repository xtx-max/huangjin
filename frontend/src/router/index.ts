import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'
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
    path: '/news',
    name: 'News',
    component: () => import('@/pages/News.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
