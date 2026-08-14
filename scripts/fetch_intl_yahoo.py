#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
国际金价日线补全脚本（GitHub Actions 定时运行）

主源：东方财富 push2his 日K接口（COMEX 黄金 GC00Y，全球可达、无密钥、无频率限制）
备源：Yahoo Finance GC=F（重试；机房 IP 可能被限流 429）

把晚于现有 internationalDaily 尾端的交易日合并进 gold-prices.json。
注意：2025-06-06 之前为 XAUUSD 伦敦现货（MT4 源），之后为 COMEX 主力期货，
两者价差通常 <1%，合并点可能存在微小跳变。

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
EM_KLINE_URL = (
    "https://push2his.eastmoney.com/api/qt/stock/kline/get"
    "?secid=101.GC00Y&klt=101&fqt=1&lmt=800&end=20500101"
    "&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55,f56"
)
YAHOO_URL = "https://query1.finance.yahoo.com/v8/finance/chart/GC=F?range=max&interval=1d"


def make_ssl_context():
    """优先用 certifi（macOS python.org 安装包默认不信任系统根证书）。"""
    try:
        import certifi

        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def http_get(url: str, timeout: int = 90) -> str:
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout, context=make_ssl_context()) as resp:
        return resp.read().decode("utf-8", errors="replace")


def http_get_json(url: str) -> dict:
    return json.loads(http_get(url))


def norm_row(date_str: str, o, h, lo, c) -> dict:
    return {
        "date": date_str,
        "open": round(float(o), 2),
        "high": round(float(h), 2),
        "low": round(float(lo), 2),
        "close": round(float(c), 2),
    }


def fetch_eastmoney() -> dict:
    """东方财富 COMEX 黄金日K。fields2 顺序: 日期,开,收,高,低,量。"""
    payload = http_get_json(EM_KLINE_URL)
    data = payload.get("data") or {}
    rows = {}
    for line in data.get("klines", []):
        parts = line.split(",")
        if len(parts) < 6:
            continue
        try:
            d, o, c, h, lo = parts[0], float(parts[1]), float(parts[2]), float(parts[3]), float(parts[4])
        except ValueError:
            continue
        if c <= 0 or not d.startswith(("19", "20")):
            continue
        rows[d] = norm_row(d, o, h, lo, c)
    print(f"  东方财富 COMEX 黄金：{len(rows)} 行")
    return rows


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
    print(f"  提示：Yahoo 不可用（{last_err}）。")
    return {}


def main():
    if not os.path.exists(OUT_PATH):
        print("错误：未找到 gold-prices.json", file=sys.stderr)
        sys.exit(1)
    with open(OUT_PATH, encoding="utf-8") as f:
        data = json.load(f)

    print("1/2 东方财富 COMEX 黄金日K…")
    rows = fetch_eastmoney()
    if not rows:
        print("2/2 Yahoo Finance GC=F…")
        rows = fetch_yahoo()
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
