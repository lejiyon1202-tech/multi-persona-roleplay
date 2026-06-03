import 'dotenv/config';
import pool from '../../src/data-store/db.js';

// catch 59호: case_name "시뮬레이션" 메타 용어 제거 (절대규칙 §5)

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [before] = await conn.query(
      `SELECT id, case_name FROM scenarios WHERE case_name LIKE '%시뮬레이션%'`
    );
    console.log('[BEFORE] 시뮬레이션 포함 case_name:', before.map(r => `[${r.id}] ${r.case_name}`));

    if (before.length === 0) {
      console.log('[SKIP] 이미 정정 완료 또는 대상 없음');
      await conn.rollback();
      return;
    }

    const [result] = await conn.query(
      `UPDATE scenarios
       SET case_name = TRIM(REPLACE(REPLACE(case_name, ' 시뮬레이션', ''), '시뮬레이션 ', ''))
       WHERE case_name LIKE '%시뮬레이션%'`
    );
    console.log(`[UPDATE] ${result.affectedRows}건 정정`);

    const [after] = await conn.query(
      `SELECT id, case_name FROM scenarios WHERE id IN (${before.map(r => r.id).join(',')})`
    );
    console.log('[AFTER]', after.map(r => `[${r.id}] ${r.case_name}`));

    const [remain] = await conn.query(
      `SELECT COUNT(*) AS cnt FROM scenarios WHERE case_name LIKE '%시뮬레이션%'`
    );
    if (remain[0].cnt > 0) {
      throw new Error(`잔존 ${remain[0].cnt}건 — 롤백`);
    }

    await conn.commit();
    console.log('[DONE] ✅ 시뮬레이션 메타 용어 제거 완료 — 잔존 0건');
  } catch (err) {
    await conn.rollback();
    console.error('[ERROR]', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
