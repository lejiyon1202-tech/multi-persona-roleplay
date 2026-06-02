import 'dotenv/config';
import pool from '../../src/data-store/db.js';

/* 갈등(conflict) 관계 데이터 추가 — A안 (대장님 컨펌 2026-06-02 KST)
   시나리오별 핵심 갈등 1~3건 추가
   - Case 1·2 (AI 혁신센터, scenario_id=1·2): 이임원↔박수석, 김센터↔박수석
   - Case 3 (CDP 위기, scenario_id=4): 강민경↔박기훈, 이동현↔윤서준
*/

const CONFLICT_DATA = [
  // ── Case 1 & 2 (AI 혁신센터) ──
  { scenarioIds: [1, 2], cardNumber: 1, items: [
    { target_name: '박수석 파트장', type: '갈등', description: 'AI 도입 압박 vs 현장 검증 원칙 저항' },
  ]},
  { scenarioIds: [1, 2], cardNumber: 2, items: [
    { target_name: '박수석 파트장', type: '갈등', description: 'AI 성과 요구 vs 데이터 검증 원칙 충돌' },
  ]},
  { scenarioIds: [1, 2], cardNumber: 3, items: [
    { target_name: '이임원 팀장', type: '갈등', description: '현장 저항 — 경영진 무리한 요구 거부' },
    { target_name: '김센터 그룹장', type: '갈등', description: '검증 원칙 vs 빠른 성과 압박 충돌' },
  ]},
  // ── Case 3 (CDP 위기, scenario_id=4) ──
  { scenarioIds: [4], cardNumber: 3, items: [
    { target_name: '박기훈 운영전략팀장', type: '갈등', description: '강행 전환 vs 연기 결정 — 위기 대응 우선순위 충돌' },
  ]},
  { scenarioIds: [4], cardNumber: 4, items: [
    { target_name: '강민경 고객경험팀장', type: '갈등', description: '연기 확정 vs 강행 고집 — 위기 대응 방향 충돌' },
  ]},
  { scenarioIds: [4], cardNumber: 5, items: [
    { target_name: '이동현 시스템통합 책임', type: '갈등', description: '데이터 분석 vs 기술 현장 리스크 — 판단 기준 충돌' },
  ]},
  { scenarioIds: [4], cardNumber: 6, items: [
    { target_name: '윤서준 데이터분석 수석', type: '갈등', description: '기술 리스크 경고 vs 데이터 분석 해석 — 우선순위 갈등' },
  ]},
];

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const { scenarioIds, cardNumber, items } of CONFLICT_DATA) {
      for (const sid of scenarioIds) {
        for (const item of items) {
          /* 중복 방지: 동일 target_name + type=갈등 이미 있으면 스킵 */
          const [rows] = await conn.query(
            `SELECT JSON_SEARCH(
               JSON_EXTRACT(learner_detail, '$.relationships_structured'),
               'one', ?, NULL, '$[*].target_name'
             ) AS pos,
             JSON_EXTRACT(learner_detail, '$.relationships_structured') AS rs
             FROM scenario_characters
             WHERE scenario_id = ? AND card_number = ?`,
            [item.target_name, sid, cardNumber]
          );

          if (!rows || rows.length === 0) {
            console.error(`[MIGRATE] ❌ S${sid} card${cardNumber} 행 없음`);
            continue;
          }

          /* 이미 동일 target_name이 있고 갈등 타입인지 확인 */
          const rs = rows[0].rs;
          if (rs) {
            const arr = typeof rs === 'string' ? JSON.parse(rs) : rs;
            const exists = arr.some(r => r.target_name === item.target_name && r.type === '갈등');
            if (exists) {
              console.log(`[MIGRATE] SKIP S${sid} card${cardNumber} 갈등(${item.target_name}) 이미 존재`);
              continue;
            }
          }

          const [r] = await conn.query(
            `UPDATE scenario_characters
             SET learner_detail = JSON_ARRAY_APPEND(
               learner_detail,
               '$.relationships_structured',
               CAST(? AS JSON)
             )
             WHERE scenario_id = ? AND card_number = ?`,
            [JSON.stringify(item), sid, cardNumber]
          );
          console.log(`[MIGRATE] ✅ S${sid} card${cardNumber} +갈등(${item.target_name}): ${r.affectedRows}행`);
        }
      }
    }

    /* 검증 */
    const [check] = await conn.query(
      `SELECT scenario_id, card_number,
              JSON_LENGTH(
                JSON_EXTRACT(learner_detail, '$.relationships_structured')
              ) AS total,
              (SELECT COUNT(*)
               FROM JSON_TABLE(
                 JSON_EXTRACT(learner_detail, '$.relationships_structured'),
                 '$[*]' COLUMNS (t VARCHAR(50) PATH '$.type')
               ) jt WHERE jt.t = '갈등'
              ) AS conflict_cnt
       FROM scenario_characters
       WHERE scenario_id IN (1,2,4)
       ORDER BY scenario_id, card_number`
    );
    check.forEach(c =>
      console.log(`[VERIFY] S${c.scenario_id} card${c.card_number}: total=${c.total} conflict=${c.conflict_cnt}`)
    );

    await conn.commit();
    console.log('[MIGRATE] ✅ 갈등 관계 추가 완료');
  } catch (err) {
    await conn.rollback();
    console.error('[MIGRATE] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
