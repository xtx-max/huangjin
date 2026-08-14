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
      // 1) 卡片/区块入场：Apple 式"模糊→清晰 + 上移淡入"
      gsap.fromTo(
        '.reveal',
        { autoAlpha: 0, y: 26, filter: 'blur(8px)' },
        {
          autoAlpha: 1,
          y: 0,
          filter: 'blur(0px)',
          duration: 0.9,
          ease: 'power3.out',
          stagger: 0.08,
          clearProps: 'filter',
        },
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
          duration: 1.5,
          ease: 'power3.out',
          onUpdate: () => {
            el.textContent = state.v.toFixed(decimals)
          },
        })
      })
      // 3) 表格行入场
      gsap.fromTo(
        '.motion-rows .el-table__body-wrapper tbody tr',
        { autoAlpha: 0, y: 12 },
        { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.025 },
      )
      // 4) 时间线条目入场
      gsap.fromTo(
        '.motion-timeline .el-timeline-item',
        { autoAlpha: 0, x: -20, filter: 'blur(4px)' },
        {
          autoAlpha: 1,
          x: 0,
          filter: 'blur(0px)',
          duration: 0.7,
          ease: 'power3.out',
          stagger: 0.05,
          clearProps: 'filter',
        },
      )
      // 5) 新闻/事件列表项入场
      gsap.fromTo(
        '.motion-list > *',
        { autoAlpha: 0, y: 18 },
        { autoAlpha: 1, y: 0, duration: 0.65, ease: 'power3.out', stagger: 0.05 },
      )
    }, root.value)
  })

  onBeforeUnmount(() => {
    ctx?.revert()
  })
}
