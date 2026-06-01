from playwright.sync_api import sync_playwright
import os

BASE = "http://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
console_errors = []
results = []

def ok(m):   results.append(("PASS", m)); print(f"PASS {m}")
def fail(m): results.append(("FAIL", m)); print(f"FAIL {m}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_context().new_page()
    page.on("console", lambda m: console_errors.append(m.text) if m.type == "error" else None)

    # ── index.html 로드 ──────────────────────────────────────────
    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto(f"{BASE}/", timeout=15000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2500)

    # 시나리오 카드 로드 (API 연동)
    cards = page.locator(".scenario-card").count()
    ok(f"시나리오 카드 {cards}개 (API 연동)") if cards > 0 else fail("시나리오 카드 없음")

    # 테마 버튼 없음 확인
    theme_btns = page.locator("[data-theme-target]").count()
    ok(f"테마 버튼 제거: {theme_btns}개") if theme_btns == 0 else fail(f"테마 버튼 잔존: {theme_btns}개")

    # CSP 헤더 확인
    resp = page.goto(f"{BASE}/", timeout=15000)
    csp = resp.headers.get("content-security-policy", "")
    has_cdn    = "cdn.jsdelivr.net" in csp
    has_unsafe = "unsafe-inline" in csp
    ok(f"CSP cdn.jsdelivr.net whitelist: {has_cdn}") if has_cdn else fail("CSP cdn.jsdelivr.net 없음")
    ok(f"CSP unsafe-inline 0건") if not has_unsafe else fail(f"CSP unsafe-inline 잔존")

    # 페이지 다시 로드하고 스타일 적용 확인
    page.goto(f"{BASE}/", timeout=15000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    # Pretendard 폰트 로드 확인
    font_family = page.evaluate("getComputedStyle(document.body).fontFamily")
    ok(f"Pretendard 폰트 로드: {font_family[:30]}") if "Pretendard" in font_family else fail(f"폰트 미로드: {font_family[:50]}")

    # inline style 없음 확인
    inline_count = page.evaluate("Array.from(document.querySelectorAll('[style]')).length")
    ok(f"inline style 속성 0건: {inline_count}건") if inline_count == 0 else fail(f"inline style {inline_count}건 잔존")

    page.screenshot(path=os.path.join(OUT, "e2e_final_index.png"))
    ok("index.html 최종 스크린샷")

    # ── character-select.html ─────────────────────────────────────
    page.goto(f"{BASE}/character-select.html?scenario_id=1", timeout=15000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)
    char_cards = page.locator(".char-card").count()
    ok(f"캐릭터 카드 {char_cards}개") if char_cards > 0 else fail("캐릭터 카드 없음")
    page.screenshot(path=os.path.join(OUT, "e2e_final_charselect.png"))
    ok("character-select.html 최종 스크린샷")

    # ── CSP 차단 에러 확인 ────────────────────────────────────────
    csp_errs = [e for e in console_errors if "Content Security Policy" in e or "unsafe-inline" in e.lower()]
    ok(f"CSP 차단 에러 0건: {len(csp_errs)}건") if len(csp_errs) == 0 else fail(f"CSP 에러 {len(csp_errs)}건: {str(csp_errs[:1])[:100]}")

    total_err = len([e for e in console_errors if "ERR_" in e or "Failed to load" in e or "SyntaxError" in e])
    ok(f"치명 콘솔 에러 0건: {total_err}건") if total_err == 0 else fail(f"치명 에러 {total_err}건")

    browser.close()

print()
pass_cnt = sum(1 for r, _ in results if r == "PASS")
fail_cnt = sum(1 for r, _ in results if r == "FAIL")
print(f"PASS:{pass_cnt} FAIL:{fail_cnt}")
