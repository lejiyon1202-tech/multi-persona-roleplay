"""
통합 e2e S4~S12 — multi-persona-roleplay API + UI 전수
실 서버: https://persona.3.39.80.158.nip.io
Python urllib UTF-8 명시 (catch 20호 재발 방지)
"""
import json, os, sys, io, ssl, re, urllib.request, urllib.error
from datetime import datetime
from playwright.sync_api import sync_playwright

# ── Windows cp949 콘솔 UTF-8 강제 ─────────────────────────────────────────
if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8','utf8'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if sys.stderr.encoding and sys.stderr.encoding.lower() not in ('utf-8','utf8'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

BASE        = "https://persona.3.39.80.158.nip.io"
OUT         = r"C:\Users\lejiyon\Desktop\multi-persona-roleplay"
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode    = ssl.CERT_NONE

results = []

def ok(tag, msg):
    results.append({"tag": tag, "status": "PASS", "msg": msg})
    print(f"PASS [{tag}] {msg}")

def fail(tag, msg):
    results.append({"tag": tag, "status": "FAIL", "msg": msg})
    print(f"FAIL [{tag}] {msg}")

def safe_ss(page, path, **kw):
    try: page.screenshot(path=path, **kw)
    except Exception as e: print(f"  [ss 실패] {e}")

# ── HTTP 헬퍼 ──────────────────────────────────────────────────────────────
def api_get(path, headers=None):
    req = urllib.request.Request(f"{BASE}/api{path}", headers=headers or {})
    with urllib.request.urlopen(req, timeout=15, context=SSL_CTX) as r:
        return json.loads(r.read().decode('utf-8'))

def api_post(path, body, headers=None):
    data = json.dumps(body).encode('utf-8')
    h = {'Content-Type': 'application/json', **(headers or {})}
    req = urllib.request.Request(f"{BASE}/api{path}",
          data=data, headers=h, method='POST')
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
        return json.loads(r.read().decode('utf-8'))

def sse_chat(session_id, message, target_char_id=None):
    """SSE POST /api/chat → (full_text, received_char_id)"""
    body = {"session_id": session_id, "message": message}
    if target_char_id:
        body["target_character_id"] = target_char_id
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(f"{BASE}/api/chat", data=data,
          headers={'Content-Type': 'application/json'}, method='POST')
    full_text = ""
    char_id_recv = None
    with urllib.request.urlopen(req, timeout=90, context=SSL_CTX) as r:
        for raw in r:
            line = raw.decode('utf-8', errors='replace').strip()
            if not line.startswith('data:'):
                continue
            payload = line[5:].strip()
            if not payload:
                continue
            try:
                obj = json.loads(payload)
                if 'token' in obj:
                    full_text += obj['token']
                if obj.get('done'):
                    char_id_recv = obj.get('character_id')
            except json.JSONDecodeError:
                pass
    return full_text, char_id_recv

def check_hallucination(text):
    """괄호 지문 + 메타 용어 환각 체크 → (bracket_list, meta_list)"""
    brackets  = re.findall(r'\([가-힣][^)]*\)', text)
    meta_hits = [t for t in ['롤플레잉','시뮬레이션','SBI','평가입니다'] if t in text]
    return brackets, meta_hits

# ─────────────────────────────────────────────────────────────────────────────
# S4: 시나리오 1 캐릭터 목록 + selectable 구조 확인
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S4 — /api/scenarios/1/characters")
print("="*60)

learner_char_id  = None  # 그룹장 (learner 연기 캐릭터)
partner_ids_case1 = []   # is_selectable=1 파트너 ID 목록

try:
    chars = api_get('/scenarios/1/characters')
    ok("S4", f"Case 1 캐릭터 {len(chars)}명 수신")
    selectable = [c for c in chars if c.get('is_selectable') == 1]
    context    = [c for c in chars if c.get('is_selectable') == 0]
    ok("S4", f"selectable={len(selectable)} / context-only={len(context)}")
    if len(chars) != 6:
        fail("S4", f"캐릭터 수 {len(chars)} (기대 6)")
    # 그룹장 = 학습자 연기 캐릭터
    grp = next((c for c in chars if c.get('role_level') == '그룹장'), None)
    if grp:
        learner_char_id = grp['id']
        ok("S4", f"학습자 캐릭터 확정: {grp['name']} (id={learner_char_id})")
    else:
        fail("S4", "그룹장 캐릭터 없음 — 폴백: context[0] 사용")
        if context:
            learner_char_id = context[0]['id']
    partner_ids_case1 = [c['id'] for c in selectable]
    ok("S4", f"파트너 후보 IDs: {partner_ids_case1}")
except Exception as e:
    fail("S4", f"오류: {e}")

if not learner_char_id or not partner_ids_case1:
    fail("S4", "캐릭터 정보 불충분 — S5~S12 일부 스킵 가능")

# ─────────────────────────────────────────────────────────────────────────────
# S5: 학습자 등록 + 1:1 세션 생성 (v3 모드)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S5 — 학습자 등록 + 1:1 session (v3)")
print("="*60)

learner_id = None
session_1v1 = None
partner_1v1 = partner_ids_case1[0] if partner_ids_case1 else None

try:
    res = api_post('/learners', {"name": "e2e테스터", "department": "QA팀", "email": "e2e@test.local"})
    learner_id = res.get('id')
    ok("S5", f"학습자 등록: learner_id={learner_id}")
except Exception as e:
    fail("S5", f"학습자 등록 오류: {e}")

if learner_id and learner_char_id and partner_1v1:
    try:
        res = api_post('/sessions', {
            "learner_id": learner_id,
            "scenario_id": 1,
            "learner_character_id": learner_char_id,
            "dialogue_partner_ids": [partner_1v1],
        })
        session_1v1 = res.get('session_id')
        ok("S5", f"1:1 세션 생성: session_id={session_1v1}, partner={partner_1v1}")
    except Exception as e:
        fail("S5", f"세션 생성 오류: {e}")

# ─────────────────────────────────────────────────────────────────────────────
# S6: 1:1 채팅 × 5턴 (SSE 스트림 + 환각 grep)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S6 — 1:1 채팅 × 5턴 SSE")
print("="*60)

MSGS_1V1 = [
    "박 파트장, AI 전환 일정 단축 요청에 대해 어떻게 생각하세요?",
    "데이터 검증 없이 진행하면 어떤 위험이 있다고 보시나요?",
    "그렇다면 최소한의 검증 기준을 제안해주실 수 있나요?",
    "단기 성과를 위한 시범 데이터 협력은 가능하신가요?",
    "구체적인 협력 범위와 조건을 말씀해주시겠어요?",
]

chat_responses_1v1 = []

if session_1v1:
    for i, msg in enumerate(MSGS_1V1, 1):
        try:
            text, cid = sse_chat(session_1v1, msg, partner_1v1)
            brackets, meta = check_hallucination(text)
            if not text:
                fail(f"S6-{i}", f"턴{i}: AI 응답 없음")
            else:
                ok(f"S6-{i}", f"턴{i}: {len(text)}자 수신 (char_id={cid})")
                chat_responses_1v1.append(text)
            if brackets:
                fail(f"S6-{i}", f"턴{i} 환각(괄호 지문): {brackets[:2]}")
            else:
                ok(f"S6-{i}", f"턴{i} 괄호 지문 0건 ✓")
            if meta:
                fail(f"S6-{i}", f"턴{i} 메타 용어 노출: {meta}")
            else:
                ok(f"S6-{i}", f"턴{i} 메타 용어 0건 ✓")
        except Exception as e:
            fail(f"S6-{i}", f"턴{i} SSE 오류: {e}")
else:
    fail("S6", "session_1v1 없어 스킵")

# ─────────────────────────────────────────────────────────────────────────────
# S7: 평가 호출
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S7 — POST /api/evaluate")
print("="*60)

eval_result_1v1 = None

if session_1v1:
    try:
        eval_result_1v1 = api_post('/evaluate', {"session_id": session_1v1})
        score = eval_result_1v1.get('total_score', 'N/A')
        grade = eval_result_1v1.get('grade', 'N/A')
        ok("S7", f"평가 완료: total_score={score} grade={grade}")
        if 'scores' in eval_result_1v1:
            ok("S7", f"세부 점수 필드 존재: {list(eval_result_1v1['scores'].keys())}")
        else:
            fail("S7", "scores 필드 없음")
        if 'feedback' in eval_result_1v1:
            ok("S7", "feedback 필드 존재")
        else:
            fail("S7", "feedback 필드 없음")
    except Exception as e:
        fail("S7", f"평가 오류: {e}")
else:
    fail("S7", "session_1v1 없어 스킵")

# ─────────────────────────────────────────────────────────────────────────────
# S8: 리포트 조회
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S8 — GET /api/sessions/{sid}/report")
print("="*60)

if session_1v1:
    try:
        report = api_get(f'/sessions/{session_1v1}/report')
        ok("S8", f"리포트 수신: session={report.get('session',{}).get('id')}")
        if report.get('evaluation'):
            ok("S8", f"evaluation 포함: grade={report['evaluation'].get('grade')}")
        else:
            fail("S8", "evaluation 없음 (평가 미완료)")
        turn_cnt = report.get('turn_count', 0)
        ok("S8", f"turn_count={turn_cnt}") if turn_cnt >= 10 else fail("S8", f"turn_count={turn_cnt} (기대 10+)")
    except Exception as e:
        fail("S8", f"리포트 오류: {e}")
else:
    fail("S8", "session_1v1 없어 스킵")

# ─────────────────────────────────────────────────────────────────────────────
# S9: 1:N 멀티 페르소나 (partner 2명, target 전환)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S9 — 1:N 세션 (2 파트너) + target 전환")
print("="*60)

session_1vN = None
partner_a   = partner_ids_case1[0] if len(partner_ids_case1) >= 1 else None
partner_b   = partner_ids_case1[1] if len(partner_ids_case1) >= 2 else None

if learner_id and learner_char_id and partner_a and partner_b:
    try:
        res = api_post('/sessions', {
            "learner_id": learner_id,
            "scenario_id": 1,
            "learner_character_id": learner_char_id,
            "dialogue_partner_ids": [partner_a, partner_b],
        })
        session_1vN = res.get('session_id')
        ok("S9", f"1:N 세션 생성: session_id={session_1vN}, partners={[partner_a, partner_b]}")
    except Exception as e:
        fail("S9", f"1:N 세션 생성 오류: {e}")

if session_1vN:
    # 2턴: partner_a → partner_b → partner_a → partner_b (target 전환)
    multi_msgs = [
        ("박 파트장, 지금 데이터 검증 현황 말씀해주세요.", partner_a),
        ("박보안 파트장도 현재 업무 상황 공유해주시겠어요?", partner_b),
        ("두 분 의견을 종합하면 어떤 대안이 가능할까요?", partner_a),
        ("박보안 파트장 입장에서 리소스 조정 가능한 부분이 있나요?", partner_b),
    ]
    responses_1vN = []
    for i, (msg, tgt) in enumerate(multi_msgs, 1):
        try:
            text, cid = sse_chat(session_1vN, msg, tgt)
            if not text:
                fail(f"S9-{i}", f"partner={tgt} 응답 없음")
            else:
                ok(f"S9-{i}", f"partner={tgt}→cid={cid}: {len(text)}자")
                responses_1vN.append((tgt, cid, text))
            # target 전환 검증: 수신 char_id = 요청 target_char_id
            if cid and cid != tgt:
                fail(f"S9-{i}", f"target 불일치: 요청={tgt} 수신={cid}")
            else:
                ok(f"S9-{i}", f"target 일치 ✓")
            # 환각 grep
            brackets, meta = check_hallucination(text)
            if brackets:
                fail(f"S9-{i}", f"괄호 지문: {brackets[:1]}")
            else:
                ok(f"S9-{i}", "괄호 지문 0건 ✓")
        except Exception as e:
            fail(f"S9-{i}", f"오류: {e}")
    # 페르소나 차별 확인: 두 파트너 응답이 다른지 텍스트 비교
    try:
        texts_a = " ".join(t for (tid, cid, t) in responses_1vN if tid == partner_a)
        texts_b = " ".join(t for (tid, cid, t) in responses_1vN if tid == partner_b)
        if texts_a and texts_b and texts_a[:30] != texts_b[:30]:
            ok("S9", "파트너 A·B 응답 다름 — 페르소나 차별 확인 ✓")
        elif texts_a and texts_b:
            fail("S9", "파트너 A·B 응답 동일 시작 — 페르소나 차별 의심")
    except Exception as e:
        fail("S9", f"페르소나 비교 오류: {e}")
else:
    fail("S9", "1:N 세션 없어 스킵")

# ─────────────────────────────────────────────────────────────────────────────
# S10: 360도 비교 (2nd session + evaluate + GET compare)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S10 — 360도 비교 리포트 (2nd session)")
print("="*60)

session_2nd = None
partner_2nd = partner_ids_case1[2] if len(partner_ids_case1) >= 3 else partner_1v1

if learner_id and learner_char_id and partner_2nd:
    try:
        res = api_post('/sessions', {
            "learner_id": learner_id,
            "scenario_id": 1,
            "learner_character_id": learner_char_id,
            "dialogue_partner_ids": [partner_2nd],
        })
        session_2nd = res.get('session_id')
        ok("S10", f"2nd 세션 생성: session_id={session_2nd}, partner={partner_2nd}")
    except Exception as e:
        fail("S10", f"2nd 세션 생성 오류: {e}")

if session_2nd:
    # 3턴 채팅
    msgs_2nd = [
        "이책임 선임, AI 전환 프로젝트에서 본인 역할 어떻게 보시나요?",
        "기존 시스템에 대한 인정이 부족했다고 느끼시나요?",
        "새로운 역할로 어떤 기여를 하실 수 있다고 생각하시나요?",
    ]
    for i, msg in enumerate(msgs_2nd, 1):
        try:
            text, cid = sse_chat(session_2nd, msg, partner_2nd)
            ok(f"S10-chat{i}", f"{len(text)}자") if text else fail(f"S10-chat{i}", "응답 없음")
        except Exception as e:
            fail(f"S10-chat{i}", f"오류: {e}")
    # 2nd 평가
    try:
        api_post('/evaluate', {"session_id": session_2nd})
        ok("S10", "2nd 세션 평가 완료")
    except Exception as e:
        fail("S10", f"2nd 평가 오류: {e}")
    # 360도 compare
    try:
        cmp = api_get(f'/sessions/compare?learner_id={learner_id}&scenario_id=1')
        session_cnt = len(cmp.get('sessions', []))
        ok("S10", f"360도 compare: {session_cnt}개 세션") if session_cnt >= 2 else fail("S10", f"360도 세션 {session_cnt}개 (기대 2+)")
    except Exception as e:
        fail("S10", f"360도 compare 오류: {e}")
else:
    fail("S10", "2nd 세션 없어 스킵")

# ─────────────────────────────────────────────────────────────────────────────
# S11: admin.html UI + X-Admin-Token CRUD
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S11 — admin 대시보드 UI + API CRUD")
print("="*60)

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx_pw  = browser.new_context(ignore_https_errors=True)
    pg      = ctx_pw.new_page()
    pg_errs = []
    pg.on("pageerror", lambda e: pg_errs.append(str(e)))

    try:
        pg.goto(f"{BASE}/admin.html", timeout=20000)
        pg.wait_for_load_state("networkidle")
        auth_overlay = pg.locator("#authOverlay").count()
        pwd_input    = pg.locator("input[type='password']").count()
        ok("S11", f"admin.html 로드 + 인증 오버레이: auth={auth_overlay} pwd={pwd_input}") if auth_overlay > 0 else fail("S11", "인증 오버레이 없음")
        safe_ss(pg, os.path.join(OUT, "e2e_s11_admin.png"))
    except Exception as e:
        fail("S11", f"admin.html 오류: {e}")

    browser.close()

# admin API CRUD (X-Admin-Token)
if ADMIN_TOKEN:
    try:
        h = {'X-Admin-Token': ADMIN_TOKEN}
        scenarios = api_get('/admin/scenarios', headers=h)
        cnt = len(scenarios) if isinstance(scenarios, list) else scenarios.get('length', '?')
        ok("S11", f"GET /admin/scenarios: {cnt}건")
    except Exception as e:
        fail("S11", f"admin/scenarios 오류: {e}")
else:
    fail("S11", "ADMIN_TOKEN 없음 — admin API 스킵 (환경 변수 설정 필요)")

# ─────────────────────────────────────────────────────────────────────────────
# S12: 재현성 — 동일 3턴 입력, 2세션 점수 비교 (±0.2 이내)
# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("S12 — 평가 재현성 (동일 입력 2회)")
print("="*60)

REPRO_MSGS = [
    "박 파트장, 데이터 검증 없이 AI 도입하면 어떤 문제가 생기나요?",
    "알겠습니다. 그럼 최소한의 검증 프로세스를 제안해주시겠어요?",
    "감사합니다. 협력 가능한 범위와 조건을 정리해주시겠어요?",
]

def run_mini_session(scenario_id, learner_cid, partner_cid, msgs):
    """미니 세션: learner 등록 → 세션 → chat×N → 평가 → score 반환"""
    lr = api_post('/learners', {"name": "repro테스터", "email": f"repro{int(__import__('time').time())}@test.local"})
    lid = lr['id']
    s = api_post('/sessions', {
        "learner_id": lid, "scenario_id": scenario_id,
        "learner_character_id": learner_cid,
        "dialogue_partner_ids": [partner_cid],
    })
    sid = s['session_id']
    for m in msgs:
        sse_chat(sid, m, partner_cid)
    ev = api_post('/evaluate', {"session_id": sid})
    return ev.get('total_score', 0)

if learner_char_id and partner_1v1:
    try:
        score_a = run_mini_session(1, learner_char_id, partner_1v1, REPRO_MSGS)
        ok("S12", f"세션A 점수: {score_a}")
        score_b = run_mini_session(1, learner_char_id, partner_1v1, REPRO_MSGS)
        ok("S12", f"세션B 점수: {score_b}")
        diff = abs(score_a - score_b)
        ok("S12", f"점수 차이 {diff:.3f} (허용 0.2 이내)") if diff <= 0.2 else fail("S12", f"점수 차이 {diff:.3f} 초과 — 재현성 불안정")
    except Exception as e:
        fail("S12", f"재현성 테스트 오류: {e}")
else:
    fail("S12", "캐릭터 정보 불충분 — 스킵")

# ─────────────────────────────────────────────────────────────────────────────
# 결과 집계 + HTML 보고서
# ─────────────────────────────────────────────────────────────────────────────
pass_cnt  = sum(1 for r in results if r["status"] == "PASS")
fail_cnt  = sum(1 for r in results if r["status"] == "FAIL")
total     = len(results)
score_pct = round(pass_cnt / total * 100, 1) if total else 0

print("\n" + "="*60)
print("통합 e2e S4~S12 결과")
print("="*60)
print(f"PASS: {pass_cnt} / FAIL: {fail_cnt} / 총: {total} ({score_pct}%)")
for r in results:
    print(f"{'PASS' if r['status']=='PASS' else 'FAIL'} [{r['tag']}] {r['msg']}")

rows = ""
for r in results:
    color = "#2d6a4f" if r["status"] == "PASS" else "#c1121f"
    rows += f'<tr><td style="color:{color};font-weight:bold">{r["status"]}</td><td>[{r["tag"]}]</td><td>{r["msg"]}</td></tr>\n'

html = f"""<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8">
<title>통합 e2e S4~S12 결과</title>
<style>
body{{font-family:'Noto Sans KR',sans-serif;max-width:960px;margin:40px auto;padding:0 20px;background:#f8f9fa}}
h1{{font-size:1.4rem;color:#212529}}
.summary{{display:flex;gap:16px;margin:16px 0}}
.badge{{padding:8px 20px;border-radius:8px;font-weight:700;font-size:1.1rem}}
.pass{{background:#d8f3dc;color:#1b4332}}
.fail{{background:#ffe8e8;color:#c1121f}}
.score{{background:#e3f2fd;color:#1565c0}}
table{{width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.1)}}
th{{background:#343a40;color:#fff;padding:10px 12px;text-align:left;font-size:.85rem}}
td{{padding:8px 12px;border-bottom:1px solid #dee2e6;font-size:.85rem}}
</style></head><body>
<h1>통합 e2e S4~S12 — 역할선택·채팅·평가·리포트·360도·admin·재현성</h1>
<p style="color:#6c757d;font-size:.85rem">실행: {datetime.now().strftime('%Y-%m-%d %H:%M KST')} | 서버: {BASE}</p>
<div class="summary">
  <span class="badge pass">PASS {pass_cnt}</span>
  <span class="badge fail">FAIL {fail_cnt}</span>
  <span class="badge score">총 {total}건 {score_pct}%</span>
</div>
<table><thead><tr><th>결과</th><th>태그</th><th>내용</th></tr></thead><tbody>
{rows}
</tbody></table>
</body></html>"""

report_path = os.path.join(OUT, "e2e_S4_to_S12_report.html")
with open(report_path, "w", encoding="utf-8") as f:
    f.write(html)
print(f"\nHTML 보고서: {report_path}")

if fail_cnt > 0:
    sys.exit(1)
