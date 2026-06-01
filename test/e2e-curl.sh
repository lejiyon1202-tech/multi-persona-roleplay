#!/usr/bin/env bash
# multi-persona-roleplay curl e2e 8 시나리오
# 사용법: BASE=http://persona.3.39.80.158.nip.io ADMIN_TOKEN=xxx bash e2e-curl.sh

set -euo pipefail
BASE="${BASE:-http://persona.3.39.80.158.nip.io}"
ADMIN_TOKEN="${ADMIN_TOKEN:?ADMIN_TOKEN 환경변수 필수}"
PASS=0; FAIL=0

ok()   { echo "  ✅ PASS: $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ FAIL: $1"; FAIL=$((FAIL+1)); }

echo "============================================================"
echo " multi-persona-roleplay e2e curl 테스트"
echo " BASE: $BASE"
echo "============================================================"

# ── S1: 시나리오 목록 ──────────────────────────────────────────────
echo ""
echo "▶ S1 시나리오 목록 (GET /api/scenarios)"
S1=$(curl -sf "$BASE/api/scenarios")
COUNT=$(echo "$S1" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
if [ "$COUNT" -ge 2 ]; then ok "시나리오 $COUNT건 확인"; else fail "시나리오 $COUNT건 (2건 기대)"; fi

# ── S2: 캐릭터 목록 ───────────────────────────────────────────────
echo ""
echo "▶ S2 캐릭터 목록 (GET /api/scenarios/2/characters)"
S2=$(curl -sf "$BASE/api/scenarios/2/characters")
CHAR_COUNT=$(echo "$S2" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo 0)
SEL_COUNT=$(echo "$S2" | python3 -c "import sys,json; print(sum(1 for c in json.load(sys.stdin) if c['is_selectable']))" 2>/dev/null || echo 0)
if [ "$CHAR_COUNT" -ge 6 ]; then ok "캐릭터 $CHAR_COUNT건·선택가능 $SEL_COUNT건"; else fail "캐릭터 $CHAR_COUNT건 (6건 기대)"; fi

# 선택가능 캐릭터 ID 추출
CHAR_ID=$(echo "$S2" | python3 -c "import sys,json; chars=[c for c in json.load(sys.stdin) if c['is_selectable']]; print(chars[0]['id'])" 2>/dev/null || echo "")
if [ -z "$CHAR_ID" ]; then fail "선택가능 캐릭터 ID 없음 — S3~S7 스킵"; FAIL=$((FAIL+5)); echo ""; echo "============================================================"; echo " 결과: PASS=$PASS / FAIL=$FAIL / 총 8건"; echo "============================================================"; exit 1; fi
ok "선택 캐릭터 ID=$CHAR_ID"

# ── S3: 학습자 등록 + 세션 시작 ──────────────────────────────────
echo ""
echo "▶ S3 학습자 등록 + 세션 시작 (POST /api/learners → POST /api/sessions)"
LEARNER_ID=$(curl -sf -X POST "$BASE/api/learners" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E테스트학습자","department":"QA팀","email":"e2e@test.com"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
if [ -n "$LEARNER_ID" ]; then ok "학습자 ID=$LEARNER_ID"; else fail "학습자 등록 실패"; FAIL=$((FAIL+1)); fi

SESSION_ID=$(curl -sf -X POST "$BASE/api/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"learner_id\":$LEARNER_ID,\"scenario_id\":2,\"character_id\":$CHAR_ID}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['session_id'])" 2>/dev/null || echo "")
if [ -n "$SESSION_ID" ]; then ok "세션 ID=$SESSION_ID"; else fail "세션 시작 실패"; FAIL=$((FAIL+1)); fi

# 선택 불가 캐릭터(card 1) 거부 확인
CONTEXT_CHAR_ID=$(echo "$S2" | python3 -c "import sys,json; chars=[c for c in json.load(sys.stdin) if not c['is_selectable']]; print(chars[0]['id'])" 2>/dev/null || echo "1")
REJECT_HTTP=$(curl -so /dev/null -w "%{http_code}" -X POST "$BASE/api/sessions" \
  -H "Content-Type: application/json" \
  -d "{\"learner_id\":$LEARNER_ID,\"scenario_id\":2,\"character_id\":$CONTEXT_CHAR_ID}" 2>/dev/null)
if [ "$REJECT_HTTP" = "400" ]; then ok "선택불가 캐릭터 400 거부 확인"; else fail "선택불가 캐릭터 거부 실패 (HTTP $REJECT_HTTP, 400 기대)"; fi

# ── S4: 채팅 5턴+ SSE ─────────────────────────────────────────────
echo ""
echo "▶ S4 채팅 5턴 SSE (POST /api/chat)"
if [ -z "$SESSION_ID" ]; then fail "SESSION_ID 없어 스킵"; else
  TURNS=("안녕하세요, 잠깐 시간 괜찮으신가요?" "데이터 검증 일정에 대해 논의하고 싶습니다." "팀에서 우선순위를 다시 조정할 수 있을 것 같은데요." "어떤 조건이 충족되면 협력이 가능할까요?" "지금 말씀하신 기준대로 정리해서 다시 찾아뵙겠습니다.")
  TURN_PASS=0
  for i in "${!TURNS[@]}"; do
    MSG="${TURNS[$i]}"
    RESPONSE=$(curl -sf -X POST "$BASE/api/chat" \
      -H "Content-Type: application/json" \
      -d "{\"session_id\":$SESSION_ID,\"user_message\":\"$MSG\"}" \
      --max-time 30 2>/dev/null || echo "")
    if echo "$RESPONSE" | grep -q '"done":true'; then
      TURN_PASS=$((TURN_PASS+1))
    fi
  done
  if [ "$TURN_PASS" -ge 5 ]; then ok "채팅 $TURN_PASS/5 턴 SSE done 확인"; else fail "채팅 $TURN_PASS/5 턴만 성공 (5 기대)"; fi
fi

# ── S5: 평가 ──────────────────────────────────────────────────────
echo ""
echo "▶ S5 평가 (POST /api/evaluate)"
if [ -z "$SESSION_ID" ]; then fail "SESSION_ID 없어 스킵"; else
  EVAL=$(curl -sf -X POST "$BASE/api/evaluate" \
    -H "Content-Type: application/json" \
    -d "{\"session_id\":$SESSION_ID}" \
    --max-time 60 2>/dev/null || echo "")
  if echo "$EVAL" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'total_score' in d" 2>/dev/null; then
    SCORE=$(echo "$EVAL" | python3 -c "import sys,json; print(json.load(sys.stdin).get('total_score','?'))" 2>/dev/null || echo "?")
    ok "평가 완료 total_score=$SCORE"
  else
    fail "평가 응답 이상 — $(echo "$EVAL" | head -c 200)"
  fi
fi

# ── S6: 단일 리포트 ───────────────────────────────────────────────
echo ""
echo "▶ S6 단일 리포트 (GET /api/sessions/:id/report)"
if [ -z "$SESSION_ID" ]; then fail "SESSION_ID 없어 스킵"; else
  REPORT=$(curl -sf "$BASE/api/sessions/$SESSION_ID/report" 2>/dev/null || echo "")
  if echo "$REPORT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'session' in d and 'evaluation' in d" 2>/dev/null; then
    ok "리포트 session+evaluation 필드 확인"
  else
    fail "리포트 응답 이상 — $(echo "$REPORT" | head -c 200)"
  fi
fi

# ── S7: 360도 비교 리포트 (2세션 필요) ───────────────────────────
echo ""
echo "▶ S7 360도 비교 리포트 (GET /api/sessions/compare)"
if [ -z "$LEARNER_ID" ]; then fail "LEARNER_ID 없어 스킵"; else
  # 2번째 세션 생성 + 1턴 + 평가
  SESSION2=$(curl -sf -X POST "$BASE/api/sessions" \
    -H "Content-Type: application/json" \
    -d "{\"learner_id\":$LEARNER_ID,\"scenario_id\":2,\"character_id\":$CHAR_ID}" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['session_id'])" 2>/dev/null || echo "")
  if [ -n "$SESSION2" ]; then
    curl -sf -X POST "$BASE/api/chat" -H "Content-Type: application/json" \
      -d "{\"session_id\":$SESSION2,\"user_message\":\"두 번째 도전 시작합니다.\"}" --max-time 30 > /dev/null 2>&1 || true
    curl -sf -X POST "$BASE/api/evaluate" -H "Content-Type: application/json" \
      -d "{\"session_id\":$SESSION2}" --max-time 60 > /dev/null 2>&1 || true
    COMPARE=$(curl -sf "$BASE/api/sessions/compare?learner_id=$LEARNER_ID&scenario_id=2" 2>/dev/null || echo "")
    if echo "$COMPARE" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d.get('sessions',[])) >= 2" 2>/dev/null; then
      SESS_COUNT=$(echo "$COMPARE" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['sessions']))" 2>/dev/null || echo "?")
      ok "비교 리포트 $SESS_COUNT세션 확인"
    else
      fail "비교 리포트 응답 이상 — $(echo "$COMPARE" | head -c 200)"
    fi
  else
    fail "2번째 세션 생성 실패"
  fi
fi

# ── S8: 관리자 CRUD + 인증 ─────────────────────────────────────────
echo ""
echo "▶ S8 관리자 CRUD + 인증 (GET /api/admin/scenarios)"
# 인증 없이 → 401 확인
UNAUTH=$(curl -so /dev/null -w "%{http_code}" "$BASE/api/admin/scenarios" 2>/dev/null)
if [ "$UNAUTH" = "401" ]; then ok "미인증 요청 401 거부 확인"; else fail "미인증 요청 HTTP $UNAUTH (401 기대)"; fi

# 인증 후 → 200
ADMIN_LIST=$(curl -sf -H "X-Admin-Token: $ADMIN_TOKEN" "$BASE/api/admin/scenarios" 2>/dev/null || echo "")
if echo "$ADMIN_LIST" | python3 -c "import sys,json; json.load(sys.stdin)" 2>/dev/null; then
  ok "관리자 인증 + 시나리오 목록 정상"
else
  fail "관리자 API 응답 이상 — $(echo "$ADMIN_LIST" | head -c 200)"
fi

# 시나리오 생성 → 삭제
NEW_ID=$(curl -sf -X POST "$BASE/api/admin/scenarios" \
  -H "Content-Type: application/json" -H "X-Admin-Token: $ADMIN_TOKEN" \
  -d '{"title":"E2E임시시나리오","case_name":"테스트","context_description":"e2e테스트용","learner_role":"팀장"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null || echo "")
if [ -n "$NEW_ID" ]; then
  DEL_HTTP=$(curl -so /dev/null -w "%{http_code}" -X DELETE \
    -H "X-Admin-Token: $ADMIN_TOKEN" "$BASE/api/admin/scenarios/$NEW_ID" 2>/dev/null)
  if [ "$DEL_HTTP" = "200" ]; then ok "관리자 시나리오 생성($NEW_ID) + 삭제 확인"; else fail "삭제 HTTP $DEL_HTTP (200 기대)"; fi
else
  fail "관리자 시나리오 생성 실패"
fi

# ── 결과 요약 ─────────────────────────────────────────────────────
echo ""
echo "============================================================"
echo " 결과: PASS=$PASS / FAIL=$FAIL / 총 $((PASS+FAIL))건"
if [ "$FAIL" -eq 0 ]; then
  echo " 🎉 전체 통과"
else
  echo " ⚠️  $FAIL건 실패 — 수정 후 재실행 필요"
fi
echo "============================================================"
