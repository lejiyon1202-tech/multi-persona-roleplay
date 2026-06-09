"""
Phase C v3 2단계 흐름 체감 검증
1. character-select.html (학습자 역할 선택)
2. partner-select.html (대화 상대 선택)
"""
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

    # ── 1. character-select.html (Step 1) ────────────────────────
    page.goto(f"{BASE}/character-select.html?scenario_id=4", timeout=20000)
    page.wait_for_selector(".char-card", timeout=10000)
    page.wait_for_timeout(1000)

    # 제목 확인 (v3: 연기 캐릭터 선택)
    title = page.locator("h1.scenario-title").inner_text()
    ok(f"Step 1 제목: {title[:20]}") if "연기" in title or "선택" in title else fail(f"Step 1 제목 오류: {title}")

    # step indicator 확인
    step_active = page.locator(".step.active").inner_text()
    ok(f"Step 인디케이터 활성: {step_active}") if "1단계" in step_active or "역할" in step_active else fail(f"Step 인디케이터 오류")

    # 모든 캐릭터 selectable 확인 (v3: 모두 선택 가능)
    cards = page.locator(".char-card.selectable").count()
    ok(f"Step 1 모든 카드 selectable: {cards}개") if cards == 6 else fail(f"Step 1 카드 수 오류: {cards}")

    page.screenshot(path=os.path.join(OUT, "v3_step1.png"), full_page=False)
    ok("Step 1 스크린샷")

    # ── 2. 첫 카드 클릭 → 모달 확인 ─────────────────────────────
    first_card = page.locator(".char-card.selectable").first
    char_id = first_card.get_attribute("data-char-id")
    first_card.click()
    page.wait_for_timeout(500)

    modal = page.locator("#charModalOverlay:not(.hidden)").count()
    ok(f"Step 1 모달 팝업: {modal}개") if modal == 1 else fail("Step 1 모달 팝업 실패")

    modal_name = page.locator("#modalName").inner_text()
    ok(f"Step 1 모달 캐릭터 이름: {modal_name[:15]}") if modal_name else fail("모달 이름 없음")

    # "이 역할 맡기" 버튼 확인
    select_btn = page.locator("#modalSelectBtn").count()
    ok(f"이 역할 맡기 버튼: {select_btn}개") if select_btn > 0 else fail("이 역할 맡기 버튼 없음")

    page.screenshot(path=os.path.join(OUT, "v3_step1_modal.png"), full_page=False)
    ok("Step 1 모달 스크린샷")

    # ── 3. "이 역할 맡기" 클릭 → Step 2 이동 ─────────────────────
    page.locator("#modalSelectBtn").click()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(1500)

    # partner-select.html 확인
    url = page.url
    ok(f"Step 2 URL: partner-select") if "partner-select" in url else fail(f"URL 오류: {url}")

    page.wait_for_selector(".partner-card", timeout=8000)
    partner_cards = page.locator(".partner-card:not(.is-learner)").count()
    learner_card  = page.locator(".partner-card.is-learner").count()
    ok(f"Step 2 파트너 후보: {partner_cards}명 / 내 역할 표시: {learner_card}명")

    page.screenshot(path=os.path.join(OUT, "v3_step2.png"), full_page=False)
    ok("Step 2 스크린샷")

    # ── 4. 다중 선택 테스트 ──────────────────────────────────────
    selectable_cards = page.locator(".partner-card:not(.is-learner)").all()
    if len(selectable_cards) >= 2:
        selectable_cards[0].click()
        page.wait_for_timeout(200)
        selectable_cards[1].click()
        page.wait_for_timeout(300)

        selected = page.locator(".partner-card.selected").count()
        ok(f"다중 선택 {selected}명") if selected == 2 else fail(f"다중 선택 오류: {selected}")

        # 하단 바 표시 확인
        bar_visible = page.locator("#partnerBar:not(.hidden)").count()
        ok(f"하단 선택 바 표시: {bar_visible}") if bar_visible > 0 else fail("하단 바 미표시")

        page.screenshot(path=os.path.join(OUT, "v3_step2_selected.png"), full_page=False)
        ok("Step 2 다중 선택 스크린샷")

    browser.close()

print()
pass_cnt = sum(1 for r, _ in results if r == "PASS")
fail_cnt = sum(1 for r, _ in results if r == "FAIL")
print(f"PASS:{pass_cnt} FAIL:{fail_cnt}")
