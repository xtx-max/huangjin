#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
国际金价日线补全脚本（在 GitHub Actions 美国节点运行，本地网络无法直连 Yahoo）

从 Yahoo Finance chart API 拉取 GC=F（COMEX 黄金期货，2000-08 起日线），
把晚于现有 internationalDaily 尾端的数据合并进 frontend/src/data/gold-prices.json。

用法: python3 scripts/fetch_intl_yahoo.py
仅使用 Python 标准库；幂等。
"""
import json
import os
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timezone

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(REPO_ROOT, "frontend", "src", "data", "gold-prices.json")
UA = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/125.0 Safari/537.36"
    )
}
YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=max&interval=1d"


def http_get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers=UA)
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8"))


def main():
    if not os.path.exists(OUT_PATH):
        print("错误：未找到 gold-prices.json", file=sys.stderr)
        sys.exit(1)
    with open(OUT_PATH, encoding="utf-8") as f:
        data = json.load(f)

    print("从 Yahoo Finance 拉取 GC=F 全历史日线…")
    payload = http_get_json(YAHOO_URL)
    result = payload["chart"]["result"][0]
    ts = result["timestamp"]
    quote = result["indicators"]["quote"][0]
    closes = quote["close"]

    rows = {}
    for i, t in enumerate(ts):
        c = closes[i]
        if c is None or c <= 0:
            continue
        date_str = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
        rows[date_str] = {
            "date": date_str,
            "open": round(quote["open"][i], 2) if quote["open"][i] else None,
            "high": round(quote["high"][i], 2) if quote["high"][i] else None,
            "low": round(quote["low"][i], 2) if quote["low"][i] else None,
            "close": round(c, 2),
        }
    for r in rows.values():
        if r["open"] is None:
            r["open"] = r["close"]
            r["high"] = r["close"]
            r["low"] = r["close"]

    existing = {r["date"]: r for r in data["internationalDaily"]}
    last_existing = max(existing) if existing else "0000-00-00"
    merged = {**existing}
    added = 0
    for d, r in rows.items():
        if d > last_existing:
            merged[d] = r
            added += 1
    new_daily = [merged[k] for k in sorted(merged)]

    if added == 0:
        print("Yahoo 数据未晚于现有尾端，无需更新。")
        return

    data["internationalDaily"] = new_daily
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"已补入 {added} 个交易日，国际日线现覆盖 {new_daily[0]['date']} ~ {new_daily[-1]['date']}。")


if __name__ == "__main__":
    main()
