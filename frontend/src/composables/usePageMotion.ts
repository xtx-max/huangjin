// 页面级 GSAP 动效（Vue 3）：入场编排 / 数字滚动 / 表格行与时间线 stagger
// 约定：元素默认可见（隐藏状态只由 GSAP 在动画开始时施加），
// 用户开启"减少动态效果"时不做任何动画，界面保持静态可见。
import { onBeforeUnmount, onMounted, type Ref } from 'vue'
import { gsap } from 'gsap'

export function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function usePageMotion(root: Ref<HTMLElement | null>) {
  let ctx: gsap.Context | null = null

  onMounted(() => {
    if (!root.value || prefersReducedMotion()) return
    ctx = gsap.context(() => {
      // 1) 卡片/区块入场：上移淡入，依次 stagger
      gsap.fromTo(
        '.reveal',
        { autoAlpha: 0, y: 22 },
        { autoAlpha: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.08 },
      )
      // 2) 数字滚动：元素需带 data-value / data-decimals；未提供 data-value 时跳过
      document.querySelectorAll<HTMLElement>('.motion-count').forEach((el) => {
        const raw = el.dataset.value
        if (raw === undefined || raw === '') return
        const target = parseFloat(raw)
        if (Number.isNaN(target)) return
        const decimals = parseInt(el.dataset.decimals || '0', 10)
        const state = { v: 0 }
        gsap.to(state, {
          v: target,
          duration: 1.1,
          ease: 'power2.out',
          onUpdate: () => {
            el.textContent = state.v.toFixed(decimals)
          },
        })
      })
      // 3) 表格行入场
      gsap.fromTo(
        '.motion-rows .el-table__body-wrapper tbody tr',
        { autoAlpha: 0, y: 10 },
        { autoAlpha: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.02 },
      )
      // 4) 时间线条目入场
      gsap.fromTo(
        '.motion-timeline .el-timeline-item',
        { autoAlpha: 0, x: -18 },
        { autoAlpha: 1, x: 0, duration: 0.45, ease: 'power2.out', stagger: 0.05 },
      )
      // 5) 新闻/事件列表项入场
      gsap.fromTo(
        '.motion-list > *',
        { autoAlpha: 0, y: 16 },
        { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out', stagger: 0.05 },
      )
    }, root.value)
  })

  onBeforeUnmount(() => {
    ctx?.revert()
  })
}
