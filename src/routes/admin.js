import { Router } from 'express';
import adminAuth from '../middleware/admin-auth.js';
import {
  listScenarios, getScenario, createScenario, updateScenario, deleteScenario,
  getCharacters, createCharacter, updateCharacter, deleteCharacter,
} from '../data-store/scenarios-store.js';

const router = Router();
router.use(adminAuth);

// ── 시나리오 CRUD ─────────────────────────────────────────────────────────────

router.get('/scenarios', async (req, res) => {
  try { res.json(await listScenarios()); }
  catch (err) { res.status(500).json({ error: 'DB 오류' }); }
});

router.post('/scenarios', async (req, res) => {
  const { title, case_name, context_description, learner_role } = req.body;
  if (!title || !case_name || !context_description || !learner_role) {
    return res.status(400).json({ error: '필수 필드 누락' });
  }
  try {
    const id = await createScenario({ title, case_name, context_description, learner_role });
    res.status(201).json({ id });
  } catch (err) {
    console.error('[POST /api/admin/scenarios]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

router.put('/scenarios/:id', async (req, res) => {
  try {
    const affected = await updateScenario(Number(req.params.id), req.body);
    if (!affected) return res.status(404).json({ error: '시나리오 없음' });
    res.json({ updated: true });
  } catch (err) {
    console.error('[PUT /api/admin/scenarios/:id]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

router.delete('/scenarios/:id', async (req, res) => {
  try {
    const affected = await deleteScenario(Number(req.params.id));
    if (!affected) return res.status(404).json({ error: '시나리오 없음' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/admin/scenarios/:id]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

// ── 캐릭터 CRUD ──────────────────────────────────────────────────────────────

router.get('/scenarios/:id/characters', async (req, res) => {
  try { res.json(await getCharacters(Number(req.params.id))); }
  catch (err) { res.status(500).json({ error: 'DB 오류' }); }
});

router.post('/scenarios/:id/characters', async (req, res) => {
  try {
    const scenario = await getScenario(Number(req.params.id));
    if (!scenario) return res.status(404).json({ error: '시나리오 없음' });
    const cid = await createCharacter(Number(req.params.id), req.body);
    res.status(201).json({ id: cid });
  } catch (err) {
    console.error('[POST /api/admin/scenarios/:id/characters]', err.message);
    res.status(err.code === 'ER_DUP_ENTRY' ? 409 : 500).json({ error: err.message });
  }
});

router.put('/scenarios/:id/characters/:cid', async (req, res) => {
  try {
    const affected = await updateCharacter(Number(req.params.cid), req.body);
    if (!affected) return res.status(404).json({ error: '캐릭터 없음' });
    res.json({ updated: true });
  } catch (err) {
    console.error('[PUT /api/admin/.../characters/:cid]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

router.delete('/scenarios/:id/characters/:cid', async (req, res) => {
  try {
    const affected = await deleteCharacter(Number(req.params.cid));
    if (!affected) return res.status(404).json({ error: '캐릭터 없음' });
    res.json({ deleted: true });
  } catch (err) {
    console.error('[DELETE /api/admin/.../characters/:cid]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

export default router;
