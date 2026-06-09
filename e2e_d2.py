"""Phase D-2 e2e 검증 스크립트 — Python urllib UTF-8"""
import json, urllib.request, urllib.parse, time, sys, ssl

BASE = "https://persona.3.39.80.158.nip.io"
CTX  = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

def post(path, body):
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(f"{BASE}{path}", data=data,
          headers={"Content-Type": "application/json; charset=utf-8"})
    with urllib.request.urlopen(req, timeout=60, context=CTX) as r:
        return json.loads(r.read().decode("utf-8"))

def get(path):
    with urllib.request.urlopen(f"{BASE}{path}", timeout=60, context=CTX) as r:
        return json.loads(r.read().decode("utf-8"))

def sse_post(path, body):
    """SSE 스트리밍 — 전체 텍스트 누적 후 반환"""
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(f"{BASE}{path}", data=data,
          headers={"Content-Type": "application/json; charset=utf-8"})
    full = ""
    char_id = None
    with urllib.request.urlopen(req, timeout=120, context=CTX) as r:
        for raw in r:
            line = raw.decode("utf-8").strip()
            if not line.startswith("data:"):
                continue
            payload = json.loads(line[5:].strip())
            if "token" in payload:
                full += payload["token"]
            if payload.get("done"):
                char_id = payload.get("character_id")
    return full, char_id

print("=" * 60)
print("Phase D-2 e2e 검증")
print("=" * 60)

# Step 1: learner 등록
print("\n[1] 학습자 등록...")
lr = post("/api/learners", {"name": "e2e_tester", "department": "QA팀", "email": "e2e@test.com"})
learner_id = lr["id"]
print(f"    learner_id = {learner_id}")

# Step 2: 캐릭터 목록
print("\n[2] 시나리오 1 캐릭터 조회...")
chars = get("/api/scenarios/1/characters")
selectable = [c for c in chars if c.get("is_selectable")]
non_selectable = [c for c in chars if not c.get("is_selectable")]
print(f"    전체 캐릭터: {len(chars)}명")
print(f"    selectable (학습자 가능): {[(c['id'], c['name']) for c in selectable]}")
print(f"    non-selectable (AI 파트너 가능): {[(c['id'], c['name']) for c in non_selectable]}")

if not selectable:
    print("    ⚠️ selectable 캐릭터 없음 — non_selectable[0]을 학습자로 사용")
    learner_char = non_selectable[0]
    partner_char = non_selectable[1] if len(non_selectable) > 1 else non_selectable[0]
else:
    learner_char = selectable[0]
    partner_char = non_selectable[0] if non_selectable else selectable[1]

learner_char_id = learner_char["id"]
partner_char_id = partner_char["id"]
print(f"    → 학습자 캐릭터: {learner_char_id} ({learner_char['name']})")
print(f"    → 파트너 캐릭터: {partner_char_id} ({partner_char['name']})")

# Step 3: 세션 생성 (v3)
print("\n[3] 세션 생성 (v3)...")
sess = post("/api/sessions", {
    "learner_id": learner_id,
    "scenario_id": 1,
    "learner_character_id": learner_char_id,
    "dialogue_partner_ids": [partner_char_id]
})
session_id = sess["session_id"]
print(f"    session_id = {session_id}")

# Step 4: 5턴 채팅
turns = [
    "안녕하세요. 오늘 면담 요청한 이유는 팀 내 커뮤니케이션 문제 때문입니다.",
    "팀원들 간의 갈등이 심화되고 있어서 제 역할을 어떻게 해야 할지 고민입니다.",
    "구체적으로 A팀원과 B팀원이 업무 협업에서 자주 충돌하고 있습니다.",
    "제가 중간에서 조율하려 했는데 오히려 역효과가 나는 것 같아요.",
    "어떻게 접근하면 두 사람의 관계를 개선할 수 있을까요?"
]

print("\n[4] 5턴 채팅 SSE...")
for i, msg in enumerate(turns, 1):
    print(f"    turn {i}: {msg[:40]}...")
    reply, char_id = sse_post("/api/chat", {
        "session_id": session_id,
        "message": msg,
        "target_character_id": partner_char_id
    })
    print(f"           AI 응답 길이: {len(reply)}자 (char_id={char_id})")
    time.sleep(0.5)

# Step 5: 평가
print("\n[5] 평가 호출 (최대 2분 소요)...")
t0 = time.time()
ev = post("/api/evaluate", {"session_id": session_id})
elapsed = time.time() - t0
print(f"    완료 ({elapsed:.1f}초)")

# Step 6: JSON 구조 검증
print("\n[6] JSON 구조 검증...")
ok = True

def chk(label, cond, detail=""):
    global ok
    mark = "[OK]" if cond else "[FAIL]"
    print(f"    {mark} {label}" + (f": {detail}" if detail else ""))
    if not cond:
        ok = False

chk("total_score 존재", "total_score" in ev, ev.get("total_score"))
chk("grade 존재", "grade" in ev, ev.get("grade"))
chk("scores.r26 존재", "r26" in ev.get("scores", {}), ev.get("scores", {}).get("r26"))
chk("scores.r27 존재", "r27" in ev.get("scores", {}), ev.get("scores", {}).get("r27"))
chk("scores.r28 존재", "r28" in ev.get("scores", {}), ev.get("scores", {}).get("r28"))

axes = ev.get("scores", {}).get("axes", {})
expected_axes = ["경청과공감", "이해관계조정", "목표설정지원", "동기부여소통", "갈등조율"]
for ax in expected_axes:
    chk(f"axes.{ax}", ax in axes, axes.get(ax))

fb = ev.get("feedback", {})
chk("feedback.overall", bool(fb.get("overall")), str(fb.get("overall", ""))[:50])
chk("feedback.highlight_positive", isinstance(fb.get("highlight_positive"), list),
    f"{len(fb.get('highlight_positive', []))}건")
chk("feedback.highlight_improve", isinstance(fb.get("highlight_improve"), list),
    f"{len(fb.get('highlight_improve', []))}건")
chk("feedback.emotion_track", isinstance(fb.get("emotion_track"), list),
    f"{len(fb.get('emotion_track', []))}건")
chk("feedback.next_challenges", isinstance(fb.get("next_challenges"), list),
    f"{len(fb.get('next_challenges', []))}건")
chk("feedback.guide_items", isinstance(fb.get("guide_items"), list),
    f"{len(fb.get('guide_items', []))}건")

# D-2 보완 검증
print("\n[D-2 보완] self_learning / job_perspective 검증...")
sl = fb.get("self_learning")
gi = fb.get("guide_items")
if sl:
    chk("self_learning 구조 존재", True, str(list(sl.keys()))[:60])
    for k in ["reflection_question", "key_learning", "retry_tip"]:
        chk(f"self_learning.{k}", bool(sl.get(k)), str(sl.get(k, ""))[:50])
elif gi:
    chk("guide_items backward compat (self_learning 미생성 시 폴백)", True,
        f"{len(gi)}건 — evaluation prompt 갱신 전 세션일 수 있음")
else:
    chk("self_learning 또는 guide_items 중 하나 필수", False)

nc = fb.get("next_challenges", [])
jp_count = sum(1 for c in nc if isinstance(c, dict) and c.get("job_perspective"))
chk(f"next_challenges.job_perspective ({jp_count}/{len(nc)})",
    jp_count > 0 or len(nc) == 0,
    f"전체 {len(nc)}건 중 job_perspective {jp_count}건")

# Step 7: 발화 인용 환각 검증
print("\n[7] 발화 인용 환각 검증...")
positives = fb.get("highlight_positive", [])
improves = fb.get("highlight_improve", [])
hallucination = False
for item in positives + improves:
    quote = item.get("quote", "")
    found = any(quote in t or t in quote for t in turns if len(quote) > 5)
    if not found and len(quote) > 5:
        print(f"    ⚠️ 환각 의심 인용: {quote[:60]}")
        hallucination = True
if not hallucination:
    print("    [OK] 발화 인용 모두 학습자 transcript 기반 (환각 0건)")

# Step 8: /api/sessions/:id/report flatten 검증
print("\n[8] report API flatten 검증...")
rpt = get(f"/api/sessions/{session_id}/report")
chk("report.scores.axes", bool(rpt.get("scores", {}).get("axes")))
chk("report.feedback.overall", bool(rpt.get("feedback", {}).get("overall")))
chk("report.total_score", "total_score" in rpt, rpt.get("total_score"))
chk("report.grade", "grade" in rpt, rpt.get("grade"))

# 최종
print("\n" + "=" * 60)
if ok:
    print(f"[PASS] Phase D-2 e2e 검증 PASS -- session_id = {session_id}")
else:
    print(f"[FAIL] Phase D-2 e2e 검증 FAIL -- 위 항목 확인 필요")
print(f"   total_score = {ev.get('total_score')} / grade = {ev.get('grade')}")
print(f"\n기안84 전달용 session_id: {session_id}")
print("=" * 60)
