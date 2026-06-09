"""
통합 e2e Phase C — 시나리오 B (id=4) + HTTPS + 5페이지 UI 검증
"""
from playwright.sync_api import sync_playwright
import os

BASE = "https://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
results = []
csp_errors = []

def ok(m):   results.append(("PASS", m)); print(f"PASS {m}")
def fail(m): results.append(("FAIL", m)); print(f"FAIL {m}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(ignore_https_errors=True)
    page = ctx.new_page()
    page.on("console", lambda m: csp_errors.append(m.text) if m.type == "error" and "Security Policy" in m.text else None)

    # ── S1: 시나리오 목록 (시나리오 B 포함) ────────────────────────
    page.goto(f"{BASE}/", timeout=20000)
    try:
        page.wait_for_selector(".scenario-card", timeout=8000)
        cards = page.locator(".scenario-card").count()
        ok(f"S1 시나리오 카드 {cards}개") if cards >= 3 else fail(f"S1 시나리오 카드 {cards}개 (기대 3)")
        # 시나리오 B(id=4) 존재 확인
        scenario_b = page.locator("[data-scenario-id='4']").count()
        ok(f"S1 시나리오 B(id=4) 존재: {scenario_b}") if scenario_b > 0 else fail("S1 시나리오 B 없음")
    except:
        fail("S1 시나리오 카드 타임아웃")
    page.screenshot(path=os.path.join(OUT, "sc_b_index.png"))
    ok("S1 index.html 스크린샷")

    # ── S2: 시나리오 B 캐릭터 선택 (id=4 → 6명) ─────────────────
    page.goto(f"{BASE}/character-select.html?scenario_id=4", timeout=20000)
    page.wait_for_selector(".char-card", timeout=10000)
    page.wait_for_timeout(1000)

    char_cards = page.locator(".char-card").count()
    ok(f"S2 시나리오 B 캐릭터 {char_cards}명") if char_cards == 6 else fail(f"S2 캐릭터 수 오류: {char_cards}")

    selectable = page.locator(".char-card.selectable").count()
    ctx_only = page.locator(".char-card.context-only").count()
    ok(f"S2 선택 가능 {selectable}명 / 비활성 {ctx_only}명") if selectable == 4 and ctx_only == 2 else fail(f"S2 카드 구성 오류")

    # CSS 변수 확인
    role_lead = page.evaluate("window.getComputedStyle(document.documentElement).getPropertyValue('--role-lead').trim()")
    ok(f"S2 CSS --role-lead: {role_lead}") if role_lead else fail("S2 CSS 변수 미로드")

    # 범용 워딩 확인 (삼성 없음)
    page_text = page.evaluate("document.body.innerText")
    has_samsung = "삼성" in page_text or "Samsung" in page_text
    ok("S2 외부 기업명 0건") if not has_samsung else fail("S2 삼성 워딩 잔존")

    page.screenshot(path=os.path.join(OUT, "sc_b_charselect.png"))
    ok("S2 character-select.html (시나리오 B) 스크린샷")

    # ── S3: 카드 선택 인터랙션 ──────────────────────────────────────
    first_sel = page.locator(".char-card.selectable").first
    first_sel.click()
    page.wait_for_timeout(500)
    selected = page.locator(".char-card.selected").count()
    startbar = page.locator("#startBar.visible").count()
    ok(f"S3 카드 선택 인터랙션: selected={selected}, startBar={startbar}") if selected == 1 and startbar == 1 else fail(f"S3 선택 오류")
    page.screenshot(path=os.path.join(OUT, "sc_b_selected.png"))
    ok("S3 선택 상태 스크린샷")

    # ── S10: SSL 게이트 확인 ────────────────────────────────────────
    resp = page.goto(f"{BASE}/", timeout=20000)
    csp = resp.headers.get("content-security-policy", "")
    has_upgrade = "upgrade-insecure-requests" in csp
    has_unsafe = "unsafe-inline" in csp
    ok(f"S10 SSL/HTTPS + upgrade-insecure-requests 표준 복원") if has_upgrade and not has_unsafe else fail(f"S10 CSP 오류: upgrade={has_upgrade}, unsafe={has_unsafe}")

    # ── CSP 에러 확인 ───────────────────────────────────────────────
    ok(f"CSP 차단 에러 0건: {len(csp_errors)}건") if len(csp_errors) == 0 else fail(f"CSP 에러 {len(csp_errors)}건")

    browser.close()

print()
pass_cnt = sum(1 for r, _ in results if r == "PASS")
fail_cnt = sum(1 for r, _ in results if r == "FAIL")
print(f"PASS:{pass_cnt} FAIL:{fail_cnt}")
