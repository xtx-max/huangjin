# AGENTS.md — 黄金市场行情分析站（GPAFP 静态化改造）

## 项目定位
fork 自 bzgz-tech/GPAFP（Apache-2.0），静态化改造为**纯前端**黄金行情分析站：无后端、无数据库，
所有数据打包为 JSON 由前端读取。界面为中文。最终产物部署 GitHub Pages。

## 目录结构
- `frontend/` — Vue 3.3 + Vite 4 + Element Plus 2.4 + ECharts 5.4 + vue-router 4 + TypeScript（应用本体）
- `frontend/src/data/` — 静态数据：`gold-prices.json`（金价）、`events.json`（事件库）、`news.json`（新闻）
- `scripts/` — Python 3 标准库数据脚本：`fetch_gold_data.py`、`fetch_news.py`
- `tasks/prd-gold-market-analysis.md` — PRD；`scripts/ralph/` — Ralph 迭代状态
- `.env`（gitignored）— 仅含 `TUSHARE_TOKEN`，脚本用；**绝不提交、绝不写入构建产物**

## 数据 schema（gold-prices.json）
```json
{
  "internationalDaily": [{"date": "YYYY-MM-DD", "open": 0, "high": 0, "low": 0, "close": 0}],
  "internationalMonthly": [{"date": "YYYY-MM-01", "price": 0}],
  "domestic": [{"date": "YYYY-MM-DD", "open": 0, "high": 0, "low": 0, "close": 0}]
}
```
- 国际日线：2004-06-11 至今（FeziweMelvin/XAUUSD-Gold-Price 的 XAU_1d_data.csv，分号分隔，日期如 `2004.06.11 00:00`）
- 国际月度：1970-01 至 2004-05（datahub.io core/gold-prices monthly.csv，列 Date,Price，USD 伦敦定盘价）
- 国内日线：2004-01-02 至今，上海黄金交易所 Au99.99（tushare `sge_daily`，单次最多 2000 行需分页）

## tushare 调用方式（无 SDK，标准库 HTTP）
POST http://api.tushare.pro，JSON body: `{"api_name":"sge_daily","token":"<from .env>","params":{"ts_code":"Au99.99","start_date":"YYYYMMDD","end_date":"YYYYMMDD"},"fields":""}`
返回 `{"code":0,"data":{"fields":[...],"items":[[...],...]}}`；fields 顺序：ts_code, trade_date, close, open, high, low, price_avg, change, pct_change, vol, amount, oi, settle_vol, settle_dire

## 事件库 schema（events.json）
`{"events":[{"id":"evt-001","date":"YYYY-MM-DD","title":"","category":"地缘政治|货币政策|金融危机|战争冲突|公共卫生|供需变化|其他","region":"","summary":"","impact":"利好金价|利空金价|中性","analysis":"200-500字中文"}]}`（按 date 升序）

## 开发约定
- 构建/类型检查：`cd frontend && npm run build`（vue-tsc 必须零错误）；开发：`npm run dev`
- 页面只读本地 JSON import，禁止网络请求；禁止 axios
- 样式沿用 Element Plus；图表统一 ECharts；新页面路由挂 `/xxx` 并加入导航菜单
- 金价单位：国际美元/盎司，国内元/克
- Python 脚本只允许标准库；失败要有明确中文提示；幂等
- 敏感信息：token 只从 .env 读；日志/提交/文件不得出现密钥

## 安全红线
不 push/部署外部服务（部署仅产出配置与说明）；不削弱验收标准；一次迭代只做一个用户故事。
