from playwright.sync_api import sync_playwright
import os

BASE = "https://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
results = []

def ok(m):   results.append(("PASS", m)); print(f"PASS {m}")
def fail(m): results.append(("FAIL", m)); print(f"FAIL {m}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()

    css_loaded = []
    csp_errors = []
    page.on("response", lambda r: css_loaded.append((r.status, r.url)) if ".css" in r.url else None)
    page.on("console", lambda m: csp_errors.append(m.text) if m.type == "error" and ("Security Policy" in m.text or "ERR_" in m.text) else None)

    # ── character-select.html (HTTPS) ──────────────────────────────
    page.goto(f"{BASE}/character-select.html?scenario_id=1", timeout=20000)
    page.wait_for_selector(".char-card", timeout=10000)
    page.wait_for_timeout(2000)

    # CSS 로드 확인
    for status, url in css_loaded:
        ok(f"CSS {status}: {url.split('/')[-1]}") if status == 200 else fail(f"CSS FAIL {status}: {url}")

    # CSS 변수 확인
    role_lead = page.evaluate("window.getComputedStyle(document.documentElement).getPropertyValue('--role-lead').trim()")
    bg = page.evaluate("window.getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()")
    body_bg = page.evaluate("window.getComputedStyle(document.body).backgroundColor")
    ok(f"--role-lead: {role_lead}") if role_lead == "#134e4a" else fail(f"--role-lead 오류: '{role_lead}'")
    ok(f"--bg: {bg}") if bg == "#f0f2f8" else fail(f"--bg 오류: '{bg}'")
    ok(f"body bg: {body_bg}") if body_bg != "rgba(0, 0, 0, 0)" else fail(f"body bg 미적용: {body_bg}")

    # 카드 확인
    char_cards = page.locator(".char-card").count()
    ok(f"캐릭터 카드 {char_cards}개") if char_cards >= 6 else fail(f"카드 수 오류: {char_cards}")

    page.screenshot(path=os.path.join(OUT, "https_charselect.png"), full_page=False)
    ok("character-select.html HTTPS 스크린샷")

    # ── index.html (HTTPS) ──────────────────────────────────────────
    page.goto(f"{BASE}/", timeout=20000)
    try:
        page.wait_for_selector(".scenario-card", timeout=8000)
        scenarios = page.locator(".scenario-card").count()
        ok(f"시나리오 카드 {scenarios}개") if scenarios > 0 else fail("시나리오 카드 없음")
    except:
        fail("시나리오 카드 타임아웃 (JS 렌더링 지연)")
    page.screenshot(path=os.path.join(OUT, "https_index.png"), full_page=False)
    ok("index.html HTTPS 스크린샷")

    # ── chat.html (HTTPS) ────────────────────────────────────────────
    page.goto(f"{BASE}/chat.html?character=9", timeout=20000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)
    chat_bg = page.evaluate("window.getComputedStyle(document.body).backgroundColor")
    ok(f"chat.html body bg: {chat_bg}") if chat_bg != "rgba(0, 0, 0, 0)" else fail("chat.html CSS 미적용")
    page.screenshot(path=os.path.join(OUT, "https_chat.png"), full_page=False)
    ok("chat.html HTTPS 스크린샷")

    # ── report.html (HTTPS) ──────────────────────────────────────────
    page.goto(f"{BASE}/report.html?session_id=1", timeout=20000)
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)
    tabs = page.locator(".report-tab").count()
    ok(f"report.html 탭 {tabs}개") if tabs == 2 else fail(f"report.html 탭 오류: {tabs}")
    page.screenshot(path=os.path.join(OUT, "https_report.png"), full_page=False)
    ok("report.html HTTPS 스크린샷")

    # ── admin.html (HTTPS) ───────────────────────────────────────────
    page.goto(f"{BASE}/admin.html", timeout=20000)
    page.wait_for_load_state("networkidle")
    auth = page.locator("#authOverlay").count()
    ok(f"admin.html 인증 오버레이: {auth}개") if auth > 0 else fail("admin.html 인증 없음")
    page.screenshot(path=os.path.join(OUT, "https_admin.png"), full_page=False)
    ok("admin.html HTTPS 스크린샷")

    # CSP 에러 최종
    ok(f"CSP 에러 0건: {len(csp_errors)}건") if len(csp_errors) == 0 else fail(f"CSP 에러 {len(csp_errors)}건: {csp_errors[:2]}")

    browser.close()

print()
pass_cnt = sum(1 for r, _ in results if r == "PASS")
fail_cnt = sum(1 for r, _ in results if r == "FAIL")
print(f"PASS:{pass_cnt} FAIL:{fail_cnt}")
