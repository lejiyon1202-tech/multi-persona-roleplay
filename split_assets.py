"""
CSS/JS 분리 스크립트
각 HTML 파일에서 <style>/<script> 블록을 외부 파일로 분리
"""
import re, os

BASE = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay\public"

PAGES = [
    ("character-select.html", "character-select"),
    ("index.html",            "scenario-select"),
    ("chat.html",             "chat"),
    ("report.html",           "report"),
    ("admin.html",            "admin"),
]

def extract_and_replace(html_path, page_name):
    with open(html_path, encoding="utf-8") as f:
        content = f.read()

    # ── CSS 추출 ──
    css_match = re.search(r"<style>(.*?)</style>", content, re.DOTALL)
    if css_match:
        css_content = css_match.group(1).strip()
        css_file = f"css/{page_name}.css"
        with open(os.path.join(BASE, css_file), "w", encoding="utf-8") as f:
            f.write(css_content + "\n")
        print(f"  CSS → {css_file} ({len(css_content.splitlines())} lines)")

        # HTML에서 <style> 블록 → <link> 태그로 교체
        link_tag = f'<link rel="stylesheet" href="{css_file}">'
        content = re.sub(r"<style>.*?</style>", link_tag, content, flags=re.DOTALL)
    else:
        print(f"  CSS: 없음")

    # ── JS 추출 ──
    js_match = re.search(r"<script>(.*?)</script>", content, re.DOTALL)
    if js_match:
        js_content = js_match.group(1).strip()
        js_file = f"js/{page_name}.js"
        with open(os.path.join(BASE, js_file), "w", encoding="utf-8") as f:
            f.write(js_content + "\n")
        print(f"  JS  → {js_file} ({len(js_content.splitlines())} lines)")

        # HTML에서 <script> 블록 → <script src> 태그로 교체
        script_tag = f'<script src="{js_file}" defer></script>'
        content = re.sub(r"<script>.*?</script>", script_tag, content, flags=re.DOTALL)
    else:
        print(f"  JS: 없음")

    # 저장
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(content)

    # 라인 수 확인
    lines = content.count("\n") + 1
    print(f"  HTML {os.path.basename(html_path)}: {lines}줄")
    return lines

def main():
    os.makedirs(os.path.join(BASE, "css"), exist_ok=True)
    os.makedirs(os.path.join(BASE, "js"),  exist_ok=True)

    total_violations = 0
    for html_file, page_name in PAGES:
        html_path = os.path.join(BASE, html_file)
        print(f"\n[{html_file}]")
        lines = extract_and_replace(html_path, page_name)
        if lines > 500:
            print(f"  ⚠ 경고: {lines}줄 — 500줄 초과")
            total_violations += 1
        else:
            print(f"  ✓ {lines}줄 — OK")

    print(f"\n완료. 위반 {total_violations}건")

main()
