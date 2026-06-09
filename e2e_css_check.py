"""
라이브 5페이지 CSS 적용 점검
"""
from playwright.sync_api import sync_playwright
import os

BASE = "http://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
results = []

def ok(m):   results.append(("PASS", m)); print(f"PASS {m}")
def fail(m): results.append(("FAIL", m)); print(f"FAIL {m}")

def check_css_applied(page, selector, prop, expected_not=""):
    try:
        val = page.evaluate(f"getComputedStyle(document.querySelector('{selector}')).{prop}")
        if expected_not and expected_not in val:
            return False, val
        return True, val
    except:
        return False, "element_not_found"

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context()
    page = ctx.new_page()

    # ── 1. index.html ──────────────────────────────────────────────
    page.goto(f"{BASE}/", timeout=20000)
    try:
        page.wait_for_selector(".scenario-card", timeout=8000)
    except:
        pass
    page.wait_for_timeout(1000)

    # page-header background 확인 (design-system 적용 여부)
    ok_flag, bg = check_css_applied(page, "body", "backgroundColor", "rgba(0, 0, 0, 0)")
    body_bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    ok(f"index.html body bg: {body_bg}") if body_bg != "rgba(0, 0, 0, 0)" else fail(f"index.html body bg 미적용: {body_bg}")

    cards = page.locator(".scenario-card").count()
    ok(f"index.html 시나리오 카드: {cards}개") if cards > 0 else fail("index.html 카드 없음")
    page.screenshot(path=os.path.join(OUT, "css_check_index.png"), full_page=False)
    ok("index.html 스크린샷")

    # ── 2. character-select.html ─────────────────────────────────────
    page.goto(f"{BASE}/character-select.html?scenario_id=1", timeout=20000)
    page.wait_for_selector(".char-card", timeout=8000)
    page.wait_for_timeout(800)

    body_bg2 = page.evaluate("getComputedStyle(document.body).backgroundColor")
    ok(f"character-select body bg: {body_bg2}") if body_bg2 != "rgba(0, 0, 0, 0)" else fail(f"character-select body bg 미적용: {body_bg2}")

    # design-system.css 적용 확인: --role-lead 변수
    role_lead = page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--role-lead').trim()")
    ok(f"--role-lead CSS 변수: '{role_lead}'") if role_lead else fail("--role-lead 변수 미로드")

    char_cards = page.locator(".char-card").count()
    ok(f"character-select 카드: {char_cards}개") if char_cards >= 6 else fail(f"character-select 카드: {char_cards}개")
    page.screenshot(path=os.path.join(OUT, "css_check_charselect.png"), full_page=False)
    ok("character-select.html 스크린샷")

    # ── 3. chat.html ─────────────────────────────────────────────────
    page.goto(f"{BASE}/chat.html?character=9", timeout=20000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    chat_header = page.locator(".chat-header").count()
    ok(f"chat.html 헤더: {chat_header}개") if chat_header > 0 else fail("chat.html 헤더 없음")
    chat_bg = page.evaluate("getComputedStyle(document.body).backgroundColor")
    ok(f"chat.html body bg: {chat_bg}") if chat_bg != "rgba(0, 0, 0, 0)" else fail(f"chat.html body bg 미적용")
    page.screenshot(path=os.path.join(OUT, "css_check_chat.png"), full_page=False)
    ok("chat.html 스크린샷")

    # ── 4. report.html ───────────────────────────────────────────────
    page.goto(f"{BASE}/report.html?session_id=1", timeout=20000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1000)

    tabs = page.locator(".report-tab").count()
    ok(f"report.html 탭: {tabs}개") if tabs == 2 else fail(f"report.html 탭 오류: {tabs}")
    page.screenshot(path=os.path.join(OUT, "css_check_report.png"), full_page=False)
    ok("report.html 스크린샷")

    # ── 5. admin.html ───────────────────────────────────────────────
    page.goto(f"{BASE}/admin.html", timeout=20000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    auth_overlay = page.locator("#authOverlay").count()
    ok(f"admin.html 인증 오버레이: {auth_overlay}개") if auth_overlay > 0 else fail("admin.html 인증 없음")
    page.screenshot(path=os.path.join(OUT, "css_check_admin.png"), full_page=False)
    ok("admin.html 스크린샷")

    browser.close()

print()
pass_cnt = sum(1 for r, _ in results if r == "PASS")
fail_cnt = sum(1 for r, _ in results if r == "FAIL")
print(f"PASS:{pass_cnt} FAIL:{fail_cnt}")
