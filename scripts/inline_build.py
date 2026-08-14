#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
构建后处理：把 frontend/dist/index.html 外部引用的 JS/CSS 内联进 HTML。

背景：外链 <script type="module" src=...> 在 file:// 协议下会被浏览器 CORS 策略拦截，
导致双击 index.html 白屏。内联后产物为自包含单文件，双击即可打开，也兼容任何静态托管。

用法: python3 scripts/inline_build.py   （vite build 之后执行；幂等）
"""
import os
import re
import sys

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIST_HTML = os.path.join(REPO_ROOT, "frontend", "dist", "index.html")

if not os.path.exists(DIST_HTML):
    print(f"错误：未找到 {DIST_HTML}，请先运行 npm run build", file=sys.stderr)
    sys.exit(1)

html = open(DIST_HTML, encoding="utf-8").read()
dist_dir = os.path.dirname(DIST_HTML)


def inline_asset(match: re.Match) -> str:
    tag = match.group(0)
    src = match.group("src")
    # 跳过外部协议地址（理论上不存在）
    if src.startswith(("http://", "https://", "data:")):
        return tag
    asset_path = os.path.normpath(os.path.join(dist_dir, src))
    if not os.path.exists(asset_path):
        print(f"警告：内联目标不存在 {src}，跳过", file=sys.stderr)
        return tag
    content = open(asset_path, encoding="utf-8").read()
    # JS: 去 crossorigin 属性，内联为 <script type="module">
    # CSS: <link rel="stylesheet"> → <style>
    if tag.startswith("<script"):
        return f'<script type="module">\n{content}\n</script>'
    return f"<style>\n{content}\n</style>"


changed = 0
html, n_js = re.subn(
    r'<script[^>]*\bsrc="(?P<src>\./[^"]+)"[^>]*>\s*</script>',
    inline_asset,
    html,
)
changed += n_js
html, n_css = re.subn(
    r'<link[^>]*rel="stylesheet"[^>]*\bhref="(?P<src>\./[^"]+)"[^>]*/?>',
    inline_asset,
    html,
)
changed += n_css

open(DIST_HTML, "w", encoding="utf-8").write(html)
size_kb = os.path.getsize(DIST_HTML) / 1024
print(f"内联完成：替换 {n_js} 个脚本、{n_css} 个样式表，index.html 现为 {size_kb:.0f} KB 单文件。")

# 自检：不应再有外链脚本/样式
leftover = re.findall(r'<(?:script[^>]*\bsrc=|link[^>]*rel="stylesheet"[^>]*\bhref=)"\./', html)
if leftover:
    print("警告：仍有未内联的外链资源", file=sys.stderr)
    sys.exit(1)
print("自检通过：无外链 JS/CSS，双击 index.html 即可打开。")
