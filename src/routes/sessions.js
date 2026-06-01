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

// 세션 시작
router.post('/sessions', async (req, res) => {
  const { learner_id, scenario_id, character_id } = req.body;
  if (!learner_id || !scenario_id || !character_id) {
    return res.status(400).json({ error: 'learner_id, scenario_id, character_id 필수' });
  }
  try {
    const char = await getCharacter(character_id);
    if (!char) return res.status(404).json({ error: '캐릭터 없음' });
    if (!char.is_selectable) return res.status(400).json({ error: '선택 불가 캐릭터' });

    const session_id = await createSession({ learner_id, scenario_id, character_id });
    res.json({ session_id });
  } catch (err) {
    console.error('[POST /api/sessions]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 채팅 (SSE 스트리밍)
router.post('/chat', async (req, res) => {
  const { session_id, user_message } = req.body;
  if (!session_id || !user_message) {
    return res.status(400).json({ error: 'session_id, user_message 필수' });
  }

  let session;
  try {
    session = await getSession(session_id);
    if (!session) return res.status(404).json({ error: '세션 없음' });
    if (session.status !== 'active') return res.status(400).json({ error: '종료된 세션' });
  } catch (err) {
    return res.status(500).json({ error: 'DB 오류' });
  }

  const turn = session.turn_count + 1;

  // 사용자 메시지 저장
  await addMessage({ session_id, role: 'user', content: user_message, turn_number: turn });
  await incrementTurnCount(session_id);

  // SSE 헤더
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  let fullResponse = '';
  try {
    const char = await getCharacter(session.character_id);
    const history = await getMessages(session_id);
    const messages = history.map(m => ({ role: m.role, content: m.content }));

    for await (const chunk of invokeChat(messages, char.persona_prompt)) {
      fullResponse += chunk;
      res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
    }

    // AI 응답 저장
    await addMessage({ session_id, role: 'assistant', content: fullResponse, turn_number: turn });
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
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
