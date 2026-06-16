import { Router } from 'express';
import { getCharacter, getScenario, getCharacters } from '../data-store/scenarios-store.js';
import {
  upsertLearner, createSession, getSession,
  addMessage, getMessages, incrementTurnCount, completeSession,
} from '../data-store/sessions-store.js';
import { saveEvaluation, getLearnerHistory } from '../data-store/eval-store.js';
import { invokeChat, invokeEvaluate, invokeSelectResponders } from '../services/bedrock-service.js';

const router = Router();

// 학습자 등록 (upsert)
router.post('/learners', async (req, res) => {
  const { name, department, email } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name, email 필수' });
  try {
    const id = await upsertLearner({ name, department, email });
    res.json({ id });
  } catch (err) {
    console.error('[POST /api/learners]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 세션 시작 — Phase C v3 (learner_character_id + dialogue_partner_ids) 및 구형 (character_id) 지원
router.post('/sessions', async (req, res) => {
  const { learner_id, scenario_id, character_id, learner_character_id, dialogue_partner_ids } = req.body;
  if (!learner_id || !scenario_id) {
    return res.status(400).json({ error: 'learner_id, scenario_id 필수' });
  }
  try {
    if (learner_character_id) {
      // v3 모드: 학습자가 캐릭터를 연기하는 방식
      const partners = Array.isArray(dialogue_partner_ids)
        ? dialogue_partner_ids
        : String(dialogue_partner_ids || '').split(',').map(Number).filter(Boolean);
      if (!partners.length) {
        return res.status(400).json({ error: 'dialogue_partner_ids 필수' });
      }
      const learnerChar = await getCharacter(learner_character_id);
      if (!learnerChar) return res.status(404).json({ error: '학습자 캐릭터 없음' });

      const session_id = await createSession({
        learner_id, scenario_id, learner_character_id, dialogue_partner_ids: partners,
      });
      res.json({ session_id });
    } else {
      // v2 구형 모드
      if (!character_id) {
        return res.status(400).json({ error: 'character_id 또는 learner_character_id 필수' });
      }
      const char = await getCharacter(character_id);
      if (!char) return res.status(404).json({ error: '캐릭터 없음' });

      const session_id = await createSession({ learner_id, scenario_id, character_id });
      res.json({ session_id });
    }
  } catch (err) {
    console.error('[POST /api/sessions]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 세션 메시지 조회 — Phase E B안 평가 검증용
router.get('/sessions/:id/messages', async (req, res) => {
  const sessionId = Number(req.params.id);
  if (!sessionId) return res.status(400).json({ error: 'session id 필수' });
  try {
    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: '세션 없음' });
    const messages = await getMessages(sessionId);
    res.json({ session_id: sessionId, messages });
  } catch (err) {
    console.error('[GET /api/sessions/:id/messages]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 캐릭터별 관점 chatHistory 구성 (그룹 토론 화자 라벨·인접쌍 패턴)
// 본인 발화 = assistant / 학습자·다른 참석자 = user(화자 라벨) / 연속 user는 1블록 병합
// → 앞 캐릭터 발언을 assistant로 주입하던 결함(자기 말로 인식) 제거
function buildPerspectiveHistory({ history, currentCharId, charMap, learnerLabel, turnSpeeches, multiParty }) {
  const msgs = [];
  for (const m of history) {
    if (m.role === 'assistant' && m.character_id === currentCharId) {
      msgs.push({ role: 'assistant', content: m.content });
    } else if (m.role === 'assistant') {
      const c = charMap.get(m.character_id);
      const label = c ? `${c.name}(${c.role_level})` : '참석자';
      msgs.push({ role: 'user', content: `[${label}]: ${m.content}` });
    } else {
      // 학습자 발언 (다자 토론일 때만 라벨 — 1:1 회귀 0)
      msgs.push({ role: 'user', content: multiParty ? `[${learnerLabel}]: ${m.content}` : m.content });
    }
  }
  for (const sp of turnSpeeches) {
    msgs.push({ role: 'user', content: `[${sp.label}]: ${sp.content}` });
  }
  return mergeConsecutiveUser(msgs);
}

// 연속 user 메시지 1블록 병합 (Bedrock Messages API: 연속 동일 role / final must be user 회피)
function mergeConsecutiveUser(msgs) {
  const out = [];
  for (const m of msgs) {
    const last = out[out.length - 1];
    if (m.role === 'user' && last && last.role === 'user') {
      last.content += `\n\n${m.content}`;
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

// 채팅 (SSE 스트리밍) — Phase E B안: LLM 맥락 선별 + 순차 응답
router.post('/chat', async (req, res) => {
  const { session_id, message, user_message } = req.body;
  const userMsg = message || user_message;
  if (!session_id || !userMsg) {
    return res.status(400).json({ error: 'session_id, message 필수' });
  }

  let session;
  try {
    session = await getSession(session_id);
    if (!session) return res.status(404).json({ error: '세션 없음' });
    if (session.status !== 'active') return res.status(400).json({ error: '종료된 세션' });
  } catch {
    return res.status(500).json({ error: 'DB 오류' });
  }

  // 파트너 목록 파싱
  const partnerIds = session.dialogue_partner_ids
    ? (typeof session.dialogue_partner_ids === 'string'
        ? JSON.parse(session.dialogue_partner_ids)
        : session.dialogue_partner_ids)
    : (session.character_id ? [session.character_id] : []);

  if (!partnerIds.length) {
    return res.status(400).json({ error: '대화 파트너 없음' });
  }

  const turn = session.turn_count + 1;
  await addMessage({ session_id, role: 'user', content: userMsg, turn_number: turn, character_id: null });
  await incrementTurnCount(session_id);

  // SSE 헤더
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const history  = await getMessages(session_id);
    const allChars = await Promise.all(partnerIds.map(id => getCharacter(id)));
    const charMap  = new Map(allChars.filter(Boolean).map(c => [c.id, c]));

    let learnerChar = null;
    if (session.learner_character_id) {
      learnerChar = await getCharacter(session.learner_character_id);
    }

    // ① B안 선별 LLM: 반응할 캐릭터 ID 배열 결정
    let selectedIds = await invokeSelectResponders({
      userMessage: userMsg,
      characters: allChars.filter(Boolean).map(c => ({
        id: c.id, name: c.name, role_level: c.role_level, core_mindset: c.core_mindset,
      })),
      history: history.slice(-6),
    });

    // 과소응답 fallback: 0명이면 첫 번째 파트너
    if (selectedIds.length === 0) {
      selectedIds = [partnerIds[0]];
      console.log('[CHAT] fallback: 0명 선별 → 첫 파트너', partnerIds[0]);
    }

    // 비용 상한 = 세션 선택 파트너 전원(자연 상한·합의 2026-06-11). 토론성 발화 시 전원 응답 허용 — 인위적 cap 제거.

    // 유효한 파트너 ID만 필터
    selectedIds = selectedIds.filter(id => charMap.has(id));
    if (!selectedIds.length) selectedIds = [partnerIds[0]];

    // ② 선별된 캐릭터별 순차 SSE 스트리밍
    // 다자(파트너 2명+) = 그룹 토론 모드: 화자 라벨 + 관점 chatHistory. 1:1이면 기존 흐름 유지(회귀 0).
    const multiParty = partnerIds.length > 1;
    const learnerLabel = learnerChar ? `${learnerChar.name}(${learnerChar.role_level})` : '학습자';
    const turnSpeeches = []; // 같은 턴 내 앞 캐릭터 발언 [{ label, content }]

    for (const charId of selectedIds) {
      const char = charMap.get(charId);
      if (!char) continue;

      // 응답 시작 이벤트 (기안84 타이핑 인디케이터용)
      res.write(`data: ${JSON.stringify({ character_id: charId, character_name: char.name })}\n\n`);

      // 시스템 프롬프트 구성
      let systemPrompt = char.persona_prompt;
      if (learnerChar) {
        systemPrompt += `

---

[대화 맥락 — 반드시 준수]
지금 당신과 대화하는 상대는 ${learnerChar.name}(${learnerChar.role_level})입니다.
상대를 "${learnerChar.name}" 또는 "${learnerChar.role_level}"로 호칭하십시오. 임의로 이름을 지어내지 마십시오.`;

        if (learnerChar.learner_detail) {
          const detail = typeof learnerChar.learner_detail === 'string'
            ? JSON.parse(learnerChar.learner_detail) : learnerChar.learner_detail;
          if (detail?.inner_conflict) {
            systemPrompt += `\n\n[상대방 숨겨진 심리 — 반응에만 반영, 직접 언급 금지]\n${detail.inner_conflict}`;
          }
        }
      }

      // 그룹 토론 지시 (다자 세션에서만 — 1:1 회귀 0)
      if (multiParty) {
        const others = allChars
          .filter(c => c && c.id !== charId)
          .map(c => `${c.name}(${c.role_level})`)
          .join(', ');
        systemPrompt += `

---

[그룹 토론 — 반드시 준수]
지금 여러 참석자가 함께 있는 자리입니다. 다른 참석자: ${others}.
- 대화에서 "[이름(직책)]:" 형식으로 시작하는 발언은 다른 참석자의 발언이고, 라벨 없는 발언은 ${learnerLabel}(상대)의 발언입니다.
- 다른 참석자의 발언에 대해 당신의 입장(core_mindset·역할·이해관계·갈등 관계)에 따라 동의·반박·조건부 수용을 분명히 하며 반응하십시오. 당신의 입장은 일관되게 유지하고, 다른 사람 의견에 무비판적으로 동조하지 마십시오.
- 당신의 찬반·입장을 "저는 반대합니다" 같은 메타 라벨로 선언하지 말고, 구체적 근거가 담긴 자연스러운 발언으로만 드러내십시오.
- **발언은 2~4문장으로 짧게 하십시오. 한 번에 한 가지 쟁점만 말하고, 하고 싶은 말이 더 있어도 다음 차례로 미루십시오. 회의에서 혼자 길게 연설하지 않습니다 — 짧게 주고받는 것이 토론입니다.**`;
      }

      // 절대 규칙 가드: 괄호 지문·마크다운 금지
      systemPrompt += `\n\n---\n\n[발화 형식 — 반드시 준수]\n무대 지시·괄호 지문(*(...)* 형식) 절대 금지. 마크다운(#·**·---·*기울임*) 절대 금지. 순수 대화체로만 발화하십시오.`;

      // 관점 chatHistory: 본인 발화=assistant / 학습자·다른 참석자=user(라벨) / 연속 user 1블록 병합
      // → 앞 캐릭터 발언을 assistant로 주입하던 결함(자기 말로 인식) 제거 + Bedrock "final must be user" 회피
      const perspective = buildPerspectiveHistory({
        history, currentCharId: charId, charMap, learnerLabel, turnSpeeches, multiParty,
      });

      // 토론(다자)은 짧게 — max_tokens 512(2~4문장 여유·잘림 방지) / 1:1은 1024(롤플레잉 깊이 유지)
      let fullResponse = '';
      for await (const chunk of invokeChat(perspective, systemPrompt, multiParty ? 512 : 1024)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
      }

      // DB 저장 (character_id 포함)
      await addMessage({ session_id, role: 'assistant', content: fullResponse, turn_number: turn, character_id: charId });

      // 응답 완료 이벤트
      res.write(`data: ${JSON.stringify({ done: true, character_id: charId })}\n\n`);

      // 같은 턴 다음 캐릭터에게 화자 라벨과 함께 전달 (user 라벨 주입용)
      turnSpeeches.push({ label: `${char.name}(${char.role_level})`, content: fullResponse });
    }

  } catch (err) {
    console.error('[POST /api/chat]', err.message);
    res.write(`data: ${JSON.stringify({ error: 'AI 응답 오류' })}\n\n`);
  } finally {
    res.end();
  }
});

// ── 평가 헬퍼 ──

function buildTranscript(messages, learnerChar, partnerChars) {
  const learnerLabel = learnerChar
    ? `${learnerChar.name}(${learnerChar.role_level})`
    : '학습자';
  const charMap = new Map(partnerChars.map(c => [c.id, c]));
  return messages.map((m, i) => {
    let label;
    if (m.role === 'user') {
      label = learnerLabel;
    } else {
      const c = charMap.get(m.character_id);
      label = c ? `${c.name}(${c.role_level})` : 'AI 파트너';
    }
    return `[${label}](${i + 1}번 발화)\n${m.content}`;
  }).join('\n\n---\n\n');
}

function buildEvalPrompt(scenario, learnerChar, partnerChars, selectableChars) {
  const multiParty = partnerChars.length > 1;
  const title   = scenario?.title ?? '(미지정)';
  const context = scenario?.context_description ?? '';
  const learnerLabel = learnerChar
    ? `${learnerChar.name}(${learnerChar.role_level})`
    : '그룹장';

  const partnerDesc = partnerChars.length
    ? partnerChars.map(c => `  - ${c.name}(${c.role_level}): ${c.core_mindset ?? ''}`).join('\n')
    : '  (정보 없음)';

  const others = selectableChars.filter(c => !partnerChars.find(p => p.id === c.id));
  const challengeList = others.length
    ? others.map(c => `  - ${c.name}(${c.role_level})`).join('\n')
    : '  (추가 캐릭터 없음)';

  // 세션 타입 분기 — 다자 토론 5축 / 1:1 코칭 5축 (박진영 루브릭 §1·§2)
  const axesDef = multiParty
    ? `[다자 토론 5축 — transcript 행동 증거로 단계(탁월/안정적/발전중) 판정 · 학습자 발화만 채점]
- 입장파악력: 각 참석자 입장·이해관계를 정확히 지칭·재진술 (증거: 정확 재진술 수·오귀속 수)
  · 탁월: 전원 입장 정확 재진술·오귀속 0 / 안정적: 과반 반영·오귀속 0 / 발전중: 일부만 또는 오귀속 1+
- 조율중재력: 대립 입장 간 공통분모·절충안 제시 (증거: 공통점 명시·절충안 수)
  · 탁월: 공통분모 + 구체 절충안(조건·기한) / 안정적: 절충 시도 1+ (구체성 부족) / 발전중: 한쪽 편들기·방치
- 설득영향력: 근거 기반 주장·반박에 재논거 (증거: 근거 주장 수·무근거 단정 수·반박 수용 후 재논거 수)
  · 탁월: 근거 + 반박 인정→재논거 / 안정적: 근거 있으나 반박 대응 약함 / 발전중: 무근거·반박 회피/굴복
- 발언타이밍: 적절한 개입 시점·흐름 관리 (증거: 턴 분포·쟁점 전환/정리 발화)
  · 탁월: 쟁점 정점 개입 + 정리·전환 / 안정적: 고른 참여(관리 부족) / 발전중: 독점 또는 방관
- 관계인식: 직책·갈등 관계 고려한 발화 조절 (증거: 직책 호칭·체면 보존·공개 자리 조절)
  · 탁월: 관계 구도 반영 + 체면 보존 / 안정적: 호칭·예법 정확(활용 부족) / 발전중: 상하 무시·공개 면박`
    : `[1:1 코칭 5축 — transcript 행동 증거로 단계(탁월/안정적/발전중) 판정 · 학습자 발화만 채점]
- 경청과공감: 상대 감정·상황 인식·공감 (탁월: 감정 반영+상황 재진술+입장 인정 2회+ / 안정적: 피상적 공감 또는 상황 인식만 / 발전중: 공감 없음·일방적)
- 이해관계조정: 입장 파악 후 절충 (탁월: 이해관계 명시+공통점+조율안 / 안정적: 파악만 또는 절충만 / 발전중: 일방적 주장)
- 목표설정지원: 공동 목표·합의 유도 (탁월: 구체 목표(수치/기한) 합의 유도 / 안정적: 방향성만 / 발전중: 목표 없음)
- 동기부여소통: 상대 동기·의지 제고 (탁월: 강점 인정+기여 가치+지지 / 안정적: 격려·지지 중 1 / 발전중: 시도 없음)
- 갈등조율: 갈등 건설적 전환 (탁월: 원인 명시+양측 수용+전환 제안 / 안정적: 완화 시도만 / 발전중: 심화·회피)`;

  // 캐릭터별 비교 + 도달 감정 단계 (R-28-3·박진영 A안: final_stage 결합·emotion_track 섹션 대체)
  // 1:1도 단일 entry로 통일 — 감정 단계 데이터 보존(OIS [영향] 참조·점프 0 게이트)
  // 캐릭터마다 5축 전부 출력 — 해당 캐릭터와의 상호작용에 행동 증거 없는 축은 "관찰부족"(임의 판정 금지·증거 없는 판정 0)
  const compBlock = `\n  "character_comparison": [
    {"character": "<참석자 이름>", "final_stage": "<방어|저항|수용>", "axis_levels": [{"key": "<위 5축 전부>", "level": "탁월|안정적|발전중|관찰부족"}]}
  ],`;

  return `당신은 기업 리더십 교육 전문 평가관입니다. 아래 대화를 평가하세요. 관대화 금지 — 행동 증거가 없으면 발전중입니다.

[시나리오] ${title}
[상황] ${context}
[학습자 역할] ${learnerLabel}
[대화 상대 캐릭터]
${partnerDesc}

${axesDef}

[채점 원칙 — 반드시 준수]
1. 채점 단위 = 학습자(${learnerLabel}) 발화만. AI 발화는 평가 대상 아님.
2. 각 축은 transcript의 셀 수 있는 행동 증거로만 판정 (내면 상태·인상 채점 금지).
3. 숫자 점수를 내지 말고 각 축의 단계(탁월/안정적/발전중)만 판정. 행동 증거 개수를 evidence에 명시.
4. R-27(0~5): 셀프러닝(완결성·자기인식·직군시각(${learnerLabel} 관점)·재도전의지·독립학습 각 1점) / R-28(0~5): AI 페르소나 일관성·감정 단계 반영도.

[OIS 피드백 규칙]
- 개선점 최소 2건: 각 건 = [관찰: 실제 학습자 발화 인용 + turn 번호] → [영향: 그 발화가 토론·상대에 미친 영향] → [제안: "~하라" 행동 동사 대안 발화 1개 + 재연습 시나리오/캐릭터 추천]
- 강점 최소 2건: [인용 + turn] + [어떤 축의 어떤 행동 증거였나] + [유지·확장 행동 1줄]
- 인용은 반드시 실제 transcript에 존재하는 발화 + 정확한 turn 번호 (환각 금지).

[다음 도전 후보 — next_challenges 에서만 선택]
${challengeList}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 포함, JSON 외 텍스트 절대 금지):
\`\`\`json
{
  "axes": [
    {"key": "<축명>", "level": "탁월|안정적|발전중", "evidence": "<행동 증거 개수·근거>", "behavior_note": "<학습자에게 보일 행동 서술 1문장>"}
  ],
  "r27": <0~5, 소수점 1자리>,
  "r28": <0~5, 소수점 1자리>,
  "strengths": [
    {"turn": <번호>, "quote": "<실제 발화>", "axis": "<축명>", "why": "<어떤 행동 증거>", "keep": "<유지·확장 1줄>"}
  ],
  "improvements": [
    {"observation": {"turn": <번호>, "quote": "<실제 발화>"}, "impact": "<영향>", "suggestion": {"alternative": "<행동 동사 대안 발화>", "replay_scenario": "<재연습 추천>"}}
  ],${compBlock}
  "next_challenges": [
    {"character_name": "<위 목록 이름>", "reason": "<추천 이유>", "difficulty": "<상|중|하>", "job_perspective": "<이 직책에서 배울 리더십 1문장>"}
  ],
  "overall_note": "<학습자용 종합 1~2문장 (메타 용어·점수 없이)>"
}
\`\`\``;
}

// 평가
router.post('/evaluate', async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id 필수' });

  try {
    const session = await getSession(session_id);
    if (!session) return res.status(404).json({ error: '세션 없음' });

    const messages = await getMessages(session_id);
    const scenario = await getScenario(session.scenario_id);

    let learnerChar = null;
    let partnerChars = [];
    let selectableChars = [];

    if (session.learner_character_id) {
      const [lc, allChars] = await Promise.all([
        getCharacter(session.learner_character_id),
        getCharacters(session.scenario_id),
      ]);
      learnerChar = lc;
      const partnerIds = typeof session.dialogue_partner_ids === 'string'
        ? JSON.parse(session.dialogue_partner_ids)
        : (session.dialogue_partner_ids || []);
      const charMap = new Map(allChars.map(c => [c.id, c]));
      partnerChars = partnerIds.map(id => charMap.get(id)).filter(Boolean);
      selectableChars = allChars.filter(c => c.is_selectable);
    } else if (session.character_id) {
      const char = await getCharacter(session.character_id);
      if (char) partnerChars = [char];
    }

    const transcript = buildTranscript(messages, learnerChar, partnerChars);
    const evalPrompt = buildEvalPrompt(scenario, learnerChar, partnerChars, selectableChars);
    const result = await invokeEvaluate(transcript, evalPrompt, 4096);

    const multiParty = partnerChars.length > 1;
    // LLM 단계 판정 → R-26 백엔드 결정적 환산 (탁월 1.0·안정 0.6·발전중 0.2 × 3·단일 소스·#54)
    const LEVEL_VAL = { '탁월': 1.0, '안정적': 0.6, '발전중': 0.2 };
    const axes = Array.isArray(result.axes) ? result.axes : [];
    const r26 = parseFloat((axes.reduce((s, a) => s + (LEVEL_VAL[a.level] ?? 0.2), 0) * 3).toFixed(1));
    const r27 = Number(result.r27) || 0;
    const r28 = Number(result.r28) || 0;
    const total = parseFloat((r26 + r27 + r28).toFixed(2));
    const grade = total >= 23.75 ? '됐어!' : total >= 20 ? '아쉽지만...' : '느낌이 안 와';
    // 종합 학습자 레벨 — 분포 규칙 (박진영 §3): 탁월 4+ → 탁월 / 탁월+안정 4+ → 안정적 / 그 외 발전중
    const cnt = axes.reduce((a, x) => { a[x.level] = (a[x.level] || 0) + 1; return a; }, {});
    const overall_level = (cnt['탁월'] || 0) >= 4 ? '탁월'
      : ((cnt['탁월'] || 0) + (cnt['안정적'] || 0)) >= 4 ? '안정적' : '발전중';

    // 내부 점수(게이트 보존) / 학습자 노출 데이터 분리 저장 (schema_version 2)
    const scores = {
      schema_version: 2,
      session_type: multiParty ? 'multi' : 'single',
      r26, r27, r28,
      axes: axes.map(a => ({ key: a.key, level: a.level })),
    };
    const feedback = {
      overall_level,
      overall_note: result.overall_note ?? '',
      axes,
      strengths: result.strengths ?? [],
      improvements: result.improvements ?? [],
      character_comparison: result.character_comparison ?? [],
      next_challenges: result.next_challenges ?? [],
    };
    await saveEvaluation({ session_id, scores, feedback, total_score: total, grade });
    await completeSession(session_id);

    // grade(내부 판정 어휘)는 API 응답 비노출 — DB에는 게이트용 저장 유지 (박진영 권고)
    res.json({ schema_version: 2, session_type: scores.session_type, overall_level, session_id });
  } catch (err) {
    console.error('[POST /api/evaluate]', err.message);
    res.status(500).json({ error: '평가 오류' });
  }
});

// 학습자 다회차 성장 이력 (C안)
router.get('/learners/:id/history', async (req, res) => {
  const learnerId  = Number(req.params.id);
  const scenarioId = Number(req.query.scenario_id);
  if (!learnerId || !scenarioId) {
    return res.status(400).json({ error: 'learner_id, scenario_id 필수' });
  }
  try {
    const rows   = await getLearnerHistory(learnerId, scenarioId);
    const rounds = rows.map((r, i) => ({
      round:      i + 1,
      session_id: r.session_id,
      started_at: r.started_at,
      total_score: r.total_score,
      grade:      r.grade,
      scores:     typeof r.scores === 'string' ? JSON.parse(r.scores) : r.scores,
    }));
    res.json({ learner_id: learnerId, scenario_id: scenarioId, rounds });
  } catch (err) {
    console.error('[GET /api/learners/:id/history]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

export default router;
