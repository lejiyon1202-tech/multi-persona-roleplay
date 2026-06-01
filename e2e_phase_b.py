from playwright.sync_api import sync_playwright
import os, sys

BASE = "file:///C:/Users/lejiyon/Desktop/multi-persona-roleplay/public"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"

results = []

def ok(msg):  results.append(f"PASS {msg}"); print(f"PASS {msg}")
def fail(msg): results.append(f"FAIL {msg}"); print(f"FAIL {msg}")

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context()
    page = ctx.new_page()

    # ── 1. index.html ──────────────────────────────────────────────
    page.set_viewport_size({"width": 1280, "height": 720})
    page.goto(f"{BASE}/index.html")
    page.wait_for_load_state("networkidle")

    # 제목 확인
    title = page.locator("h1").inner_text()
    ok(f"index.html 제목 로드: {title[:20]}") if title else fail("index.html 제목 없음")

    # 인라인 onclick 없는지 확인
    onclick_count = page.evaluate("document.querySelectorAll('[onclick]').length")
    ok(f"index.html inline onclick 0건: {onclick_count}건") if onclick_count == 0 else fail(f"index.html inline onclick {onclick_count}건 발견")

    page.screenshot(path=os.path.join(OUT, "e2e_b_index_light.png"))
    ok("index.html 라이트 스크린샷")

    # 3테마 전환
    for theme, label in [("sepia", "세피아"), ("dark", "다크"), ("light", "라이트")]:
        page.click(f"[data-theme-target='{theme}']")
        page.wait_for_timeout(300)
        t = page.evaluate("document.documentElement.getAttribute('data-theme')")
        ok(f"index.html {label} 테마 전환: {t}") if t == theme else fail(f"index.html 테마 전환 실패: {t}")

    page.screenshot(path=os.path.join(OUT, "e2e_b_index_dark.png"))

    # 모바일
    page.set_viewport_size({"width": 375, "height": 812})
    page.wait_for_timeout(200)
    page.screenshot(path=os.path.join(OUT, "e2e_b_index_mobile.png"))
    ok("index.html 모바일 스크린샷")
    page.set_viewport_size({"width": 1280, "height": 720})

    # ── 2. character-select.html (v2) ──────────────────────────────
    page.goto(f"{BASE}/character-select.html")
    page.wait_for_load_state("networkidle")

    onclick_count = page.evaluate("document.querySelectorAll('[onclick]').length")
    ok(f"character-select v2 inline onclick 0건: {onclick_count}건") if onclick_count == 0 else fail(f"character-select v2 inline onclick {onclick_count}건 발견")

    # opacity 0.55 확인
    opacity = page.evaluate("""
        () => {
            const el = document.querySelector('.char-card.context-only');
            return el ? getComputedStyle(el).opacity : null;
        }
    """)
    ok(f"비활성 카드 opacity 0.55: {opacity}") if opacity and float(opacity) >= 0.54 else fail(f"비활성 카드 opacity 오류: {opacity}")

    page.screenshot(path=os.path.join(OUT, "e2e_b_charselect_v2.png"))
    ok("character-select v2 스크린샷")

    # ── 3. chat.html ───────────────────────────────────────────────
    page.goto(f"{BASE}/chat.html?character=3")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)

    onclick_count = page.evaluate("document.querySelectorAll('[onclick]').length")
    ok(f"chat.html inline onclick 0건: {onclick_count}건") if onclick_count == 0 else fail(f"chat.html inline onclick {onclick_count}건 발견")

    # 헤더 확인
    header = page.locator(".chat-header").count()
    ok(f"chat.html 헤더 존재: {header}개") if header > 0 else fail("chat.html 헤더 없음")

    # 입력창 aria-label
    aria = page.locator("[aria-label='메시지 입력']").count()
    ok(f"chat.html 입력창 aria-label: {aria}개") if aria > 0 else fail("chat.html 입력창 aria-label 없음")

    # 전송 버튼 aria-label
    send_aria = page.locator("[aria-label='메시지 전송']").count()
    ok(f"chat.html 전송 버튼 aria-label: {send_aria}개") if send_aria > 0 else fail("chat.html 전송 버튼 aria-label 없음")

    # aria-live 메시지 영역
    live = page.locator("[aria-live='polite']").count()
    ok(f"chat.html aria-live polite: {live}개") if live > 0 else fail("chat.html aria-live 없음")

    page.screenshot(path=os.path.join(OUT, "e2e_b_chat.png"))
    ok("chat.html 스크린샷")

    # 태블릿
    page.set_viewport_size({"width": 768, "height": 1024})
    page.wait_for_timeout(200)
    page.screenshot(path=os.path.join(OUT, "e2e_b_chat_tablet.png"))
    ok("chat.html 태블릿 스크린샷")
    page.set_viewport_size({"width": 1280, "height": 720})

    # ── 4. report.html ─────────────────────────────────────────────
    page.goto(f"{BASE}/report.html?session_id=1")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(800)

    onclick_count = page.evaluate("document.querySelectorAll('[onclick]').length")
    ok(f"report.html inline onclick 0건: {onclick_count}건") if onclick_count == 0 else fail(f"report.html inline onclick {onclick_count}건 발견")

    # 탭 2개 확인
    tabs = page.locator(".report-tab").count()
    ok(f"report.html 탭 2개: {tabs}개") if tabs == 2 else fail(f"report.html 탭 수 오류: {tabs}개")

    # 점수 히어로 로드
    score_num = page.locator("#scoreNum").inner_text()
    ok(f"report.html 점수 표시: {score_num}") if score_num else fail("report.html 점수 없음")

    page.screenshot(path=os.path.join(OUT, "e2e_b_report.png"), full_page=True)
    ok("report.html 스크린샷")

    # 비교 탭 전환
    page.click("[data-tab='compare']")
    page.wait_for_timeout(300)
    page.screenshot(path=os.path.join(OUT, "e2e_b_report_compare.png"), full_page=True)
    ok("report.html 비교 탭 스크린샷")

    # ── 5. admin.html ──────────────────────────────────────────────
    page.goto(f"{BASE}/admin.html")
    page.wait_for_load_state("networkidle")

    onclick_count = page.evaluate("document.querySelectorAll('[onclick]').length")
    ok(f"admin.html inline onclick 0건: {onclick_count}건") if onclick_count == 0 else fail(f"admin.html inline onclick {onclick_count}건 발견")

    # 인증 오버레이 표시 확인
    auth = page.locator("#authOverlay").count()
    ok(f"admin.html 인증 오버레이 표시: {auth}개") if auth > 0 else fail("admin.html 인증 오버레이 없음")

    # 비밀번호 입력창
    pwd = page.locator("input[type='password']").count()
    ok(f"admin.html 토큰 입력창: {pwd}개") if pwd > 0 else fail("admin.html 토큰 입력창 없음")

    page.screenshot(path=os.path.join(OUT, "e2e_b_admin_auth.png"))
    ok("admin.html 인증 화면 스크린샷")

    # ── 6. 콘솔 에러 종합 ──────────────────────────────────────────
    errors = []
    page.on("console", lambda m: errors.append(m) if m.type == "error" else None)
    for html in ["index.html", "chat.html", "report.html", "admin.html"]:
        page.goto(f"{BASE}/{html}")
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(300)
    ok(f"콘솔 에러 0건: {len(errors)}건") if len(errors) == 0 else fail(f"콘솔 에러 {len(errors)}건: {[e.text for e in errors][:3]}")

    browser.close()

# 결과
print("\n" + "="*52)
print("Phase B e2e 결과")
print("="*52)
pass_cnt = sum(1 for r in results if r.startswith("PASS"))
fail_cnt = sum(1 for r in results if r.startswith("FAIL"))
print(f"PASS: {pass_cnt} / FAIL: {fail_cnt}")
for r in results: print(r)
if fail_cnt > 0: sys.exit(1)
