# PRD: 黄金市场行情分析站（静态化改造 GPAFP）

## Introduction

基于 fork 的 [bzgz-tech/GPAFP](https://github.com/bzgz-tech/GPAFP)（黄金价格分析与预测平台，Vue3 + Element Plus + ECharts，Apache-2.0）做**静态化改造**：砍掉 Python 后端，历史金价数据与事件库打包为静态 JSON，分析在前端计算，最终产物为纯静态站点，可部署到 GitHub Pages、可直接在浏览器打开。

核心价值：为中文用户提供 1970 年至今的国际金价 + 2004 年至今的国内金价（上海黄金交易所 Au99.99）完整记录，叠加影响黄金的全球重大事件时间线与每件事的详细分析，并展示最新黄金新闻动态。

## Goals

- 一个纯静态站点，`npm run build` 产物双击/静态托管即可在浏览器打开
- 国际金价 XAU/USD：2004-06 至今日线 + 1970-01 至 2004-05 月度（伦敦定盘价）
- 国内金价：上海黄金交易所 Au99.99 日线，2004-01 至今
- 影响黄金的全球事件库 ≥30 件（1971–2025），每件有详细中文分析
- 金价波动指标分析（均线/波动率/回撤/区间统计）全部前端计算
- 黄金新闻：内置静态快讯 + tushare 更新脚本
- GitHub Pages 部署工作流与中文部署说明

## User Stories

（详见 scripts/ralph/prd.json，含验收标准；一次迭代只做一个故事。）

### US-001: 静态化改造基座
As a developer, I want 移除后端依赖与登录鉴权 so that 前端可独立构建为纯静态站点。
- 删除 backend/ 与 start*.ps1/bat 启动脚本
- 移除 Login/Register/ChangePassword/UserManagement/Feedback/Settings/Monitor 页面与路由，删除登录守卫
- 删除 axios api.ts 与所有 token 逻辑
- 修复 vue-tsc 报错，`npm run build` 通过
- 保留 Dashboard/Market/Analysis/News 四个页面骨架

### US-002: 数据获取脚本与金价数据文件
As a developer, I want 一键脚本生成金价静态数据 so that 页面无需后端即可展示历史行情。
- scripts/fetch_gold_data.py（仅标准库 urllib/json）
  - 国际日线 2004-今：https://raw.githubusercontent.com/FeziweMelvin/XAUUSD-Gold-Price/main/XAU_1d_data.csv
  - 国际月度 1970-2004：https://datahub.io/core/gold-prices/r/monthly.csv（USD 列）
  - 国内日线 2004-今：tushare sge_daily（Au99.99），token 只从项目根 .env 读
- 输出 frontend/src/data/gold-prices.json

### US-003: 首页行情总览（Dashboard 改造）
As a user, I want 首页看到国际/国内金价最新价与走势图 so that 打开网站即了解行情。
- 最新价/涨跌/涨跌幅卡片；ECharts 折线图；范围切换（1月/6月/1年/5年/全部）；国际/国内切换

### US-004: 历史数据记录页（Market 改造）
As a user, I want 查询任意区间的历史金价明细与区间统计 so that 了解过往所有金价波动记录。
- 完整表格 + 日期区间筛选 + 分页；区间最高/最低/平均/累计涨跌幅；1970-2004 显示月度数据

### US-005: 金价波动分析页（Analysis 改造）
As a user, I want 看到均线/波动率/最大回撤等技术分析 so that 理解波动特征。
- 前端计算 MA20/60/120、年化收益、年波动率、最大回撤；均线叠加图 + 回撤子图

### US-006: 影响黄金的全球事件库数据
As a user, I want 内置影响黄金的全球大事件及详细分析 so that 理解金价背后的驱动事件。
- src/data/events.json ≥30 件（1971–2025），字段：id/date/title/category/region/summary/impact/analysis

### US-007: 事件时间线页
As a user, I want 按时间浏览影响黄金的事件时间线 so that 快速定位重要节点。
- 时间线 UI、年份分组、类别与影响方向筛选、点击查看详细分析

### US-008: 事件-金价关联标注
As a user, I want 价格图上看到事件标注并查看事件前后涨跌幅 so that 直观理解事件对金价的影响。
- ECharts markPoint 标注事件日期、点击联动详情、事件前后 30/90/365 日涨跌幅表

### US-009: 黄金新闻页
As a user, I want 看到最新黄金相关新闻 so that 跟踪市场动态。
- 内置静态新闻 + scripts/fetch_news.py（tushare news 接口，权限不足时明确报告不崩溃）

### US-010: GitHub Pages 部署配置
As a user, I want 一键构建出可部署的静态产物 so that 拿到公网可访问的版本。
- vite base:'./'；.github/workflows/deploy.yml；README 中文部署步骤

## Functional Requirements

- FR-1: 站点为纯静态，构建产物无任何后端依赖
- FR-2: 国际金价日线覆盖 2004-06-11 至今，月度覆盖 1970-01 至 2004-05
- FR-3: 国内金价 Au99.99 日线覆盖 2004-01-02 至今
- FR-4: 首页展示最新价、涨跌幅与可切换时间范围的价格图
- FR-5: 历史页支持区间筛选、分页与区间统计
- FR-6: 分析页展示均线、年化收益、年波动率、最大回撤
- FR-7: 事件库 ≥30 件，每件含详细中文分析；时间线页可筛选、可看详情
- FR-8: 价格图可标注事件并可查看事件前后涨跌幅
- FR-9: 新闻页展示快讯列表与详情，附更新脚本
- FR-10: 部署工作流与中文说明，构建产物资源为相对路径

## Non-Goals

- 不做登录/用户体系、不做评论反馈
- 不做价格预测（保留原项目的预测代码但不在静态版启用——静态版不做预测模型）
- 不做实时推送/WebSocket；数据更新靠脚本 + GitHub Actions 定时任务（可选）
- 不做后端数据库；所有数据以 JSON 形式入库前端
- tushare token 只存在本地 .env，绝不进入构建产物或 git

## Technical Considerations

- 基座：GPAFP 前端（Vue 3.3 + Vite 4 + Element Plus 2.4 + ECharts 5.4 + vue-router 4）
- 数据文件：frontend/src/data/gold-prices.json / events.json / news.json
- 脚本：scripts/*.py，仅 Python 3 标准库；tushare 通过 HTTP POST api.tushare.pro
- 保密：token 在项目根 .env（已被 .gitignore 排除），脚本以环境变量方式读取
- 数据源（已验证可用）：
  - 国际日线 2004-今：GitHub FeziweMelvin/XAUUSD-Gold-Price XAU_1d_data.csv（约 5400 行，OHLC+Volume）
  - 国际月度 1970-2004：datahub.io core/gold-prices monthly.csv
  - 国内日线 2004-今：tushare sge_daily Au99.99（单次最多 2000 行，需按日期分页循环拉取）
- 构建：cd frontend && npm run build（vue-tsc 必须零错误）

## Success Metrics

- 所有故事验收标准通过（Typecheck + 浏览器验证）
- 构建产物在任意静态托管可打开，无 404 资源
- 数据覆盖：国际 1970 至今（日线+月度）、国内 2004 至今（日线）
- 事件库 ≥30 件且每件有 ≥200 字中文分析

## Open Questions

- GitHub Pages 部署目标仓库由用户提供（gh CLI 未安装、无推送凭据）；US-010 产出工作流与说明后，由用户 push 或提供凭据
- tushare news 接口（新闻快讯）权限需实测；不足则静态新闻 + 手动更新
