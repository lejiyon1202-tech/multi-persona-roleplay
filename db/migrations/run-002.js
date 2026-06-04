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
    console.log('[RUN-002] RDS MySQL 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('[RUN-002] 연결 성공.');

    const sql = readFileSync(join(__dirname, '002_add_briefing.sql'), 'utf8');
    console.log('[RUN-002] 002_add_briefing.sql 실행 중...');
    await connection.query(sql);
    console.log('[RUN-002] ✅ briefing 컬럼 추가 + 시드 데이터 완료.');

    const [rows] = await connection.query(
      'SELECT id, title, briefing IS NOT NULL AS has_briefing FROM scenarios ORDER BY id'
    );
    console.log('[RUN-002] 시나리오 briefing 현황:');
    rows.forEach(r => console.log(`  - id=${r.id} "${r.title}" briefing=${r.has_briefing ? '✅' : '❌'}`));

  } catch (err) {
    console.error('[RUN-002] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

run();
