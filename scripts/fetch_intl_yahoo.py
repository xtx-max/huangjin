#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
国际金价日线补全脚本（在 GitHub Actions 美国节点运行）

按顺序尝试数据源，取"晚于现有尾端"的交易日合并进 gold-prices.json：
  1. Yahoo Finance GC=F（重试 3 次，机房 IP 可能被限流 429）
  2. Dukascopy XAUUSD 现货日线（2025、2026 年度文件；与现有 MT4 现货序列同口径）
  3. Stooq xauusd 现货 CSV

用法: python3 scripts/fetch_intl_yahoo.py
仅使用 Python 标准库；幂等；无任何密钥。
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


def http_get(url: str, timeout: int = 90) -> str:
    req = urllib.request.Request(url, headers=UA)
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, timeout=timeout, context=ctx) as resp:
        return resp.read().decode("utf-8", errors="replace")


def http_get_json(url: str) -> dict:
    return json.loads(http_get(url))


def norm_row(date_str: str, o, h, lo, c) -> dict:
    for v in (o, h, lo, c):
        if v is None:
            o = h = lo = c = c
            break
    return {
        "date": date_str,
        "open": round(float(o), 2),
        "high": round(float(h), 2),
        "low": round(float(lo), 2),
        "close": round(float(c), 2),
    }


def fetch_yahoo() -> dict:
    """Yahoo GC=F，带重试（429 限流常见）。"""
    last_err = None
    for attempt in range(1, 4):
        try:
            payload = http_get_json(YAHOO_URL)
            result = payload["chart"]["result"][0]
            ts = result["timestamp"]
            quote = result["indicators"]["quote"][0]
            rows = {}
            for i, t in enumerate(ts):
                c = quote["close"][i]
                if c is None or c <= 0:
                    continue
                d = datetime.fromtimestamp(t, tz=timezone.utc).strftime("%Y-%m-%d")
                rows[d] = norm_row(d, quote["open"][i], quote["high"][i], quote["low"][i], c)
            return rows
        except Exception as exc:
            last_err = exc
            print(f"  Yahoo 第 {attempt} 次失败（{exc}），等待后重试…")
            time.sleep(25 * attempt)
    print(f"  提示：Yahoo 不可用（{last_err}），改用 Dukascopy。")
    return {}


def parse_dukascopy_line(line: str) -> dict | None:
    parts = line.replace(",", ";").split(";")
    if len(parts) < 6:
        return None
    try:
        dt = datetime.strptime(parts[0].split(" ")[0], "%d.%m.%Y")
        o, h, lo, c = (float(x) for x in parts[1:5])
    except (ValueError, IndexError):
        return None
    if c <= 0:
        return None
    return norm_row(dt.strftime("%Y-%m-%d"), o, h, lo, c)


def fetch_dukascopy() -> dict:
    """Dukascopy XAUUSD 现货日线（与现有 MT4 现货序列同口径）。"""
    rows = {}
    for year in (2025, 2026):
        url = f"https://datafeed.dukascopy.com/datafeed/XAUUSD/{year}/00/01/BID_candles_day_1.csv"
        try:
            text = http_get(url, timeout=120)
        except Exception as exc:
            print(f"  Dukascopy {year} 失败（{exc}）。")
            continue
        got = 0
        for line in text.splitlines():
            r = parse_dukascopy_line(line.strip())
            if r:
                rows[r["date"]] = r
                got += 1
        print(f"  Dukascopy {year}: {got} 行")
    return rows


def fetch_stooq() -> dict:
    """Stooq xauusd CSV（现货）。"""
    url = "https://stooq.com/q/d/l/?s=xauusd&i=d"
    text = http_get(url, timeout=120)
    rows = {}
    for line in text.splitlines()[1:]:
        parts = line.split(",")
        if len(parts) < 5:
            continue
        try:
            o, h, lo, c = (float(x) for x in parts[1:5])
        except ValueError:
            continue
        if c <= 0:
            continue
        rows[parts[0]] = norm_row(parts[0], o, h, lo, c)
    return rows


def main():
    if not os.path.exists(OUT_PATH):
        print("错误：未找到 gold-prices.json", file=sys.stderr)
        sys.exit(1)
    with open(OUT_PATH, encoding="utf-8") as f:
        data = json.load(f)

    print("1/3 Yahoo Finance GC=F…")
    rows = fetch_yahoo()
    if not rows:
        print("2/3 Dukascopy XAUUSD…")
        rows = fetch_dukascopy()
    if not rows:
        print("3/3 Stooq xauusd…")
        rows = fetch_stooq()
    if not rows:
        print("所有数据源均不可用，本次不更新。")
        sys.exit(0)

    existing = {r["date"]: r for r in data["internationalDaily"]}
    last_existing = max(existing) if existing else "0000-00-00"
    added = 0
    for d, r in rows.items():
        if d > last_existing:
            existing[d] = r
            added += 1
    new_daily = [existing[k] for k in sorted(existing)]

    if added == 0:
        print("新数据未晚于现有尾端，无需更新。")
        return

    data["internationalDaily"] = new_daily
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"已补入 {added} 个交易日，国际日线现覆盖 {new_daily[0]['date']} ~ {new_daily[-1]['date']}。")


if __name__ == "__main__":
    main()
