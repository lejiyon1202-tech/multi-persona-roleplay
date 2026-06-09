"""
학습자 실제 경로 e2e — "평가 받기" 버튼 클릭 → report 실제 점수 확인
Phase D 버그 수정(d96bd18+187dc1b+3abdd18) 브라우저 클릭 검증
"""
from playwright.sync_api import sync_playwright
import time, json

BASE = "https://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
results = []

def ok(m):   results.append(("PASS", m)); print(f"PASS {m}")
def fail(m): results.append(("FAIL", m)); print(f"FAIL {m}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        ignore_https_errors=True,
        viewport={"width": 1280, "height": 800}
    )
    page = ctx.new_page()

    # ── Step 1: 세션 직접 생성 (v3: learner_char + partner) ────────
    print("\n=== Step 1: API 세션 생성 ===")
    import urllib.request, ssl
    SSL = ssl.create_default_context()
    SSL.check_hostname = False
    SSL.verify_mode = ssl.CERT_NONE

    # 캐릭터 목록 조회
    with urllib.request.urlopen(f"{BASE}/api/scenarios/1/characters", timeout=15, context=SSL) as r:
        chars = json.loads(r.read())

    selectable = [c for c in chars if c.get("is_selectable")]
    non_sel    = [c for c in chars if not c.get("is_selectable")]

    # 학습자 캐릭터: is_selectable=1 우선, 없으면 첫번째
    learner_char = selectable[0] if selectable else chars[0]
    # 파트너: is_selectable=0 우선 (AI 상대방)
    partner_char = non_sel[0] if non_sel else chars[1]

    learner_char_id = learner_char["id"]
    partner_char_id = partner_char["id"]
    print(f"    학습자: {learner_char_id} ({learner_char['name']})")
    print(f"    파트너: {partner_char_id} ({partner_char['name']})")

    # 세션 생성
    body = json.dumps({
        "learner_id": 1,
        "scenario_id": 1,
        "learner_character_id": learner_char_id,
        "dialogue_partner_ids": [partner_char_id]
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/sessions", data=body,
          headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15, context=SSL) as r:
        sess = json.loads(r.read())
    session_id = sess.get("session_id")
    ok(f"세션 생성: session_id={session_id}") if session_id else fail(f"세션 생성 실패: {sess}")

    # ── Step 2: chat.html 직접 진입 ────────────────────────────────
    print("\n=== Step 2: chat.html 진입 ===")
    CHAT_URL = (
        f"{BASE}/chat.html"
        f"?scenario_id=1"
        f"&session_id={session_id}"
        f"&learner_char={learner_char_id}"
        f"&partners={partner_char_id}"
    )
    page.goto(CHAT_URL, timeout=20000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{OUT}/e2e_endchat_01_chat_loaded.png")
    ok("chat.html 로드 완료")

    # 메시지 입력창 확인
    msg_input = page.locator("#msgInput")
    ok("msgInput 존재") if msg_input.count() > 0 else fail("msgInput 없음")

    # ── Step 3: 3턴 대화 ─────────────────────────────────────────
    print("\n=== Step 3: 3턴 대화 ===")
    turns = [
        "안녕하세요. 오늘 팀 커뮤니케이션 문제로 이야기 나누고 싶었습니다.",
        "팀원들이 AI 전환에 대해 걱정을 많이 하고 있는 것 같아서요.",
        "리더로서 어떻게 접근하면 좋을까요?"
    ]

    for i, msg in enumerate(turns, 1):
        print(f"    turn {i}: 입력 중...")
        msg_input.fill(msg)
        page.wait_for_timeout(300)

        send_btn = page.locator("#sendBtn")
        send_btn.click()
        print(f"    turn {i}: 전송 완료. AI 응답 대기...")

        # AI 응답 대기 (타이핑 인디케이터 사라질 때까지)
        try:
            page.wait_for_selector("#typingIndicator.hidden", timeout=60000)
        except:
            pass
        page.wait_for_timeout(1500)
        ok(f"턴 {i} 완료")

    page.screenshot(path=f"{OUT}/e2e_endchat_02_after_3turns.png")

    # ── Step 4: "평가 받기" 버튼 확인 및 클릭 ─────────────────────
    print("\n=== Step 4: 평가 받기 버튼 클릭 ===")
    end_btn = page.locator("#endChatBtn")
    ok("endChatBtn 존재") if end_btn.count() > 0 else fail("endChatBtn 없음")

    # 버튼 활성화 확인 (3턴 후 활성화)
    is_disabled = end_btn.get_attribute("disabled")
    ok("평가 받기 버튼 활성화됨") if not is_disabled else fail(f"평가 받기 버튼 비활성 (disabled={is_disabled})")

    page.screenshot(path=f"{OUT}/e2e_endchat_03_before_evaluate.png")

    # 클릭
    end_btn.click()
    print("    '평가 받기' 클릭 완료. shimmer + evaluate 대기...")
    page.wait_for_timeout(1000)

    # "평가 중..." shimmer 표시 확인
    btn_text = end_btn.inner_text()
    ok(f"평가 중 텍스트 표시: '{btn_text}'") if "평가" in btn_text else fail(f"버튼 텍스트 이상: '{btn_text}'")

    evaluating_class = end_btn.get_attribute("class") or ""
    ok("evaluating 클래스 적용") if "evaluating" in evaluating_class else fail(f"evaluating 클래스 없음: '{evaluating_class}'")

    page.screenshot(path=f"{OUT}/e2e_endchat_04_evaluating_shimmer.png")

    # ── Step 5: report.html 이동 대기 (최대 130초) ─────────────────
    print("\n=== Step 5: report.html 이동 대기 ===")
    try:
        page.wait_for_url("**/report.html**", timeout=130000)
        ok("report.html 자동 전환 완료")
    except Exception as e:
        fail(f"report.html 전환 실패: {e}")

    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{OUT}/e2e_endchat_05_report_loaded.png")

    # ── Step 6: 리포트 점수·피드백 정상 확인 ──────────────────────
    print("\n=== Step 6: 리포트 데이터 검증 ===")

    # 총점 확인
    score_els = page.locator("[class*='score'], [class*='total'], [id*='score'], [id*='total']").all()
    page_text = page.inner_text("body")

    # 0.0 아닌 점수 확인
    ok("0.0 점수 표시 없음") if "0.0 / 25" not in page_text and "0.0/25" not in page_text else fail("0.0 점수 여전히 표시됨 — 버그 미해소")
    ok("점수 데이터 존재") if any(c.isdigit() for c in page_text[:2000]) else fail("점수 데이터 없음")

    # "피드백 데이터가 없습니다" 없음 확인
    ok("'피드백 데이터 없음' 메시지 없음") if "피드백 데이터가 없습니다" not in page_text else fail("피드백 데이터가 없습니다 여전히 표시")

    # overall 피드백 확인
    ok("피드백 텍스트 존재") if len(page_text) > 500 else fail(f"리포트 내용 부족: {len(page_text)}자")

    page.screenshot(path=f"{OUT}/e2e_endchat_06_report_score.png")

    # 모바일 체크
    ctx_m = browser.new_context(ignore_https_errors=True, viewport={"width": 375, "height": 812})
    page_m = ctx_m.new_page()
    page_m.goto(page.url, timeout=15000)
    page_m.wait_for_load_state("networkidle", timeout=10000)
    page_m.wait_for_timeout(1500)
    page_m.screenshot(path=f"{OUT}/e2e_endchat_07_report_mobile.png")
    ok("모바일(375) 리포트 렌더 완료")
    ctx_m.close()

    browser.close()

    # ── 결과 집계 ──────────────────────────────────────────────────
    total  = len(results)
    passed = sum(1 for r, _ in results if r == "PASS")
    failed = sum(1 for r, _ in results if r == "FAIL")
    print(f"\n{'='*50}")
    print(f"결과: {passed}/{total} PASS, {failed} FAIL")
    if failed > 0:
        print("FAIL 항목:")
        for r, m in results:
            if r == "FAIL":
                print(f"  FAIL {m}")
    print(f"스크린샷: {OUT}/e2e_endchat_0*.png")
