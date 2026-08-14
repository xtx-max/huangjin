#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
黄金新闻每日自动抓取（GitHub Actions 定时任务用，亦可本地运行）

数据源（均免费、无密钥）：
  1. 东方财富公开搜索接口（关键词"黄金"，JSONP 包装，国内可直连）
  2. Google News RSS（中文区，GitHub Actions 美国节点可访问）

将标题含"金"的快讯去重后写入 frontend/src/data/news.json 顶部（上限 50 条）。
每条自动快讯：impact=中性、analysis=自动抓取说明文案。

用法: python3 scripts/fetch_news_rss.py
仅使用 Python 标准库；幂等（重复运行按标题去重）。
"""
import json
import os
import re
import ssl
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(REPO_ROOT, "frontend", "src", "data", "news.json")
MAX_ITEMS = 80  # news.json 总量上限（保留人工整理归档）
FRESH_CAP = 30  # 每次自动抓取置顶的条数上限
UA = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    )
}

AUTO_ANALYSIS = (
    "本条为每日自动抓取的快讯，暂无人工解读；行情影响请结合「波动分析-事件归因」"
    "与「金价预测」页面综合判断。"
)


def make_ssl_context():
    """优先用 certifi 的 CA 证书（macOS python.org 安装包默认不信任系统根证书）。"""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def http_get(url: str, timeout: int = 45) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout, context=make_ssl_context()) as resp:
        return resp.read().decode("utf-8", errors="replace")


def strip_tags(s: str) -> str:
    return re.sub(r"<[^>]*>", "", s or "").strip()


GOLD_PATTERN = re.compile(r"黄金|金价|央行购金")


def is_gold(title: str) -> bool:
    return bool(GOLD_PATTERN.search(title))


def normalize_time(raw: str) -> str:
    """统一为 YYYY-MM-DD HH:mm；无法解析时原样返回。"""
    raw = (raw or "").strip()
    if not raw:
        return ""
    if re.match(r"^\d{4}-\d{2}-\d{2}", raw):
        return raw[:16]
    try:
        return parsedate_to_datetime(raw).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return raw


def fetch_eastmoney_search() -> list:
    """东方财富搜索接口（关键词=黄金，JSONP 包装）。可能被频率限制，失败返回空。"""
    param = urllib.parse.quote(
        json.dumps(
            {
                "uid": "",
                "keyword": "黄金",
                "type": ["cmsArticleWebOld"],
                "client": "web",
                "clientType": "web",
                "clientVersion": "curr",
                "param": {
                    "cmsArticleWebOld": {
                        "searchScope": "default",
                        "sort": "default",
                        "pageIndex": 1,
                        "pageSize": 20,
                        "preTag": "<em>",
                        "postTag": "</em>",
                    }
                },
            },
            ensure_ascii=False,
        )
    )
    url = f"https://search-api-web.eastmoney.com/search/jsonp?cb=x&param={param}"
    try:
        text = http_get(url)
        start, end = text.find("("), text.rfind(")")
        if start < 0 or end <= start:
            return []
        data = json.loads(text[start + 1 : end])
        return data.get("result", {}).get("cmsArticleWebOld", []) or []
    except Exception as exc:
        print(f"提示：东方财富搜索接口失败（{exc}）。")
        return []


def fetch_eastmoney_columns() -> list:
    """东方财富栏目接口兜底（财经栏目 351，CORS 开放、无频率限制）。"""
    url = (
        "https://np-listapi.eastmoney.com/comm/web/getNewsByColumns"
        "?client=web&biz=web_news_col&column=351&order=1&needInteractData=0"
        "&page_index=1&page_size=50&req_trace=1"
    )
    try:
        data = json.loads(http_get(url))
        return data.get("data", {}).get("list", []) or []
    except Exception as exc:
        print(f"提示：东方财富栏目接口失败（{exc}）。")
        return []


def em_raw_to_item(raw: dict, idx: int) -> dict:
    title = strip_tags(raw.get("title"))
    content = strip_tags(raw.get("content") or raw.get("summary"))
    return {
        "id": f"news-rss-{raw.get('code') or idx}",
        "title": title,
        "time": normalize_time(raw.get("date") or raw.get("showTime")),
        "source": raw.get("mediaName") or "东方财富",
        "summary": content[:60] + ("…" if len(content) > 60 else ""),
        "content": content or title,
        "impact": "中性",
        "analysis": AUTO_ANALYSIS,
        "link": raw.get("url") or raw.get("uniqueUrl"),
    }


def fetch_eastmoney() -> list:
    raws = fetch_eastmoney_search()
    if not raws:
        raws = fetch_eastmoney_columns()
    return [em_raw_to_item(r, i) for i, r in enumerate(raws) if is_gold(strip_tags(r.get("title")))]


def fetch_google_news() -> list:
    """Google News RSS（中文区），标题含"金"过滤。失败时静默返回空。"""
    q = urllib.parse.quote("黄金 OR 金价 OR 央行购金")
    url = f"https://news.google.com/rss/search?q={q}&hl=zh-CN&gl=CN&ceid=CN:zh-Hans"
    items = []
    try:
        text = http_get(url)
        root = ET.fromstring(text)
        for idx, node in enumerate(root.iter("item")):
            title = strip_tags(node.findtext("title"))
            if not is_gold(title):
                continue
            pub = node.findtext("pubDate") or ""
            link = node.findtext("link") or ""
            src_el = node.find("source")
            source = src_el.text if src_el is not None and src_el.text else "Google News"
            items.append(
                {
                    "id": f"news-rss-google-{idx}",
                    "title": title,
                    "time": normalize_time(pub),
                    "source": source,
                    "summary": title,
                    "content": f"{title}（原文：{link}）",
                    "impact": "中性",
                    "analysis": AUTO_ANALYSIS,
                    "link": link,
                }
            )
    except Exception as exc:  # google 在某些网络不可达，属预期
        print(f"提示：Google News RSS 抓取失败（{exc}），跳过该源。")
    return items


def main():
    print("1/2 抓取东方财富…")
    em = fetch_eastmoney()
    print(f"   东方财富：{len(em)} 条含“金”快讯")
    print("2/2 抓取 Google News RSS…")
    gg = fetch_google_news()
    print(f"   Google News：{len(gg)} 条含“金”快讯")

    fresh = em + gg
    if not fresh:
        print("两个源均未抓到金价相关快讯，news.json 保持不变。")
        return

    old = []
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, encoding="utf-8") as f:
            old = json.load(f).get("items", [])
    existing_titles = {i["title"] for i in old}
    fresh_new = [n for n in fresh if n["title"] not in existing_titles][:FRESH_CAP]
    merged = fresh_new + old
    merged = merged[:MAX_ITEMS]

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"items": merged}, f, ensure_ascii=False, indent=2)
    print(f"已更新 news.json：新增 {len(fresh_new)} 条置顶，当前共 {len(merged)} 条（归档保留）。")


if __name__ == "__main__":
    main()
