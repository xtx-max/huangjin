# 黄金市场行情分析

一个**纯前端、零后端**的黄金市场行情分析站点：1970 年至今的国际金价与国内金价完整记录、影响黄金的全球重大事件时间线与详细分析、金价波动技术指标分析、黄金新闻动态。构建产物为纯静态文件，可直接在浏览器打开，也可一键部署到 GitHub Pages。

> 本项目 fork 自 [bzgz-tech/GPAFP](https://github.com/bzgz-tech/GPAFP)（Apache-2.0），保留其 Vue 3 界面框架，移除 Python 后端并做静态化改造。

## 功能

| 页面 | 说明 |
| --- | --- |
| 行情总览 | 国际/国内金价最新价与涨跌幅卡片；1970 至今走势图（1月/6月/1年/5年/全部切换），图上标注 37 件影响金价的全球大事件，点击查看详情；事件影响统计表（前 30 日、后 30/90/365 日涨跌幅） |
| 历史数据 | 国际日线/国内日线/全部历史(月度)三种视图；日期区间筛选、分页；区间最高/最低/平均/累计涨跌幅统计 |
| 波动分析 | 收盘价 + MA20/60/120 均线叠加图、回撤子图；区间总涨幅、年化收益率、年波动率、最大回撤（全部前端计算） |
| 事件时间线 | 1971–2025 年影响黄金的 37 件全球大事件，按年份分组、类别/影响筛选，每件含背景/传导机制/金价表现/启示四段式中文分析 |
| 黄金新闻 | 29 条人工整理的黄金快讯（美联储决议、央行购金、金价里程碑等），支持脚本更新 |

## 数据来源与覆盖范围

| 数据 | 来源 | 覆盖 |
| --- | --- | --- |
| 国际金价（美元/盎司）日线 | [FeziweMelvin/XAUUSD-Gold-Price](https://github.com/FeziweMelvin/XAUUSD-Gold-Price)（每周自动更新） | 2004-06-11 至今 |
| 国际金价月度（伦敦定盘价） | [datahub.io core/gold-prices](https://datahub.io/core/gold-prices) | 1970-01 至 2004-05 |
| 国内金价（元/克，上海黄金交易所 Au99.99）日线 | [tushare](https://tushare.pro) `sge_daily` 接口（5000 积分权限） | 2004-01-02 至今 |
| 事件库 / 新闻 | 人工整理撰写 | 1971 年至今 |

> 说明：1970–2004 年国际金价仅有月度权威数据（伦敦定盘价），2004 年起为日线，这是数据本身的现实。数据均打包为 `frontend/src/data/*.json`，页面零网络请求。

## 本地运行

```bash
# 依赖安装与开发（浏览器打开 http://localhost:5173）
cd frontend
npm install
npm run dev

# 构建生产版本（产物在 frontend/dist，双击 index.html 或任意静态托管即可打开）
npm run build
```

## 数据更新

```bash
# 需要 tushare token：在项目根创建 .env（已 gitignore，勿提交）
#   TUSHARE_TOKEN=你的token
python3 scripts/fetch_gold_data.py   # 更新金价数据（国际日线+月度+国内 Au99.99 全量）
python3 scripts/fetch_news.py        # 更新新闻快讯（tushare news 接口需单独开通权限，
                                     # 权限不足时会提示并保留现有内容，不影响使用）
```

仅使用 Python 3 标准库。更新后重新 `npm run build` 生效。

## 部署到 GitHub Pages

1. 把本仓库推送到你自己的 GitHub 仓库（`main` 分支）。
2. 打开仓库 **Settings → Pages**，在 *Build and deployment* 的 *Source* 中选择 **GitHub Actions**。
3. 推送 `main` 分支即自动触发 `.github/workflows/deploy.yml` 构建并部署；也可在 **Actions** 页手动运行 *Deploy to GitHub Pages* 工作流。
4. 部署完成后，站点地址为 `https://<你的用户名>.github.io/<仓库名>/`。

> 站点使用哈希路由（`/#/events` 等），刷新与深链接在 GitHub Pages 上均正常工作。

## 技术栈

- Vue 3 + TypeScript + Vite 4
- Element Plus（UI）、ECharts 5（图表）、vue-router 4
- 数据：静态 JSON（`frontend/src/data/`），以 `?raw` 方式加载避免类型检查开销

## 许可

本项目的代码部分沿用上游 [Apache-2.0](LICENSE) 许可；事件库与新闻内容为人工整理，仅供学习研究，不构成投资建议。
