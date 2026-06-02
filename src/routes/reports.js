import { Router } from 'express';
import { getEvaluation, getSessionsForCompare } from '../data-store/eval-store.js';
import { getSession, getMessages } from '../data-store/sessions-store.js';
import { getCharacter } from '../data-store/scenarios-store.js';

const router = Router();

// 단일 세션 리포트
router.get('/sessions/:id/report', async (req, res) => {
  try {
    const session = await getSession(Number(req.params.id));
    if (!session) return res.status(404).json({ error: '세션 없음' });

    const [evaluation, character, messages] = await Promise.all([
      getEvaluation(session.id),
      getCharacter(session.character_id),
      getMessages(session.id),
    ]);

    res.json({
      session,
      character: character
        ? { id: character.id, name: character.name, role_level: character.role_level }
        : null,
      evaluation,
      turn_count: messages.length,
    });
  } catch (err) {
    console.error('[GET /api/sessions/:id/report]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// 360도 비교 리포트 (최소 2세션)
router.get('/sessions/compare', async (req, res) => {
  const { learner_id, scenario_id } = req.query;
  if (!learner_id || !scenario_id) {
    return res.status(400).json({ error: 'learner_id, scenario_id 필수' });
  }

  try {
    const sessions = await getSessionsForCompare(
      Number(learner_id), Number(scenario_id)
    );
    console.log('[DEBUG compare] learner=%s scenario=%s rows=%d', learner_id, scenario_id, sessions.length);
    if (sessions.length < 2) {
      return res.status(400).json({ error: '비교 리포트는 최소 2세션 필요' });
    }
    res.json({ learner_id: Number(learner_id), scenario_id: Number(scenario_id), sessions });
  } catch (err) {
    console.error('[GET /api/sessions/compare]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

export default router;
