#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
黄金行情数据获取脚本（GPAFP 静态化改造 · US-002）

生成 frontend/src/data/gold-prices.json，包含：
  - internationalDaily:    国际金价 XAU/USD 日线（2004-06-11 至今）
                           来源: FeziweMelvin/XAUUSD-Gold-Price 的 XAU_1d_data.csv
  - internationalMonthly:  国际金价月度（伦敦定盘价，1970-01 至 2004-05）
                           来源: datahub.io core/gold-prices monthly.csv
  - domestic:              国内金价 上海黄金交易所 Au99.99 日线（2004-01-02 至今）
                           来源: tushare sge_daily 接口（token 从仓库根 .env 读）

用法: python3 scripts/fetch_gold_data.py
只使用 Python 标准库；幂等（重复运行覆盖输出）。
"""
import csv
import io
import json
import os
import ssl
import sys
import urllib.request
from datetime import date, datetime, timedelta

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PATH = os.path.join(REPO_ROOT, "frontend", "src", "data", "gold-prices.json")
ENV_PATH = os.path.join(REPO_ROOT, ".env")

XAU_DAILY_URL = (
    "https://raw.githubusercontent.com/FeziweMelvin/XAUUSD-Gold-Price/"
    "main/XAU_1d_data.csv"
)
MONTHLY_URL = "https://datahub.io/core/gold-prices/r/monthly.csv"
TUSHARE_URL = "http://api.tushare.pro"
UA = {"User-Agent": "Mozilla/5.0 gold-static-fetcher/1.0"}


def make_ssl_context():
    """优先用 certifi 的 CA 证书；不可用则退回系统默认；绝不禁用证书校验。"""
    try:
        import certifi  # python.org 安装包自带

        ctx = ssl.create_default_context(cafile=certifi.where())
        print("  （SSL: 使用 certifi CA 证书）")
        return ctx
    except Exception:
        return ssl.create_default_context()


def http_get(url: str, timeout: int = 60) -> str:
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=make_ssl_context()) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except ssl.SSLError as exc:
        print(
            "错误：HTTPS 证书校验失败。请在 macOS 上执行 "
            "\"Install Certificates.command\"（Python 安装目录内），"
            "或 pip install certifi 后重试。",
            file=sys.stderr,
        )
        raise SystemExit(1) from exc


def fetch_international_daily():
    """下载国际日线 CSV（分号分隔：Date;Open;High;Low;Close;Volume），
    日期形如 '2004.06.11 00:00'，统一转成 YYYY-MM-DD。
    若现有 gold-prices.json 中有晚于该 CSV 尾端的数据（由 CI 从 Yahoo 补全），
    一并保留合并，避免本地重跑把新数据覆盖回旧状态。"""
    text = http_get(XAU_DAILY_URL)
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.split(";")
        if len(parts) < 6 or not parts[0].startswith(("19", "20")):
            continue
        try:
            d = datetime.strptime(parts[0].split()[0], "%Y.%m.%d").date()
            o, h, low, c = (float(x) for x in parts[1:5])
        except (ValueError, IndexError):
            continue
        if c <= 0:
            continue
        rows.append(
            {"date": d.isoformat(), "open": o, "high": h, "low": low, "close": c}
        )
    rows.sort(key=lambda r: r["date"])
    dedup = {}
    for r in rows:
        dedup[r["date"]] = r
    csv_max = max(dedup) if dedup else "2000-01-01"
    # 合并现有 JSON 中晚于 CSV 尾端的日线（CI 用 Yahoo 补全的数据）
    if os.path.exists(OUT_PATH):
        try:
            with open(OUT_PATH, encoding="utf-8") as f:
                existing = json.load(f).get("internationalDaily", [])
            for r in existing:
                if r.get("date", "") > csv_max:
                    dedup[r["date"]] = r
        except (json.JSONDecodeError, OSError):
            pass
    return [dedup[k] for k in sorted(dedup)]


def fetch_international_monthly():
    """下载 datahub 月度伦敦定盘价，截取 1970-01 至 2004-05。"""
    text = http_get(MONTHLY_URL)
    rows = []
    reader = csv.reader(io.StringIO(text))
    header = next(reader, None)
    if not header:
        raise RuntimeError("月度数据源返回为空")
    for line in reader:
        if len(line) < 2:
            continue
        raw_date, raw_price = line[0].strip(), line[1].strip()
        try:
            y, m = (int(x) for x in raw_date.split("-")[:2])
            price = float(raw_price)
        except (ValueError, IndexError):
            continue
        d = date(y, m, 1)
        if date(1970, 1, 1) <= d < date(2004, 6, 1) and price > 0:
            rows.append({"date": d.isoformat(), "price": price})
    rows.sort(key=lambda r: r["date"])
    return rows


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


def tushare_post(token: str, api_name: str, params: dict, fields: str = "") -> dict:
    body = json.dumps(
        {"api_name": api_name, "token": token, "params": params, "fields": fields}
    ).encode("utf-8")
    req = urllib.request.Request(
        TUSHARE_URL,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_domestic(token: str):
    """tushare sge_daily（Au99.99），按日期窗口向前分页拉全量，直到 2004-01-02。
    fields 顺序: ts_code, trade_date, close, open, high, low, price_avg, ...
    """
    rows = {}
    end = date.today()
    floor = date(2004, 1, 1)
    max_iter = 30
    it = 0
    while end >= floor and it < max_iter:
        it += 1
        start = max(floor, end - timedelta(days=365 * 3))
        resp = tushare_post(
            token,
            "sge_daily",
            {
                "ts_code": "Au99.99",
                "start_date": start.strftime("%Y%m%d"),
                "end_date": end.strftime("%Y%m%d"),
            },
        )
        if resp.get("code") != 0:
            print(f"错误：tushare sge_daily 返回 code={resp.get('code')} {resp.get('msg')}",
                  file=sys.stderr)
            sys.exit(1)
        data = resp.get("data") or {"fields": [], "items": []}
        fields = data["fields"]
        idx = {name: i for i, name in enumerate(fields)}
        win_earliest = None
        for item in data["items"]:
            try:
                d = datetime.strptime(item[idx["trade_date"]], "%Y%m%d").date()
                c = float(item[idx["close"]])
                o = float(item[idx["open"]])
                h = float(item[idx["high"]])
                low = float(item[idx["low"]])
            except (ValueError, IndexError, KeyError):
                continue
            if c > 0:
                rows[d.isoformat()] = {
                    "date": d.isoformat(), "open": o, "high": h, "low": low, "close": c,
                }
            win_earliest = d if win_earliest is None or d < win_earliest else win_earliest
        print(f"  窗口 {start} ~ {end}: 返回 {len(data['items'])} 行，"
              f"本窗口最早 {win_earliest}")
        if not data["items"]:
            break  # 窗口内无数据：已越过数据起点
        end = start - timedelta(days=1)
    return [rows[k] for k in sorted(rows)]


def main():
    print("1/3 下载国际日线（XAU/USD, 2004 至今）...")
    daily = fetch_international_daily()
    print(f"   获取 {len(daily)} 行，首条 {daily[0]['date'] if daily else '-'}，"
          f"末条 {daily[-1]['date'] if daily else '-'}")

    print("2/3 下载国际月度（伦敦定盘价, 1970-2004）...")
    monthly = fetch_international_monthly()
    print(f"   获取 {len(monthly)} 行，首条 {monthly[0]['date'] if monthly else '-'}，"
          f"末条 {monthly[-1]['date'] if monthly else '-'}")

    print("3/3 拉取国内金价（上海黄金交易所 Au99.99）...")
    domestic = fetch_domestic(read_token())
    print(f"   获取 {len(domestic)} 行，首条 {domestic[0]['date'] if domestic else '-'}，"
          f"末条 {domestic[-1]['date'] if domestic else '-'}")

    payload = {
        "internationalDaily": daily,
        "internationalMonthly": monthly,
        "domestic": domestic,
    }
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    size_kb = os.path.getsize(OUT_PATH) / 1024
    print(f"已写入 {OUT_PATH}（{size_kb:.0f} KB）")

    # 覆盖范围自检
    checks = {
        "internationalDaily ≥ 5000 行": len(daily) >= 5000,
        "internationalDaily 首条 ≤ 2004-07-01": bool(daily) and daily[0]["date"] <= "2004-07-01",
        "internationalMonthly 首条 ≤ 1970-02": bool(monthly) and monthly[0]["date"] <= "1970-02",
        "internationalMonthly 末条 ≥ 2004-04": bool(monthly) and monthly[-1]["date"] >= "2004-04",
        "domestic ≥ 4000 行": len(domestic) >= 4000,
        "domestic 首条 ≤ 2004-01-15": bool(domestic) and domestic[0]["date"] <= "2004-01-15",
    }
    print("\n覆盖范围自检：")
    all_ok = True
    for name, ok in checks.items():
        print(f"  [{'✓' if ok else '✗'}] {name}")
        all_ok = all_ok and ok
    print("全部通过 ✅" if all_ok else "存在未通过项 ⚠️")
    sys.exit(0 if all_ok else 2)


if __name__ == "__main__":
    main()
