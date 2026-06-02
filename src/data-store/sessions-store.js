import pool from './db.js';

export async function upsertLearner({ name, department = '', email }) {
  const [rows] = await pool.query(
    `INSERT INTO learners (name, department, email) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), department = VALUES(department)`,
    [name, department, email]
  );
  if (rows.insertId) return rows.insertId;
  const [found] = await pool.query('SELECT id FROM learners WHERE email = ?', [email]);
  return found[0].id;
}

export async function createSession({
  learner_id, scenario_id,
  character_id = null,
  learner_character_id = null,
  dialogue_partner_ids = null,
}) {
  const partnerJson = dialogue_partner_ids ? JSON.stringify(
    Array.isArray(dialogue_partner_ids) ? dialogue_partner_ids : [dialogue_partner_ids]
  ) : null;
  const [result] = await pool.query(
    `INSERT INTO sessions
     (learner_id, scenario_id, character_id, learner_character_id, dialogue_partner_ids)
     VALUES (?, ?, ?, ?, ?)`,
    [learner_id, scenario_id, character_id, learner_character_id, partnerJson]
  );
  return result.insertId;
}

export async function getSession(id) {
  const [rows] = await pool.query('SELECT * FROM sessions WHERE id = ?', [id]);
  return rows[0] ?? null;
}

export async function addMessage({ session_id, role, content, turn_number }) {
  const [result] = await pool.query(
    'INSERT INTO messages (session_id, role, content, turn_number) VALUES (?, ?, ?, ?)',
    [session_id, role, content, turn_number]
  );
  return result.insertId;
}

export async function getMessages(sessionId) {
  const [rows] = await pool.query(
    'SELECT role, content, turn_number FROM messages WHERE session_id = ? ORDER BY turn_number',
    [sessionId]
  );
  return rows;
}

export async function incrementTurnCount(sessionId) {
  await pool.query(
    'UPDATE sessions SET turn_count = turn_count + 1 WHERE id = ?', [sessionId]
  );
}

export async function completeSession(sessionId) {
  await pool.query(
    `UPDATE sessions SET status = 'completed', ended_at = NOW() WHERE id = ?`, [sessionId]
  );
}
