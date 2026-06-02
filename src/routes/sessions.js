import { Router } from 'express';
import { getCharacter } from '../data-store/scenarios-store.js';
import {
  upsertLearner, createSession, getSession,
  addMessage, getMessages, incrementTurnCount, completeSession,
} from '../data-store/sessions-store.js';
import { saveEvaluation } from '../data-store/eval-store.js';
import { invokeChat, invokeEvaluate } from '../services/bedrock-service.js';

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

// 채팅 (SSE 스트리밍) — A안: target_character_id 지목 방식
router.post('/chat', async (req, res) => {
  const { session_id, message, user_message, target_character_id } = req.body;
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

  // 대화 대상 캐릭터 결정 (A안: 지목 → 첫 파트너 fallback → 구형 character_id fallback)
  let targetCharId;
  if (target_character_id) {
    targetCharId = Number(target_character_id);
  } else if (session.dialogue_partner_ids) {
    const partners = typeof session.dialogue_partner_ids === 'string'
      ? JSON.parse(session.dialogue_partner_ids)
      : session.dialogue_partner_ids;
    targetCharId = partners[0];
  } else {
    targetCharId = session.character_id;
  }

  if (!targetCharId) {
    return res.status(400).json({ error: '대화 대상 캐릭터를 특정할 수 없음' });
  }

  const turn = session.turn_count + 1;
  await addMessage({ session_id, role: 'user', content: userMsg, turn_number: turn });
  await incrementTurnCount(session_id);

  // SSE 헤더
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';
  try {
    const char = await getCharacter(targetCharId);
    const history = await getMessages(session_id);
    const messages = history.map(m => ({ role: m.role, content: m.content }));

    // v3: 학습자 캐릭터 정보를 시스템 프롬프트에 추가 — 이름 환각 방지
    let systemPrompt = char.persona_prompt;
    if (session.learner_character_id) {
      const learnerChar = await getCharacter(session.learner_character_id);
      if (learnerChar) {
        systemPrompt = `${char.persona_prompt}

---

[대화 맥락 — 반드시 준수]
지금 당신과 대화하는 상대는 ${learnerChar.name}(${learnerChar.role_level})입니다.
상대를 "${learnerChar.name}" 또는 "${learnerChar.role_level}"로 호칭하십시오. 임의로 이름을 지어내지 마십시오.`;
      }
    }

    for await (const chunk of invokeChat(messages, systemPrompt)) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ token: chunk })}\n\n`);
    }

    await addMessage({ session_id, role: 'assistant', content: fullResponse, turn_number: turn });
    res.write(`data: ${JSON.stringify({ done: true, character_id: targetCharId })}\n\n`);
  } catch (err) {
    console.error('[POST /api/chat]', err.message);
    res.write(`data: ${JSON.stringify({ error: 'AI 응답 오류' })}\n\n`);
  } finally {
    res.end();
  }
});

// 평가
router.post('/evaluate', async (req, res) => {
  const { session_id } = req.body;
  if (!session_id) return res.status(400).json({ error: 'session_id 필수' });

  try {
    const session = await getSession(session_id);
    if (!session) return res.status(404).json({ error: '세션 없음' });

    const messages = await getMessages(session_id);
    const transcript = messages
      .map(m => `[${m.role === 'user' ? '학습자' : 'AI'}] ${m.content}`)
      .join('\n');

    const evalPrompt = `다음 대화를 평가하고 JSON 형식으로 결과를 반환하세요.
형식: {"scores": {"커뮤니케이션": 0.8, "문제해결": 0.7}, "feedback": {"strengths": [], "improvements": [], "overall": ""}, "total_score": 0.75, "grade": "B"}`;

    const result = await invokeEvaluate(transcript, evalPrompt);
    const total = result.total_score ?? 0;
    const grade = result.grade ?? (total >= 0.9 ? 'A' : total >= 0.7 ? 'B' : 'C');

    await saveEvaluation({
      session_id,
      scores: result.scores ?? {},
      feedback: result.feedback ?? {},
      total_score: total,
      grade,
    });
    await completeSession(session_id);

    res.json({ ...result, session_id });
  } catch (err) {
    console.error('[POST /api/evaluate]', err.message);
    res.status(500).json({ error: '평가 오류' });
  }
});

export default router;
