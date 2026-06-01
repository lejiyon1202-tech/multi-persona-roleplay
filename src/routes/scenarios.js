import { Router } from 'express';
import {
  listScenarios, getScenario, getCharacters,
} from '../data-store/scenarios-store.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const scenarios = await listScenarios();
    res.json(scenarios);
  } catch (err) {
    console.error('[GET /api/scenarios]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const scenario = await getScenario(Number(req.params.id));
    if (!scenario) return res.status(404).json({ error: '시나리오 없음' });
    res.json(scenario);
  } catch (err) {
    console.error('[GET /api/scenarios/:id]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

router.get('/:id/characters', async (req, res) => {
  try {
    const characters = await getCharacters(Number(req.params.id));
    res.json(characters);
  } catch (err) {
    console.error('[GET /api/scenarios/:id/characters]', err.message);
    res.status(500).json({ error: 'DB 오류' });
  }
});

export default router;
