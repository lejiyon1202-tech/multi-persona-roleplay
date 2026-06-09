"""
통합 e2e — 실 서버 UI 검증 (기안84 담당)
- CSP 콘솔 에러 0건 확인
- 3테마 / 반응형 3브레이크포인트
- 시나리오 선택 → 캐릭터 선택 UI 흐름
- inline style/script 없음 확인
"""
from playwright.sync_api import sync_playwright
import os

BASE = "http://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"

results = []
console_errors = []

def ok(msg):   results.append(f"PASS {msg}"); print(f"PASS {msg}")
def fail(msg): results.append(f"FAIL {msg}"); print(f"FAIL {msg}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context()
    page = ctx.new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: console_errors.append(str(e)))

    # ── 1. index.html (실 서버) ──────────────────────────────────
    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto(f"{BASE}/", timeout=15000)
    page.wait_for_load_state("networkidle")

    # API 데이터 로드 확인 (시나리오 카드)
    page.wait_for_timeout(1500)
    cards = page.locator(".scenario-card").count()
    ok(f"시나리오 카드 로드: {cards}개") if cards > 0 else fail(f"시나리오 카드 없음 (API 연동 실패)")

    # inline style/script 0건
    inline_style  = page.evaluate("document.querySelectorAll('style:not([data-vite])'  ).length")
    inline_script = page.evaluate("document.querySelectorAll('script:not([src])'       ).length")
    ok(f"inline <style> 0건: {inline_style}건")  if inline_style  == 0 else fail(f"inline style {inline_style}건 잔존")
    ok(f"inline <script> 0건: {inline_script}건") if inline_script == 0 else fail(f"inline script {inline_script}건 잔존")

    page.screenshot(path=os.path.join(OUT, "e2e_int_index.png"))
    ok("index.html 실 서버 스크린샷")

    # 3테마 전환
    page.click("[data-theme-target='dark']")
    page.wait_for_timeout(400)
    theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
    ok(f"다크 테마 전환: {theme}") if theme == "dark" else fail(f"다크 테마 실패: {theme}")
    page.screenshot(path=os.path.join(OUT, "e2e_int_index_dark.png"))
    page.click("[data-theme-target='light']")

    # ── 2. character-select.html (실 서버) ───────────────────────
    # 첫 번째 시나리오 클릭 → 캐릭터 선택 화면으로 이동
    if cards > 0:
        first_card = page.locator(".scenario-card").first
        scenario_id = first_card.get_attribute("data-scenario-id")
        page.goto(f"{BASE}/character-select.html?scenario_id={scenario_id}", timeout=15000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)

        char_cards = page.locator(".char-card").count()
        ok(f"캐릭터 카드 로드: {char_cards}개") if char_cards > 0 else fail(f"캐릭터 카드 없음")

        selectable = page.locator(".char-card.selectable").count()
        context_only = page.locator(".char-card.context-only").count()
        ok(f"선택 가능 {selectable}개 / 비활성 {context_only}개") if selectable > 0 else fail("선택 가능 캐릭터 없음")

        page.screenshot(path=os.path.join(OUT, "e2e_int_charselect.png"))
        ok("character-select.html 실 서버 스크린샷")

    # ── 3. 반응형 3브레이크포인트 ────────────────────────────────
    for w, h, label in [(768, 1024, "태블릿"), (375, 812, "모바일")]:
        page.set_viewport_size({"width": w, "height": h})
        page.wait_for_timeout(300)
        page.screenshot(path=os.path.join(OUT, f"e2e_int_charselect_{label}.png"))
        ok(f"character-select.html {label}({w}px) 스크린샷")
    page.set_viewport_size({"width": 1280, "height": 720})

    # ── 4. CSP 헤더 확인 ─────────────────────────────────────────
    resp = page.goto(f"{BASE}/", timeout=15000)
    csp = resp.headers.get("content-security-policy", "")
    ok(f"CSP 헤더 존재: {csp[:80]}...") if csp else fail("CSP 헤더 없음")
    if csp:
        has_unsafe = "unsafe-inline" in csp
        ok("CSP unsafe-inline 0건") if not has_unsafe else fail(f"CSP unsafe-inline 잔존: {csp}")

    # ── 5. 콘솔 에러 종합 ────────────────────────────────────────
    # API 정상 호출 후 CSP 관련 에러 없는지 확인
    page.goto(f"{BASE}/", timeout=15000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    csp_errors = [e for e in console_errors if "Content Security Policy" in e or "unsafe-inline" in e.lower()]
    ok(f"CSP 차단 에러 0건: {len(csp_errors)}건") if len(csp_errors) == 0 else fail(f"CSP 차단 에러 {len(csp_errors)}건: {csp_errors}")

    total_errors = len(console_errors)
    ok(f"총 콘솔 에러 0건: {total_errors}건") if total_errors == 0 else fail(f"콘솔 에러 {total_errors}건: {console_errors[:5]}")

    browser.close()

# ── 결과 ──────────────────────────────────────────────────────────
print("\n" + "="*55)
print("통합 e2e (기안84 UI 검증) 결과")
print("="*55)
pass_cnt = sum(1 for r in results if r.startswith("PASS"))
fail_cnt = sum(1 for r in results if r.startswith("FAIL"))
print(f"PASS: {pass_cnt} / FAIL: {fail_cnt}")
for r in results: print(r)
