import pool from './db.js';

export async function saveEvaluation({ session_id, scores, feedback, total_score, grade }) {
  const [result] = await pool.query(
    `INSERT INTO evaluations (session_id, scores, feedback, total_score, grade)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       scores = VALUES(scores), feedback = VALUES(feedback),
       total_score = VALUES(total_score), grade = VALUES(grade),
       evaluated_at = NOW()`,
    [session_id, JSON.stringify(scores), JSON.stringify(feedback), total_score, grade]
  );
  return result.insertId || session_id;
}

export async function getEvaluation(sessionId) {
  const [rows] = await pool.query(
    'SELECT * FROM evaluations WHERE session_id = ?', [sessionId]
  );
  return rows[0] ?? null;
}

export async function getSessionsForCompare(learnerId, scenarioId) {
  const [rows] = await pool.query(
    `SELECT s.id AS session_id, s.character_id, sc.name AS character_name,
            sc.role_level, e.scores, e.feedback, e.total_score, e.grade
     FROM sessions s
     JOIN scenario_characters sc ON sc.id = s.character_id
     LEFT JOIN evaluations e ON e.session_id = s.id
     WHERE s.learner_id = ? AND s.scenario_id = ? AND s.status = 'completed'
     ORDER BY s.started_at`,
    [learnerId, scenarioId]
  );
  return rows;
}
