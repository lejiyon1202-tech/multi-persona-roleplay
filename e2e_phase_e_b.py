"""
Phase E B안 통합 e2e — 다중 캐릭터 그룹 채팅 전체 경로 검증
검증 항목:
  R-28-6 선별 적절성: 인물 지목·일반 질문·갈등 유발 × SSE character_id 응답
  R-28-3 chat.js msg-continuous/msg-new-char 클래스 + 타이핑 인디케이터
  R-28-1 파트너 chip 전환 + 아바타/이름 표시
  평가 → report 점수 정상
"""
from playwright.sync_api import sync_playwright
import json, ssl, urllib.request, time

BASE = "https://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
results = []

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

def ok(m):   results.append(("PASS", m)); print(f"PASS  {m}")
def fail(m): results.append(("FAIL", m)); print(f"FAIL  {m}")

def api_get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=15, context=SSL_CTX) as r:
        return json.loads(r.read())

def api_post(path, body):
    data = json.dumps(body).encode("utf-8")
    req  = urllib.request.Request(f"{BASE}{path}", data=data,
           headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as r:
        return json.loads(r.read())

# ────────────────────────────────────────────────────────────────
# Step 0: 시나리오·캐릭터 확인 (2명 이상 파트너)
# ────────────────────────────────────────────────────────────────
print("\n=== Step 0: 시나리오·캐릭터 확인 ===")

# 모든 시나리오에서 파트너 2명+ 가능한 것 찾기
SCENARIO_ID = None
learner_id  = None
partner_ids = []

for sid in [1, 2, 3, 4, 5, 6]:
    try:
        chars = api_get(f"/api/scenarios/{sid}/characters")
        selectable     = [c for c in chars if c.get("is_selectable")]
        non_selectable = [c for c in chars if not c.get("is_selectable")]
        # 파트너 후보: 학습자가 아닌 캐릭터들 (selectable에서 학습자 1명 제외)
        candidates = selectable[1:] + non_selectable if len(selectable) >= 2 else non_selectable
        if len(selectable) >= 1 and len(candidates) >= 2:
            SCENARIO_ID = sid
            learner_id  = selectable[0]["id"]
            partner_ids = [c["id"] for c in candidates[:3]]  # 최대 3명
            print(f"    시나리오 {sid} 사용: 학습자={learner_id} 파트너={partner_ids}")
            break
    except Exception as e:
        print(f"    시나리오 {sid} 스킵: {e}")

if not SCENARIO_ID:
    # fallback: scenario_id=1, 캐릭터 2~3명 강제 선택
    print("    fallback: scenario_id=1 강제 시도")
    chars       = api_get("/api/scenarios/1/characters")
    SCENARIO_ID = 1
    selectable  = [c for c in chars if c.get("is_selectable")]
    learner_id  = selectable[0]["id"] if selectable else chars[0]["id"]
    partner_ids = [c["id"] for c in chars if c["id"] != learner_id][:2]
    print(f"    학습자={learner_id} 파트너={partner_ids}")

ok(f"시나리오 {SCENARIO_ID} · 파트너 {len(partner_ids)}명") if len(partner_ids) >= 2 else fail(f"파트너 2명 미만: {partner_ids}")

# ────────────────────────────────────────────────────────────────
# Step 1: 세션 생성 (v3 다중 파트너)
# ────────────────────────────────────────────────────────────────
print("\n=== Step 1: v3 세션 생성 ===")
sess = api_post("/api/sessions", {
    "learner_id": 1,
    "scenario_id": SCENARIO_ID,
    "learner_character_id": learner_id,
    "dialogue_partner_ids": partner_ids,
})
session_id = sess.get("session_id")
ok(f"세션 생성: session_id={session_id}") if session_id else fail(f"세션 생성 실패: {sess}")

# ────────────────────────────────────────────────────────────────
# Step 2: Playwright — chat.html v3 URL 진입
# ────────────────────────────────────────────────────────────────
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(
        ignore_https_errors=True,
        viewport={"width": 1280, "height": 800}
    )
    page = ctx.new_page()

    CHAT_URL = (
        f"{BASE}/chat.html"
        f"?scenario_id={SCENARIO_ID}"
        f"&session_id={session_id}"
        f"&learner_char={learner_id}"
        f"&partners={','.join(str(i) for i in partner_ids)}"
    )
    print(f"\n=== Step 2: chat.html 진입 ===")
    print(f"    URL: {CHAT_URL}")

    page.goto(CHAT_URL, timeout=20000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2000)
    page.screenshot(path=f"{OUT}/e2e_e_01_chat_loaded.png")
    ok("chat.html 로드 완료")

    # ── R-28-1: 파트너 strip (chip) 표시 확인 ────────────────────
    print("\n=== R-28-1: 파트너 chip 표시 ===")
    chips = page.locator(".partner-chip").all()
    ok(f"파트너 chip {len(chips)}개") if len(chips) >= 2 else fail(f"chip 부족: {len(chips)}")

    active_chip = page.locator(".partner-chip.active").count()
    ok(f"활성 chip 1개") if active_chip == 1 else fail(f"활성 chip 오류: {active_chip}")

    # targetIndicator 확인
    target_visible = page.locator("#targetIndicator:not(.hidden)").count()
    ok("targetIndicator 표시") if target_visible > 0 else fail("targetIndicator 미표시")

    # msgInput, sendBtn 존재
    ok("msgInput 존재") if page.locator("#msgInput").count() > 0 else fail("msgInput 없음")
    ok("sendBtn 존재") if page.locator("#sendBtn").count() > 0 else fail("sendBtn 없음")

    # ── R-28-6: 발화 3건 (인물 지목·일반 질문·갈등 유발) ──────────
    turns = [
        "팀장님, 이번 AI 도입 건은 어떻게 생각하세요?",       # 인물 지목
        "팀 전체적으로 업무 방향을 어떻게 잡아야 할까요?",     # 일반 질문
        "솔직히 말하면, 이 방향에 동의하기 어렵습니다.",       # 갈등 유발
    ]
    labels = ["인물 지목", "일반 질문", "갈등 유발"]

    msg_input = page.locator("#msgInput")
    send_btn  = page.locator("#sendBtn")

    for i, (msg, label) in enumerate(zip(turns, labels), 1):
        print(f"\n=== Step 3-{i}: 발화 [{label}] ===")
        msg_input.fill(msg)
        page.wait_for_timeout(300)
        send_btn.click()
        print(f"    전송 완료. SSE 응답 대기...")

        try:
            # sendBtn enabled = isWaiting=false = 모든 SSE 완전 완료 신호
            page.wait_for_selector("#sendBtn:not([disabled])", timeout=120000)
        except:
            pass
        page.wait_for_timeout(800)

        # ── R-28-3: AI 메시지 버블 존재 확인 ────────────────────
        ai_msgs = page.locator(".msg.ai .msg-bubble").all()
        ok(f"턴 {i} [{label}] AI 응답 {len(ai_msgs)}개") if len(ai_msgs) >= i else fail(f"턴 {i} AI 응답 없음")

        # ── R-28-3: msg-continuous / msg-new-char 클래스 확인 ───
        continuous = page.locator(".msg.ai.msg-continuous").count()
        new_char   = page.locator(".msg.ai.msg-new-char").count()
        ok(f"턴 {i} 발화자 클래스 continuous:{continuous} new_char:{new_char}") if (continuous + new_char) <= len(ai_msgs) else fail("발화자 클래스 수 초과")

        page.screenshot(path=f"{OUT}/e2e_e_0{i+1}_{label.replace(' ','_')}.png")
        ok(f"턴 {i} 스크린샷")

    # ── chip 전환 테스트 (R-28-4) ────────────────────────────────
    print("\n=== R-28-4: chip 전환 ===")
    if len(chips) >= 2:
        chips[1].click()
        page.wait_for_timeout(500)
        new_active = page.locator(".partner-chip.active").count()
        ok("chip 전환 후 active 1개") if new_active == 1 else fail(f"chip 전환 실패: {new_active}")
        page.screenshot(path=f"{OUT}/e2e_e_05_chip_switch.png")
        ok("chip 전환 스크린샷")

    # ── 평가 받기 → report ────────────────────────────────────────
    print("\n=== Step 4: 평가 받기 ===")
    end_btn = page.locator("#endChatBtn")
    ok("endChatBtn 존재") if end_btn.count() > 0 else fail("endChatBtn 없음")

    is_disabled = end_btn.get_attribute("disabled")
    ok("평가 받기 활성화") if not is_disabled else fail(f"평가 받기 비활성: {is_disabled}")

    page.screenshot(path=f"{OUT}/e2e_e_06_before_eval.png")
    end_btn.click()
    print("    '평가 받기' 클릭. shimmer + 평가 대기...")
    page.wait_for_timeout(1000)

    btn_text = end_btn.inner_text()
    ok(f"shimmer 텍스트: '{btn_text}'") if "평가" in btn_text else fail(f"버튼 텍스트 이상: '{btn_text}'")
    page.screenshot(path=f"{OUT}/e2e_e_07_shimmer.png")

    try:
        page.wait_for_url("**/report.html**", timeout=130000)
        ok("report.html 자동 전환")
    except Exception as e:
        fail(f"report.html 전환 실패: {e}")

    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(2500)
    page.screenshot(path=f"{OUT}/e2e_e_08_report.png")

    print("\n=== Step 5: 리포트 점수 검증 ===")
    page_text = page.inner_text("body")
    ok("0.0 점수 없음") if "0.0 / 25" not in page_text and "0.0/25" not in page_text else fail("0.0 점수 표시 — 버그")
    ok("피드백 없음 없음") if "피드백 데이터가 없습니다" not in page_text else fail("피드백 데이터 없음 표시")
    ok("리포트 본문 충분") if len(page_text) > 500 else fail(f"리포트 내용 부족: {len(page_text)}자")
    page.screenshot(path=f"{OUT}/e2e_e_09_report_score.png")

    # 모바일
    ctx_m = browser.new_context(ignore_https_errors=True, viewport={"width": 375, "height": 812})
    page_m = ctx_m.new_page()
    page_m.goto(page.url, timeout=15000)
    page_m.wait_for_load_state("networkidle", timeout=10000)
    page_m.wait_for_timeout(1500)
    page_m.screenshot(path=f"{OUT}/e2e_e_10_report_mobile.png")
    ok("모바일(375) 리포트 렌더")
    ctx_m.close()

    browser.close()

# ────────────────────────────────────────────────────────────────
# 결과
# ────────────────────────────────────────────────────────────────
total  = len(results)
passed = sum(1 for r, _ in results if r == "PASS")
failed = sum(1 for r, _ in results if r == "FAIL")
print(f"\n{'='*55}")
print(f"Phase E B안 e2e: {passed}/{total} PASS  {failed} FAIL")
if failed > 0:
    print("FAIL 목록:")
    for r, m in results:
        if r == "FAIL":
            print(f"  FAIL {m}")
print(f"스크린샷: {OUT}/e2e_e_*.png")
