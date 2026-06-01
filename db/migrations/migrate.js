import 'dotenv/config';
import mysql from 'mysql2/promise';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const config = {
  host:     process.env.DB_HOST,
  port:     Number(process.env.DB_PORT) || 3306,
  database: process.env.DB_NAME     || 'persona_roleplay',
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
};

async function migrate() {
  let connection;
  try {
    console.log('[MIGRATE] RDS MySQL 연결 중...');
    connection = await mysql.createConnection(config);
    console.log('[MIGRATE] 연결 성공.');

    const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf8');
    console.log('[MIGRATE] schema.sql 실행 중...');
    await connection.query(sql);
    console.log('[MIGRATE] ✅ 마이그레이션 완료 — 6테이블 생성됨.');

    const [rows] = await connection.query(`
      SELECT TABLE_NAME
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_NAME
    `, [config.database]);

    console.log('[MIGRATE] 현재 테이블 목록:');
    rows.forEach(r => console.log('  -', r.TABLE_NAME));

  } catch (err) {
    console.error('[MIGRATE] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
