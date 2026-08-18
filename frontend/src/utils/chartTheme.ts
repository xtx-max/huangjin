// ECharts 统一视觉主题片段（Apple 质感：无轴线、浅虚线网格、白底圆角悬浮提示）
export const CHART_TOOLTIP = {
  backgroundColor: '#ffffff',
  borderColor: '#e8e8ed',
  borderWidth: 1,
  padding: [10, 14] as [number, number],
  textStyle: { color: '#1d1d1f', fontSize: 13 },
  extraCssText: 'box-shadow: 0 8px 24px rgba(0,0,0,0.08); border-radius: 12px;',
}

export const CHART_X = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: '#8a8a8e', fontSize: 11 },
  boundaryGap: false,
}

export const CHART_Y = {
  axisLine: { show: false },
  axisTick: { show: false },
  axisLabel: { color: '#8a8a8e', fontSize: 11 },
  nameTextStyle: { color: '#8a8a8e', fontSize: 11 },
  splitLine: { lineStyle: { color: '#f0f0f2', type: 'dashed' as const } },
}

export const CHART_LEGEND = {
  icon: 'roundRect' as const,
  itemWidth: 16,
  itemHeight: 4,
  textStyle: { color: '#57544c', fontSize: 12 },
}
