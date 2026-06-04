import { Router } from 'express';
import { getCharacter, getScenario, getCharacters } from '../data-store/scenarios-store.js';
import {
  upsertLearner, createSession, getSession,
  addMessage, getMessages, incrementTurnCount, completeSession,
} from '../data-store/sessions-store.js';
import { saveEvaluation } from '../data-store/eval-store.js';
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

    // 과다응답 제한: 4명 이상이면 상위 3명
    if (selectedIds.length > 3) {
      selectedIds = selectedIds.slice(0, 3);
      console.log('[CHAT] 과다응답 제한: 상위 3명만 선택');
    }

    // 유효한 파트너 ID만 필터
    selectedIds = selectedIds.filter(id => charMap.has(id));
    if (!selectedIds.length) selectedIds = [partnerIds[0]];

    // ② 선별된 캐릭터별 순차 SSE 스트리밍
    const chatHistory = history.map(m => ({ role: m.role, content: m.content }));

    for (const charId of selectedIds) {
      const char = charMap.get(charId);
      if (!char) continue;

      // 응답 시작 이벤트 (기안84 타이핑 인디케이터용)
      res.write(`data: ${JSON.stringify({ character_id: charId, character_name: char.name })}\n\n`);

      // 시스템 프롬프트 구성
      let systemPrompt = char.persona_prompt;
      if (learnerChar) {
        systemPrompt = `${char.persona_prompt}

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

      // Bedrock Messages API: 마지막 메시지는 반드시 user — 이전 캐릭터 응답(assistant) 추가 후 user 재추가
      if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'assistant') {
        chatHistory.push({ role: 'user', content: userMsg });
      }

      let fullResponse = '';
      for await (const chunk of invokeChat(chatHistory, systemPrompt)) {
        fullResponse += chunk;
        res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
      }

      // DB 저장 (character_id 포함)
      await addMessage({ session_id, role: 'assistant', content: fullResponse, turn_number: turn, character_id: charId });

      // 응답 완료 이벤트
      res.write(`data: ${JSON.stringify({ done: true, character_id: charId })}\n\n`);

      // 다음 캐릭터 응답 context: 현재 응답 포함 (assistant로 끝남 → 다음 루프 시작에서 user 재추가)
      chatHistory.push({ role: 'assistant', content: fullResponse });
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

  return `당신은 기업 리더십 교육 전문 평가관입니다. 아래 대화를 평가하세요.

[시나리오] ${title}
[상황] ${context}
[학습자 역할] ${learnerLabel}
[대화 상대 캐릭터]
${partnerDesc}

[역량 5축 정의 및 행동 기준]
- 경청과공감 (0.0~1.0): 상대 감정·상황을 인식하고 공감하는 발화
  · 1.0: 감정 명시적 반영 + 상황 재진술 + 입장 인정 발화 2회+
  · 0.5: 피상적 공감 또는 상황 인식만
  · 0.0: 공감 표현 없음, 일방적 지시·요구
- 이해관계조정 (0.0~1.0): 서로 다른 입장 파악 후 절충 시도
  · 1.0: 상대 이해관계 명시적 언급 + 공통점 탐색 + 조율안 제시
  · 0.5: 이해관계 파악만 하거나 절충 시도만
  · 0.0: 일방적 주장, 상대 입장 무시
- 목표설정지원 (0.0~1.0): 공동 목표 제시 또는 합의 유도
  · 1.0: 구체적 목표(수치/기한) 포함 합의 유도 발화
  · 0.5: 방향성 제시만 또는 막연한 합의
  · 0.0: 목표 언급 없음
- 동기부여소통 (0.0~1.0): 상대 동기·의지를 높이는 발화
  · 1.0: 상대 강점 인정 + 기여 가치 표현 + 구체적 지지 발화
  · 0.5: 격려 또는 지지 중 1가지만
  · 0.0: 동기부여 시도 없음
- 갈등조율 (0.0~1.0): 갈등 장면에서 건설적 전환 시도
  · 1.0: 갈등 원인 명시 + 양측 입장 수용 + 전환 방향 제안
  · 0.5: 갈등 인식 후 완화 시도만
  · 0.0: 갈등 심화 발화 또는 회피

[채점 기준]
- R-26 (0~15점): 5축 합계(0.0~5.0) × 3 (소수점 1자리)
- R-27 (0~5점): 셀프 러닝 품질
  · 완결성(1점): 3턴+ 이상 논리적 흐름 유지
  · 자기인식(1점): 역할 특성·미션 발화에 반영
  · 직군 시각(1점): 선택 직책(${learnerLabel})의 관점이 발화에 구체적으로 드러남
  · 재도전 의지(1점): 성찰적 발화 또는 개선 의지 표현
  · 독립 학습 가능성(1점): 가이드 없이도 다음 시도에서 개선 가능한 패턴
- R-28 (0~5점): AI 캐릭터 페르소나 일관성 + 감정 단계 변화 반영도
- total_score = R-26 + R-27 + R-28 (최대 25점)
- grade 기준: 됐어!(≥23.75) / 아쉽지만...(≥20) / 느낌이 안 와(<20)

[다음 도전 후보 — next_challenges 에서만 선택]
${challengeList}

반드시 아래 JSON 형식으로만 응답하세요 (마크다운 코드블록 포함, JSON 외 텍스트 절대 금지):
\`\`\`json
{
  "scores": {
    "r26": <0~15, 소수점 1자리>,
    "r27": <0~5, 소수점 1자리>,
    "r28": <0~5, 소수점 1자리>,
    "axes": {
      "경청과공감": <0.0~1.0>,
      "이해관계조정": <0.0~1.0>,
      "목표설정지원": <0.0~1.0>,
      "동기부여소통": <0.0~1.0>,
      "갈등조율": <0.0~1.0>
    }
  },
  "feedback": {
    "overall": "<종합 피드백 2~3문장>",
    "highlight_positive": [
      {"turn": <발화 순서번호>, "quote": "<실제 학습자 발화 인용>", "reason": "<칭찬 이유>"}
    ],
    "highlight_improve": [
      {"turn": <발화 순서번호>, "quote": "<실제 학습자 발화 인용>", "reason": "<개선 이유>"}
    ],
    "emotion_track": [
      {"character": "<캐릭터 이름>", "stages_reached": ["방어","저항"], "final_stage": "<최종 도달 단계>", "reached_at_turn": <발화번호>}
    ],
    "next_challenges": [
      {
        "character_name": "<위 목록에서 이름>",
        "reason": "<추천 이유>",
        "difficulty": "<상|중|하>",
        "job_perspective": "<이 직책 관점에서 배울 리더십 핵심 1문장>"
      }
    ],
    "self_learning": {
      "reflection_question": "<이번 대화를 돌아보는 자기 성찰 질문 1가지>",
      "key_learning": "<이번 대화에서 가장 중요한 배움 1문장>",
      "retry_tip": "<다음 시도 시 집중할 구체적 행동 1가지>"
    }
  },
  "total_score": <r26+r27+r28 합산>,
  "grade": "<됐어!|아쉽지만...|느낌이 안 와>"
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

    const scores = result.scores ?? {};
    const r26 = Number(scores.r26) || 0;
    const r27 = Number(scores.r27) || 0;
    const r28 = Number(scores.r28) || 0;
    const total = parseFloat((r26 + r27 + r28).toFixed(2));
    const grade = total >= 23.75 ? '됐어!' : total >= 20 ? '아쉽지만...' : '느낌이 안 와';

    await saveEvaluation({
      session_id,
      scores,
      feedback: result.feedback ?? {},
      total_score: total,
      grade,
    });
    await completeSession(session_id);

    res.json({ scores, feedback: result.feedback ?? {}, total_score: total, grade, session_id });
  } catch (err) {
    console.error('[POST /api/evaluate]', err.message);
    res.status(500).json({ error: '평가 오류' });
  }
});

export default router;
