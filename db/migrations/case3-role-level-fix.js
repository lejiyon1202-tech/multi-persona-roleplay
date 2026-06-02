import 'dotenv/config';
import pool from '../../src/data-store/db.js';

// catch 45호: scenario_id=4 (Case 3) role_level ENUM 위반 정정
// RDS STRICT mode가 비표준값을 빈 문자열로 저장 → 위계 트리 파손
// 매핑: C레벨→상위리더, 본부장→그룹장, 팀장→파트장, 수석/책임→부서원

const FIXES = [
  { name: '오현철 CCO',            role_level: '상위리더' },
  { name: '최준호 이커머스본부장',   role_level: '그룹장'  },
  { name: '강민경 고객경험팀장',    role_level: '파트장'  },
  { name: '박기훈 운영전략팀장',    role_level: '파트장'  },
  { name: '윤서준 데이터분석 수석', role_level: '부서원'  },
  { name: '이동현 시스템통합 책임', role_level: '부서원'  },
];

async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const { name, role_level } of FIXES) {
      const [result] = await conn.execute(
        `UPDATE scenario_characters SET role_level = ? WHERE scenario_id = 4 AND name = ?`,
        [role_level, name]
      );
      console.log(`[FIX] ${name} → ${role_level} (affected: ${result.affectedRows})`);
    }
    await conn.commit();
    console.log('[MIGRATE] ✅ Case 3 role_level 6건 정정 완료');

    const [rows] = await conn.execute(
      `SELECT card_number, name, role_level FROM scenario_characters WHERE scenario_id = 4 ORDER BY card_number`
    );
    const valid = ['상위리더', '그룹장', '파트장', '부서원'];
    rows.forEach(r => {
      const ok = valid.includes(r.role_level);
      console.log(`  card ${r.card_number}: ${r.name} → ${r.role_level} ${ok ? '✅' : '❌'}`);
    });
    const pass = rows.every(r => valid.includes(r.role_level));
    console.log(pass ? '[VERIFY] ✅ 전수 ENUM 검증 PASS' : '[VERIFY] ❌ 비표준값 잔존');
  } catch (err) {
    await conn.rollback();
    console.error('[MIGRATE] ❌ 롤백:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

run();
