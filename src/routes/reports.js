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

    const [evaluation, messages] = await Promise.all([
      getEvaluation(session.id),
      getMessages(session.id),
    ]);

    // v3 세션: learner_character_id 우선 → character_id → dialogue_partner_ids[0]
    let character = null;
    if (session.learner_character_id) {
      character = await getCharacter(session.learner_character_id);
    } else if (session.character_id) {
      character = await getCharacter(session.character_id);
    } else if (session.dialogue_partner_ids) {
      const ids = typeof session.dialogue_partner_ids === 'string'
        ? JSON.parse(session.dialogue_partner_ids)
        : session.dialogue_partner_ids;
      if (ids && ids.length > 0) character = await getCharacter(ids[0]);
    }

    // evaluation flatten — scores/feedback JSON 파싱 후 top-level 전개
    let scores = {};
    let feedback = {};
    let total_score = 0;
    let grade = '느낌이 안 와';

    if (evaluation) {
      scores = typeof evaluation.scores === 'string'
        ? JSON.parse(evaluation.scores) : (evaluation.scores ?? {});
      feedback = typeof evaluation.feedback === 'string'
        ? JSON.parse(evaluation.feedback) : (evaluation.feedback ?? {});
      total_score = Number(evaluation.total_score) || 0;
      grade = evaluation.grade ?? '느낌이 안 와';
    }

    res.json({
      session_id: session.id,
      scenario_id: session.scenario_id,
      character: character
        ? { id: character.id, name: character.name, role_level: character.role_level }
        : null,
      scores,
      feedback,
      total_score,
      grade,
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
