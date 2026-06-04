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
    console.log('[RUN-005] RDS MySQL 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('[RUN-005] 연결 성공.');

    const sql = readFileSync(join(__dirname, '005_fix_stakeholders.sql'), 'utf8');
    console.log('[RUN-005] 005_fix_stakeholders.sql 실행 중...');
    await connection.query(sql);
    console.log('[RUN-005] ✅ stakeholders 환각 정정 완료 (R-28-1: 실제 characters DB 인물명 동기화).');

    // 정정 결과 검증
    const [rows] = await connection.query(
      `SELECT id, title,
        JSON_UNQUOTE(JSON_EXTRACT(briefing, '$.stakeholders')) AS stakeholders
       FROM scenarios
       WHERE id IN (1, 4)
       ORDER BY id`
    );
    console.log('[RUN-005] stakeholders 정정 결과:');
    rows.forEach(r => {
      console.log(`  - id=${r.id} "${r.title}"`);
      console.log(`    stakeholders: ${r.stakeholders?.substring(0, 80)}...`);
    });

  } catch (err) {
    console.error('[RUN-005] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

run();
