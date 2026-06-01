from playwright.sync_api import sync_playwright
import os, sys

FILE = "file:///C:/Users/lejiyon/Desktop/multi-persona-roleplay/public/character-select.html"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"

results = []

def log(msg, ok=True):
    mark = "✅" if ok else "❌"
    results.append(f"{mark} {msg}")
    print(f"{mark} {msg}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context()
    page = ctx.new_page()

    # ── 1. 라이트 테마 데스크톱 (1280x720) ──────────────────────────
    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto(FILE)
    page.wait_for_load_state("networkidle")

    # 카드 6개 존재 확인
    cards = page.locator(".char-card").all()
    log(f"카드 6개 존재: {len(cards)}개", len(cards) == 6)

    # 선택 가능 카드 4개
    sel = page.locator(".char-card.selectable").all()
    log(f"선택 가능 카드 4개: {len(sel)}개", len(sel) == 4)

    # 비활성 카드 2개
    ctx_cards = page.locator(".char-card.context-only").all()
    log(f"비활성(컨텍스트) 카드 2개: {len(ctx_cards)}개", len(ctx_cards) == 2)

    # "컨텍스트" 레이블 존재
    overlay = page.locator(".context-overlay").count()
    log(f"컨텍스트 오버레이 2개: {overlay}개", overlay == 2)

    # 라이트 테마 스크린샷
    page.screenshot(path=os.path.join(OUT, "e2e_light_desktop.png"), full_page=True)
    log("라이트 데스크톱 스크린샷 저장")

    # ── 2. 세피아 테마 ───────────────────────────────────────────────
    page.click("button:has-text('세피아')")
    page.wait_for_timeout(400)
    theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
    log(f"세피아 테마 전환: {theme}", theme == "sepia")
    page.screenshot(path=os.path.join(OUT, "e2e_sepia_desktop.png"), full_page=True)
    log("세피아 테마 스크린샷 저장")

    # ── 3. 다크 테마 ─────────────────────────────────────────────────
    page.click("button:has-text('다크')")
    page.wait_for_timeout(400)
    theme = page.evaluate("document.documentElement.getAttribute('data-theme')")
    log(f"다크 테마 전환: {theme}", theme == "dark")
    page.screenshot(path=os.path.join(OUT, "e2e_dark_desktop.png"), full_page=True)
    log("다크 테마 스크린샷 저장")

    # 다시 라이트로
    page.click("button:has-text('라이트')")

    # ── 4. 카드 선택 인터랙션 ───────────────────────────────────────
    first_sel = page.locator(".char-card.selectable").first
    first_sel.click()
    page.wait_for_timeout(300)

    selected = page.locator(".char-card.selected").count()
    log(f"카드 선택 상태 적용: {selected}개", selected == 1)

    startbar = page.locator("#startBar.visible").count()
    log(f"startBar 팝업 표시: {startbar}개", startbar == 1)
    page.screenshot(path=os.path.join(OUT, "e2e_card_selected.png"), full_page=True)
    log("카드 선택 상태 스크린샷 저장")

    # ── 5. 비활성 카드 클릭 불가 ─────────────────────────────────────
    ctx_card = page.locator(".char-card.context-only").first
    ctx_style = page.evaluate("(el) => getComputedStyle(el).cursor", ctx_card.element_handle())
    log(f"비활성 카드 cursor:not-allowed: {ctx_style}", ctx_style == "not-allowed")

    # ── 6. 키보드 네비게이션 ─────────────────────────────────────────
    # 선택 가능 카드 tabindex=0 확인
    tab_cards = page.locator(".char-card.selectable[tabindex='0']").count()
    log(f"선택 가능 카드 tabindex=0: {tab_cards}개", tab_cards == 4)

    # role=button 확인
    btn_cards = page.locator(".char-card.selectable[role='button']").count()
    log(f"선택 가능 카드 role=button: {btn_cards}개", btn_cards == 4)

    # ── 7. 태블릿 (768x1024) ─────────────────────────────────────────
    page.set_viewport_size({"width": 768, "height": 1024})
    page.wait_for_timeout(300)

    grid_cols = page.evaluate("""
        () => getComputedStyle(document.querySelector('.card-grid'))
              .gridTemplateColumns.split(' ').length
    """)
    log(f"태블릿 2열 그리드: {grid_cols}열", grid_cols == 2)
    page.screenshot(path=os.path.join(OUT, "e2e_tablet_768.png"), full_page=True)
    log("태블릿(768) 스크린샷 저장")

    # ── 8. 모바일 (375x812) ──────────────────────────────────────────
    page.set_viewport_size({"width": 375, "height": 812})
    page.wait_for_timeout(300)

    grid_cols_m = page.evaluate("""
        () => {
            let cols = getComputedStyle(document.querySelector('.card-grid'))
                       .gridTemplateColumns;
            return cols.split(' ').filter(c => c.trim() !== '').length;
        }
    """)
    log(f"모바일 1열 그리드: {grid_cols_m}열", grid_cols_m == 1)
    page.screenshot(path=os.path.join(OUT, "e2e_mobile_375.png"), full_page=True)
    log("모바일(375) 스크린샷 저장")

    # ── 9. 콘솔 에러 체크 ────────────────────────────────────────────
    errors = []
    page.on("console", lambda m: errors.append(m) if m.type == "error" else None)
    page.reload()
    page.wait_for_load_state("networkidle")
    log(f"콘솔 에러 0건: {len(errors)}건", len(errors) == 0)

    browser.close()

# 최종 리포트
print("\n" + "="*50)
print("e2e 테스트 결과 요약")
print("="*50)
pass_cnt = sum(1 for r in results if r.startswith("✅"))
fail_cnt = sum(1 for r in results if r.startswith("❌"))
print(f"PASS: {pass_cnt} / FAIL: {fail_cnt}")
for r in results:
    print(r)

if fail_cnt > 0:
    sys.exit(1)
