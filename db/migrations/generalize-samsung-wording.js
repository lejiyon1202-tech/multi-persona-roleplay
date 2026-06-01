import 'dotenv/config';
import pool from '../../src/data-store/db.js';

async function generalize() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. scenarios 테이블 ───────────────────────────────────────────────────
    const [scenRows] = await conn.query(
      `SELECT id, title, case_name FROM scenarios WHERE title LIKE '%DS AI%' OR case_name LIKE '%삼성%'`
    );
    console.log(`[MIGRATE] 수정 대상 시나리오: ${scenRows.length}건`);

    for (const row of scenRows) {
      const newTitle    = row.title.replace(/DS AI센터/g, 'AI혁신센터');
      const newCaseName = row.case_name
        .replace(/삼성전자DS AI센터/g, '글로벌 IT기업 AI혁신센터')
        .replace(/DS AI센터/g, 'AI혁신센터');
      await conn.query(
        `UPDATE scenarios SET title = ?, case_name = ? WHERE id = ?`,
        [newTitle, newCaseName, row.id]
      );
      console.log(`  시나리오 id=${row.id}: "${row.title}" → "${newTitle}"`);
    }

    // ── 2. scenario_characters 테이블 ────────────────────────────────────────
    const [charRows] = await conn.query(
      `SELECT id, name, department, persona_prompt FROM scenario_characters
       WHERE name LIKE '%이삼성%' OR department LIKE '%AI센터%' OR persona_prompt LIKE '%DS AI센터%'`
    );
    console.log(`[MIGRATE] 수정 대상 캐릭터: ${charRows.length}건`);

    for (const row of charRows) {
      const newName    = row.name.replace(/이삼성/g, '이임원');
      const newDept    = row.department.replace(/^AI센터$/, 'AI혁신센터');
      const newPrompt  = row.persona_prompt
        .replace(/삼성전자DS AI센터/g, '글로벌 IT기업 AI혁신센터')
        .replace(/DS AI센터/g, 'AI혁신센터');
      await conn.query(
        `UPDATE scenario_characters SET name = ?, department = ?, persona_prompt = ? WHERE id = ?`,
        [newName, newDept, newPrompt, row.id]
      );
      console.log(`  캐릭터 id=${row.id}: name="${newName}" dept="${newDept}"`);
    }

    await conn.commit();
    console.log('[MIGRATE] ✅ 삼성 워딩 범용화 완료');
  } catch (err) {
    await conn.rollback();
    console.error('[MIGRATE] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

generalize();
