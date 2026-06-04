import pool from './db.js';

export async function listScenarios() {
  const [rows] = await pool.query(
    'SELECT id, title, case_name, learner_role, created_at FROM scenarios ORDER BY id'
  );
  return rows;
}

export async function getScenario(id) {
  const [rows] = await pool.query(
    'SELECT * FROM scenarios WHERE id = ?', [id]
  );
  return rows[0] ?? null;
}

export async function getCharacters(scenarioId) {
  const [rows] = await pool.query(
    `SELECT id, scenario_id, name, department, role_level, card_number,
            core_mindset, situation, mission, avatar_url,
            is_selectable, display_order,
            learner_detail, emoji
     FROM scenario_characters
     WHERE scenario_id = ?
     ORDER BY display_order, card_number`,
    [scenarioId]
  );
  return rows;
}

export async function getCharacter(id) {
  const [rows] = await pool.query(
    'SELECT * FROM scenario_characters WHERE id = ?', [id]
  );
  return rows[0] ?? null;
}

// ── Admin CRUD ───────────────────────────────────────────────────────────────

export async function createScenario({ title, case_name, context_description, learner_role, briefing = null }) {
  const [result] = await pool.query(
    'INSERT INTO scenarios (title, case_name, context_description, learner_role, briefing) VALUES (?, ?, ?, ?, ?)',
    [title, case_name, context_description, learner_role, briefing ? JSON.stringify(briefing) : null]
  );
  return result.insertId;
}

export async function updateScenario(id, fields) {
  const allowed = ['title', 'case_name', 'context_description', 'learner_role', 'briefing'];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      vals.push(key === 'briefing' && fields[key] !== null ? JSON.stringify(fields[key]) : fields[key]);
    }
  }
  if (!sets.length) return 0;
  vals.push(id);
  const [result] = await pool.query(`UPDATE scenarios SET ${sets.join(', ')} WHERE id = ?`, vals);
  return result.affectedRows;
}

export async function deleteScenario(id) {
  const [result] = await pool.query('DELETE FROM scenarios WHERE id = ?', [id]);
  return result.affectedRows;
}

export async function createCharacter(scenarioId, data) {
  const {
    name, department, role_level, card_number,
    core_mindset, situation, mission, persona_prompt,
    emotion_stages, avatar_url = null, is_selectable = 1, display_order = 0,
  } = data;
  const [result] = await pool.query(
    `INSERT INTO scenario_characters
     (scenario_id, name, department, role_level, card_number,
      core_mindset, situation, mission, persona_prompt,
      emotion_stages, avatar_url, is_selectable, display_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [scenarioId, name, department, role_level, card_number,
     core_mindset, situation, mission, persona_prompt,
     JSON.stringify(emotion_stages), avatar_url, is_selectable, display_order]
  );
  return result.insertId;
}

export async function updateCharacter(id, fields) {
  const allowed = [
    'name','department','role_level','card_number','core_mindset',
    'situation','mission','persona_prompt','emotion_stages',
    'avatar_url','is_selectable','display_order',
  ];
  const sets = [];
  const vals = [];
  for (const key of allowed) {
    if (key in fields) {
      sets.push(`${key} = ?`);
      vals.push(key === 'emotion_stages' ? JSON.stringify(fields[key]) : fields[key]);
    }
  }
  if (!sets.length) return 0;
  vals.push(id);
  const [result] = await pool.query(
    `UPDATE scenario_characters SET ${sets.join(', ')} WHERE id = ?`, vals
  );
  return result.affectedRows;
}

export async function deleteCharacter(id) {
  const [result] = await pool.query(
    'DELETE FROM scenario_characters WHERE id = ?', [id]
  );
  return result.affectedRows;
}
