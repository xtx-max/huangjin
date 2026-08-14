#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
黄金新闻更新脚本（US-009）

从 tushare `news`（新闻快讯）接口拉取最近 30 天的快讯，
筛选标题含"金"的条目合并写入 frontend/src/data/news.json 顶部（去重、上限 50 条）。

- token 从仓库根 .env 读取，绝不硬编码、绝不写入输出文件。
- 权限不足（tushare 新闻类接口需单独开通，与积分无关）时：
  打印明确提示并以退出码 0 结束，**不覆盖**现有 news.json。

用法: python3 scripts/fetch_news.py
仅使用 Python 标准库。
"""
import json
import os
import sys
import urllib.request
from datetime import date, timedelta

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(REPO_ROOT, ".env")
OUT_PATH = os.path.join(REPO_ROOT, "frontend", "src", "data", "news.json")
TUSHARE_URL = "http://api.tushare.pro"
MAX_ITEMS = 50
DAYS_BACK = 30


def read_token() -> str:
    if not os.path.exists(ENV_PATH):
        print("错误：未找到 .env 文件，请先创建并写入 TUSHARE_TOKEN=xxx", file=sys.stderr)
        sys.exit(1)
    token = ""
    for line in open(ENV_PATH, encoding="utf-8"):
        line = line.strip()
        if line.startswith("TUSHARE_TOKEN="):
            token = line.split("=", 1)[1].strip()
    if not token:
        print("错误：.env 中未找到 TUSHARE_TOKEN", file=sys.stderr)
        sys.exit(1)
    return token


def call_news_api(token: str, start: str, end: str) -> dict:
    body = json.dumps(
        {
            "api_name": "news",
            "token": token,
            "params": {"start_date": start, "end_date": end},
            "fields": "",
        }
    ).encode("utf-8")
    req = urllib.request.Request(
        TUSHARE_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    end = date.today()
    start = end - timedelta(days=DAYS_BACK)
    start_str = f"{start.strftime('%Y-%m-%d')} 00:00:00"
    end_str = f"{end.strftime('%Y-%m-%d')} 00:00:00"

    token = read_token()
    try:
        resp = call_news_api(token, start_str, end_str)
    except Exception as exc:  # 网络/解析异常也不应破坏现有数据
        print(f"提示：tushare 接口调用失败（{exc}），未更新 news.json，保留现有内容。")
        return

    code = resp.get("code")
    if code != 0:
        msg = resp.get("msg") or "未知错误"
        print(f"提示：tushare news 接口返回 code={code}：{msg}")
        print("说明：tushare 新闻类接口需在官网单独开通权限（与积分无关）。")
        print("已跳过更新，news.json 保持现状（静态人工维护内容不受影响）。")
        return

    data = resp.get("data") or {"fields": [], "items": []}
    fields = data["fields"]
    idx = {name: i for i, name in enumerate(fields)}
    new_items = []
    for item in data["items"]:
        try:
            title = str(item[idx.get("title", -1)] or "").strip() if idx.get("title", -1) >= 0 else ""
            if not title:
                continue
            content = str(item[idx.get("content", -1)] or "").strip() if idx.get("content", -1) >= 0 else ""
            src = str(item[idx.get("src", -1)] or "").strip() if idx.get("src", -1) >= 0 else ""
            dt = str(item[idx.get("datetime", -1)] or "").strip() if idx.get("datetime", -1) >= 0 else ""
        except (IndexError, KeyError):
            continue
        if "金" not in title:
            continue
        new_items.append(
            {
                "id": f"news-{dt.replace(' ', '').replace(':', '')}-{len(new_items) + 1}",
                "title": title,
                "time": dt,
                "source": src or "tushare",
                "summary": title,
                "content": content or title,
            }
        )
    if not new_items:
        print("提示：接口正常但最近 30 天没有标题含“金”的快讯，news.json 保持不变。")
        return

    # 合并：去重（按标题），新快讯置顶，总量上限 50
    old = []
    if os.path.exists(OUT_PATH):
        with open(OUT_PATH, encoding="utf-8") as f:
            old = json.load(f).get("items", [])
    existing_titles = {n["title"] for n in old}
    merged = [n for n in new_items if n["title"] not in existing_titles] + old
    merged = merged[:MAX_ITEMS]

    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump({"items": merged}, f, ensure_ascii=False, indent=2)
    added = sum(1 for n in new_items if n["title"] not in existing_titles)
    print(f"已更新 news.json：新增 {added} 条，当前共 {len(merged)} 条。")


if __name__ == "__main__":
    main()
