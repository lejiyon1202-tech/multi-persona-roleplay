/**
 * Phase C v3 스키마 마이그레이션 (합의서 v2 확정)
 *
 * scenarios: learner_brief / learner_mission / learner_competencies 추가
 * scenario_characters: learner_detail JSON + emoji VARCHAR(10) 추가
 * sessions: learner_character_id + dialogue_partner_ids 추가
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const config = {
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'persona_roleplay',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
};

async function colExists(conn, table, col) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [config.database, table, col]
  );
  return rows.length > 0;
}

async function migrate() {
  let connection;
  try {
    console.log('[MIGRATE-V2] RDS MySQL 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('[MIGRATE-V2] 연결 성공.');

    // ── scenarios ─────────────────────────────────────────────────────────────
    if (!(await colExists(connection, 'scenarios', 'learner_brief'))) {
      await connection.query(
        'ALTER TABLE scenarios ADD COLUMN learner_brief TEXT DEFAULT NULL AFTER learner_role'
      );
      console.log('[MIGRATE-V2] scenarios.learner_brief 추가');
    }
    if (!(await colExists(connection, 'scenarios', 'learner_mission'))) {
      await connection.query(
        'ALTER TABLE scenarios ADD COLUMN learner_mission TEXT DEFAULT NULL AFTER learner_brief'
      );
      console.log('[MIGRATE-V2] scenarios.learner_mission 추가');
    }
    if (!(await colExists(connection, 'scenarios', 'learner_competencies'))) {
      await connection.query(
        'ALTER TABLE scenarios ADD COLUMN learner_competencies JSON DEFAULT NULL AFTER learner_mission'
      );
      console.log('[MIGRATE-V2] scenarios.learner_competencies 추가');
    }

    // ── scenario_characters ────────────────────────────────────────────────────
    if (!(await colExists(connection, 'scenario_characters', 'learner_detail'))) {
      await connection.query(
        'ALTER TABLE scenario_characters ADD COLUMN learner_detail JSON DEFAULT NULL AFTER display_order'
      );
      console.log('[MIGRATE-V2] scenario_characters.learner_detail 추가');
    }
    if (!(await colExists(connection, 'scenario_characters', 'emoji'))) {
      await connection.query(
        "ALTER TABLE scenario_characters ADD COLUMN emoji VARCHAR(10) DEFAULT NULL AFTER learner_detail"
      );
      console.log('[MIGRATE-V2] scenario_characters.emoji 추가');
    }

    // ── sessions ────────────────────────────────────────────────────────────────
    // character_id는 NULL 허용으로 완화 (deprecated, 하위호환 유지)
    const charIdNullable = await connection.query(
      `SELECT IS_NULLABLE FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'sessions' AND COLUMN_NAME = 'character_id'`,
      [config.database]
    );
    if (charIdNullable[0]?.[0]?.IS_NULLABLE === 'NO') {
      await connection.query(
        `ALTER TABLE sessions MODIFY COLUMN character_id INT UNSIGNED DEFAULT NULL
         COMMENT 'deprecated — use learner_character_id'`
      );
      console.log('[MIGRATE-V2] sessions.character_id → NULL 허용 (deprecated)');
    }

    if (!(await colExists(connection, 'sessions', 'learner_character_id'))) {
      await connection.query(
        `ALTER TABLE sessions
         ADD COLUMN learner_character_id INT UNSIGNED DEFAULT NULL AFTER character_id,
         ADD CONSTRAINT fk_sess_learner_char
           FOREIGN KEY (learner_character_id) REFERENCES scenario_characters(id)
           ON DELETE SET NULL`
      );
      console.log('[MIGRATE-V2] sessions.learner_character_id 추가');
    }
    if (!(await colExists(connection, 'sessions', 'dialogue_partner_ids'))) {
      await connection.query(
        `ALTER TABLE sessions
         ADD COLUMN dialogue_partner_ids JSON DEFAULT NULL AFTER learner_character_id
         COMMENT '학습자가 대화할 AI 캐릭터 ID 배열 [int, ...]'`
      );
      console.log('[MIGRATE-V2] sessions.dialogue_partner_ids 추가');
    }

    // ── 결과 확인 ─────────────────────────────────────────────────────────────
    const tables = ['scenarios', 'scenario_characters', 'sessions'];
    for (const tbl of tables) {
      const [cols] = await connection.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
        [config.database, tbl]
      );
      console.log(`[MIGRATE-V2] ${tbl}:`, cols.map(r => r.COLUMN_NAME).join(', '));
    }

    console.log('[MIGRATE-V2] ✅ Phase C v3 스키마 마이그레이션 완료.');

  } catch (err) {
    console.error('[MIGRATE-V2] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
