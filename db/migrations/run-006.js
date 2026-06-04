import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config = {
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME || 'persona_roleplay',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
};

async function run() {
  let connection;
  try {
    console.log('[RUN-006] RDS MySQL 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('[RUN-006] 연결 성공.');

    const sql = readFileSync(join(__dirname, '006_add_character_id_to_messages.sql'), 'utf8');
    console.log('[RUN-006] 006_add_character_id_to_messages.sql 실행 중...');
    await connection.query(sql);
    console.log('[RUN-006] ✅ messages.character_id 컬럼 추가 완료 (Phase E B안).');

    const [cols] = await connection.query(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'messages'
       ORDER BY ORDINAL_POSITION`,
      [config.database]
    );
    console.log('[RUN-006] messages 테이블 현재 컬럼:');
    cols.forEach(c => console.log(`  - ${c.COLUMN_NAME} (${c.COLUMN_TYPE}, NULL:${c.IS_NULLABLE})`));

  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('[RUN-006] ⚠️ character_id 컬럼이 이미 존재합니다. 스킵.');
    } else {
      console.error('[RUN-006] ❌ 오류:', err.message);
      process.exit(1);
    }
  } finally {
    if (connection) await connection.end();
  }
}

run();
