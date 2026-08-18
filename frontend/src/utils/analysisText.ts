// 大段分析文本的排版工具：分节解析 + 数字高亮
export interface Section {
  heading: string
  paragraphs: string[]
}

/** 把含【小节标题】的文本拆成带标题的段落组；无标题则整体作为正文 */
export function parseSections(text: string): Section[] {
  const lines = text.split(/\r?\n/)
  const sections: Section[] = []
  let current: Section = { heading: '', paragraphs: [] }
  const headingRe = /^【([^】]{1,20})】\s*$/
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
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 段落渲染：先转义，再把关键数字（含正负号/小数/百分号）用 <b class="num"> 高亮，
 * 让"预计 +10.53%""区间 860~1238"这类信息从大段文字中跳出来。
 */
export function renderPara(text: string): string {
  const esc = escapeHtml(text)
  return esc.replace(/([-+]?\d+(?:\.\d+)?(?:%|元\/克|美元\/盎司|个交易日|天|年|件|条)?)/g, '<b class="num">$1</b>')
}
