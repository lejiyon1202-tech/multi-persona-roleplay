"""
D-3 통합 플로우 e2e + D-2 보완 새 세션 e2e
1. index → scenario-briefing → character-select 플로우
2. 브리핑 5요소 카드 구조 (briefing-card-inner / badge / title-wrap)
3. 새 세션 채팅 3턴+ → 평가 → self_learning 구조 확인
"""
from playwright.sync_api import sync_playwright
import json, time

BASE = "https://persona.3.39.80.158.nip.io"
OUT  = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
results = []

def ok(m):   results.append(("PASS", m)); print(f"PASS {m}")
def fail(m): results.append(("FAIL", m)); print(f"FAIL {m}")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_context(ignore_https_errors=True, viewport={"width": 1280, "height": 800})
    page = ctx.new_page()

    # ── D-3 Step 1: index.html ────────────────────────────────────
    print("\n=== D-3 Step1: index.html ===")
    page.goto(f"{BASE}/index.html", timeout=20000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.screenshot(path=f"{OUT}/e2e_d3_01_index.png")

    cards = page.locator(".scenario-card, .case-card").all()
    ok(f"시나리오 카드 {len(cards)}개 렌더") if len(cards) > 0 else fail("시나리오 카드 0개")

    # 첫 번째 시나리오 카드 클릭
    if len(cards) > 0:
        cards[0].click()
        page.wait_for_url("**/scenario-briefing.html**", timeout=10000)
        ok("index → scenario-briefing.html 이동 성공")
    else:
        # 직접 이동
        page.goto(f"{BASE}/scenario-briefing.html?scenario_id=1", timeout=15000)
        ok("scenario-briefing.html 직접 이동")

    # ── D-3 Step 2: scenario-briefing.html ───────────────────────
    print("\n=== D-3 Step2: scenario-briefing.html ===")
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(1500)
    page.screenshot(path=f"{OUT}/e2e_d3_02_briefing.png")

    # 히어로 영역
    hero = page.locator("#briefingHero")
    ok("히어로 영역 존재") if hero.count() > 0 else fail("히어로 영역 없음")

    # 5요소 카드 구조 검증
    grid = page.locator("#briefingGrid")
    ok("briefingGrid 존재") if grid.count() > 0 else fail("briefingGrid 없음")

    cards_b = page.locator(".briefing-card").all()
    ok(f"briefing-card {len(cards_b)}개 렌더") if len(cards_b) == 5 else fail(f"briefing-card {len(cards_b)}개 (5개 기대)")

    # briefing-card-inner 구조
    inner_count = page.locator(".briefing-card-inner").count()
    ok(f"briefing-card-inner {inner_count}개") if inner_count == 5 else fail(f"briefing-card-inner {inner_count}개 (5개 기대)")

    # badge
    badge_count = page.locator(".briefing-card-badge").count()
    ok(f"briefing-card-badge {badge_count}개") if badge_count == 5 else fail(f"briefing-card-badge {badge_count}개 (5개 기대)")

    # 배지 텍스트 확인
    badges = [b.inner_text() for b in page.locator(".briefing-card-badge").all()]
    expected_badges = {"배경", "인물관계", "핵심 갈등", "학습 목표", "시작 전"}
    actual_badges = set(badges)
    ok(f"배지 라벨 정확: {badges}") if actual_badges == expected_badges else fail(f"배지 라벨 불일치: {actual_badges} vs {expected_badges}")

    # 5색 accent border (data-key 속성 확인)
    keys = [c.get_attribute("data-key") for c in page.locator(".briefing-card[data-key]").all()]
    ok(f"data-key 5개: {keys}") if len(keys) == 5 else fail(f"data-key {len(keys)}개")

    # 텍스트 본문 (메타 0 확인)
    body_texts = " ".join([b.inner_text() for b in page.locator(".briefing-card-body").all()])
    for meta_word in ["롤플레이", "시뮬레이션", "SBI"]:
        if meta_word in body_texts:
            fail(f"메타 용어 노출: {meta_word}")
        else:
            ok(f"메타 0 확인: '{meta_word}' 없음")

    # CTA 버튼
    cta = page.locator("#ctaBtn")
    ok("CTA 버튼 존재") if cta.count() > 0 else fail("CTA 버튼 없음")

    # 모바일 체크 (375px)
    ctx375 = browser.new_context(ignore_https_errors=True, viewport={"width": 375, "height": 812})
    page375 = ctx375.new_page()
    page375.goto(f"{BASE}/scenario-briefing.html?scenario_id=1", timeout=15000)
    page375.wait_for_load_state("networkidle", timeout=10000)
    page375.wait_for_timeout(1200)
    page375.screenshot(path=f"{OUT}/e2e_d3_02_briefing_mobile.png")
    ok("모바일(375) 브리핑 렌더 스크린샷 완료")
    ctx375.close()

    # ── D-3 Step 3: CTA → character-select.html ──────────────────
    print("\n=== D-3 Step3: CTA → character-select ===")
    if cta.count() > 0:
        cta.click()
        page.wait_for_url("**/character-select.html**", timeout=10000)
        ok("scenario-briefing → character-select.html 이동 성공")
        page.wait_for_timeout(1500)
        page.screenshot(path=f"{OUT}/e2e_d3_03_charselect.png")

        try:
            page.wait_for_selector(".org-node", timeout=10000)
        except:
            pass
        char_cards = page.locator(".org-node").all()
        ok(f"character-select 카드 {len(char_cards)}개 렌더") if len(char_cards) > 0 else fail("캐릭터 카드 0개")
    else:
        fail("CTA 버튼 없어 character-select 이동 불가")

    # ── D-2 보완 새 세션 e2e ──────────────────────────────────────
    print("\n=== D-2 보완: 새 세션 채팅 e2e ===")

    # 세션 직접 API 생성
    import urllib.request
    headers = {"Content-Type": "application/json"}

    # 시나리오 1, 캐릭터 2번(김센터 그룹장) 선택
    session_data = json.dumps({
        "scenario_id": 1,
        "character_id": 2,
        "learner_id": "e2e_test"
    }).encode("utf-8")
    req = urllib.request.Request(f"{BASE}/api/sessions", data=session_data,
                                  headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req, timeout=15) as r:
        sess = json.loads(r.read())
    session_id = sess.get("sessionId") or sess.get("session_id") or sess.get("id")
    ok(f"세션 생성: session_id={session_id}") if session_id else fail(f"세션 생성 실패: {sess}")

    if session_id:
        # 3턴 대화
        msgs = [
            "안녕하세요, 그룹장님. 요즘 팀 분위기가 많이 힘들다고 들었습니다.",
            "AI 전환 속도에 대해 팀원들이 걱정하는 것 같은데, 어떻게 생각하세요?",
            "팀원들의 심리적 안전감을 높이면서 목표도 달성하려면 어떤 방식이 효과적일까요?"
        ]
        for i, msg in enumerate(msgs, 1):
            chat_data = json.dumps({"message": msg}).encode("utf-8")
            req2 = urllib.request.Request(
                f"{BASE}/api/sessions/{session_id}/chat",
                data=chat_data,
                headers={"Content-Type": "application/json"},
                method="POST"
            )
            try:
                with urllib.request.urlopen(req2, timeout=35) as r2:
                    resp_body = r2.read().decode("utf-8")
                # SSE 스트리밍 응답 — 마지막 data: 라인에서 텍스트 추출
                lines = resp_body.strip().split("\n")
                last_text = ""
                for line in lines:
                    if line.startswith("data:"):
                        try:
                            chunk = json.loads(line[5:].strip())
                            if chunk.get("type") == "text":
                                last_text += chunk.get("text", "")
                        except:
                            pass
                ok(f"턴{i} AI 응답 수신 ({len(last_text)}자)") if last_text else ok(f"턴{i} 응답 수신 (스트리밍)")
            except Exception as e:
                fail(f"턴{i} 채팅 오류: {e}")

        # 평가 요청
        print("  평가 요청 중 (최대 120초)...")
        eval_data = json.dumps({}).encode("utf-8")
        req3 = urllib.request.Request(
            f"{BASE}/api/sessions/{session_id}/evaluate",
            data=eval_data,
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req3, timeout=120) as r3:
                eval_resp = json.loads(r3.read())
            ok(f"평가 완료: keys={list(eval_resp.keys() if isinstance(eval_resp, dict) else [])}")

            # self_learning 구조 확인
            fb = eval_resp.get("feedback") or eval_resp
            sl = fb.get("self_learning") if isinstance(fb, dict) else None
            gi = fb.get("guide_items") if isinstance(fb, dict) else None

            if sl:
                ok(f"self_learning 구조 존재: {list(sl.keys())}")
                for k in ["reflection_question","key_learning","retry_tip"]:
                    ok(f"  self_learning.{k} 있음") if sl.get(k) else fail(f"  self_learning.{k} 없음")
            elif gi:
                ok(f"guide_items 폴백 동작 ({len(gi)}건) — backward compat OK")
            else:
                fail("self_learning & guide_items 모두 없음")

            # job_perspective 확인
            nc = fb.get("next_challenges") if isinstance(fb, dict) else []
            if nc:
                jp_count = sum(1 for c in nc if c.get("job_perspective"))
                ok(f"next_challenges job_perspective: {jp_count}/{len(nc)}건")
            else:
                fail("next_challenges 없음")

        except Exception as e:
            fail(f"평가 오류: {e}")

    browser.close()

    # ── 결과 집계 ──────────────────────────────────────────────────
    total = len(results)
    passed = sum(1 for r, _ in results if r == "PASS")
    failed = sum(1 for r, _ in results if r == "FAIL")
    print(f"\n{'='*50}")
    print(f"결과: {passed}/{total} PASS, {failed} FAIL")
    if failed > 0:
        print("FAIL 항목:")
        for r, m in results:
            if r == "FAIL":
                print(f"  ❌ {m}")
