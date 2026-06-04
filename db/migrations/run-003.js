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
    console.log('[RUN-003] RDS MySQL 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('[RUN-003] 연결 성공.');

    const sql = readFileSync(join(__dirname, '003_fix_briefing.sql'), 'utf8');
    console.log('[RUN-003] 003_fix_briefing.sql 실행 중...');
    await connection.query(sql);
    console.log('[RUN-003] ✅ briefing 정정 완료 (메타 용어 제거 + id=4 시드 추가).');

    const [rows] = await connection.query(
      'SELECT id, title, briefing IS NOT NULL AS has_briefing FROM scenarios ORDER BY id'
    );
    console.log('[RUN-003] 시나리오 briefing 현황:');
    rows.forEach(r => console.log(`  - id=${r.id} "${r.title}" briefing=${r.has_briefing ? '✅' : '❌'}`));

  } catch (err) {
    console.error('[RUN-003] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

run();
