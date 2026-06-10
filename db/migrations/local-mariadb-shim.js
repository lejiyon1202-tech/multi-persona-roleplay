import 'dotenv/config';
import pool from '../../src/data-store/db.js';

/* 로컬 MariaDB 호환 shim — 2026-06-11 로컬 가동 (따까리·코드 무수정 원칙)
   원본 3개 migration이 MySQL 전용 `CAST(? AS JSON)` 사용 → MariaDB 미지원으로 실패.
   본 shim은 MariaDB 호환 `JSON_COMPACT(?)`로 동일 데이터를 적용한다.
   또한 RDS 당시 Case 3 scenario_id=4였으나 로컬 seed는 3 → 동적 매핑.

   대상 원본:
   1. add-relationships-structured.js (18캐릭터 관계 구조화)
   2. add-recommended-partners.js     (추천 첫 대화 상대)
   3. add-conflict-relations.js       (갈등 관계 추가)
*/

// ── 원본 add-relationships-structured.js 데이터 (동일 복제) ──
const CARD12_STRUCTURED = [
  { structured: [
    { target_name: '김센터 그룹장', type: '부하', description: '직속 보고 라인 — 압박하지만 잘 해주길 바란다' },
    { target_name: '팀원들', type: '간접 관리', description: '전문성 인정하나 큰 그림에서만 생각' },
    { target_name: '경영진', type: '상사', description: '보고해야 할 상위 의사결정자들 — 체면이 걸린 관계' },
  ]},
  { structured: [
    { target_name: '이임원 팀장', type: '상사', description: '보고 라인 — 압박 받지만 조직 맥락 이해' },
    { target_name: '박수석 파트장', type: '부하', description: '원칙주의 — 조건이 맞으면 협력 가능' },
    { target_name: '박보안 파트장', type: '부하', description: '번아웃 직전 — 공감 먼저 필요' },
    { target_name: '이책임 CL3', type: '부하', description: '인정 욕구 — 역할 재정의 필요' },
    { target_name: '정인라 CL2', type: '부하', description: '회의주의 — 진정성 먼저 보여야 함' },
  ]},
  { structured: [
    { target_name: '김센터 그룹장', type: '상사', description: '직속 보고 라인 — 원칙을 이해하면 협력 가능' },
    { target_name: '박보안 파트장', type: '동료', description: '업무 성격 다름 — 실무 협업' },
    { target_name: '이책임 CL3', type: '부하', description: '후배 — 기준 없이 작업하는 문화를 경계' },
    { target_name: '정인라 CL2', type: '부하', description: '후배 — 기준 없이 작업하는 문화를 경계' },
    { target_name: '경영진', type: '경영진', description: '간접 압박 — 그룹장 통해서만 소통' },
  ]},
  { structured: [
    { target_name: '김센터 그룹장', type: '상사', description: '직속 보고 — 공감 먼저 보여주면 협력 가능' },
    { target_name: '박수석 파트장', type: '동료', description: '같은 파트장 — 원칙 공유, 가끔 의견 교환' },
    { target_name: '이책임 CL3', type: '부하', description: '후배 — 힘든 상황 비슷하게 이해' },
    { target_name: '정인라 CL2', type: '부하', description: '후배 — 힘든 상황 비슷하게 이해' },
    { target_name: '경영진', type: '경영진', description: '압박의 원천 — 그룹장 통해서만 연결' },
  ]},
  { structured: [
    { target_name: '김센터 그룹장', type: '상사', description: '직속 보고 — 인정해주면 즉시 행동 전환' },
    { target_name: '박수석 파트장', type: '동료', description: '기술 전문가로 상호 존중' },
    { target_name: '정인라 CL2', type: '부하', description: '후배 — 회의적 태도 비슷하게 공감' },
    { target_name: '경영진·컨설턴트', type: '경영진', description: '불만 — 레거시 시스템 이해 없이 AI 전환 밀어붙임' },
  ]},
  { structured: [
    { target_name: '김센터 그룹장', type: '상사', description: '진정성 테스트 대상 — 진심이 보이면 협력' },
    { target_name: '이책임 CL3', type: '선배', description: '선배 — 기여 인정 욕구에 공감' },
    { target_name: '경영진·컨설턴트', type: '경영진', description: '불신 — 실제 현장 모르는 사람들이 결정' },
  ]},
];

const CASE3_STRUCTURED = [
  { structured: [
    { target_name: '유통혁신본부장', type: '부하', description: '직보 라인 — 오늘 안에 결과를 가져와야 할 사람' },
    { target_name: '최준호 이커머스본부장', type: '동료', description: '동급 임원 — 거리두기' },
    { target_name: '팀장급', type: '간접 관리', description: '간접 관리' },
    { target_name: '이사회·경영진', type: '상사', description: '책임 보고 대상' },
  ]},
  { structured: [
    { target_name: '유통혁신본부장', type: '동료', description: '동급 — 잘 처리해주길 바라지만 공개 지지 안 함' },
    { target_name: '오현철 CCO', type: '상사', description: '상위 — 눈치 보는 대상' },
    { target_name: '팀장급 이하', type: '간접 관리', description: '무관심' },
    { target_name: '타 본부장들', type: '동료', description: '비슷한 거리두기 문화 공유' },
  ]},
  { structured: [
    { target_name: '유통혁신본부장', type: '상사', description: '직속 보고 — 강하게 맞서지만 조건 맞으면 전환' },
    { target_name: '박기훈 운영전략팀장', type: '동료', description: '같은 팀장 — 연기 지지 입장 이해하나 동의 못 함' },
    { target_name: '윤서준 수석', type: '간접 연관', description: '산하 파트 아님 — 간접 연관' },
    { target_name: '이동현 책임', type: '간접 연관', description: '산하 파트 아님 — 간접 연관' },
    { target_name: '오현철 CCO', type: '경영진', description: '상위 압박 원천' },
  ]},
  { structured: [
    { target_name: '유통혁신본부장', type: '상사', description: '직속 보고 — 방향 주면 즉시 행동' },
    { target_name: '강민경 고객경험팀장', type: '동료', description: '같은 팀장 — 강행 주장 이해 못 함' },
    { target_name: '윤서준 수석', type: '부하', description: '산하 파트 — 올린 데이터가 판단 근거' },
    { target_name: '이동현 책임', type: '부하', description: '산하 파트 — 올린 데이터가 판단 근거' },
    { target_name: '오현철 CCO', type: '경영진', description: '압박 원천 — 5년 전 실패 결정자와 비슷한 포지션으로 불신' },
  ]},
  { structured: [
    { target_name: '유통혁신본부장', type: '간접 상사', description: '직속 상관 아님 — 자신의 분석을 진지하게 받아줄지 탐색 중' },
    { target_name: '박기훈 운영전략팀장', type: '상사', description: '직상위 — 보고서 전달했지만 반영 여부 불확실' },
    { target_name: '이동현 책임', type: '동료', description: '같은 파트 동료 — 기술 리스크 공유' },
    { target_name: '강민경 고객경험팀장', type: '간접 연관', description: '강행 주장으로 데이터 무시하는 태도에 당혹' },
  ]},
  { structured: [
    { target_name: '유통혁신본부장', type: '간접 상사', description: '처음 직접 대화 — 진정성 테스트 중' },
    { target_name: '박기훈 운영전략팀장', type: '상사', description: '직상위 — 보고를 묵살한 장본인' },
    { target_name: '윤서준 수석', type: '동료', description: '같은 파트 — 데이터 분석 협력' },
    { target_name: '강민경 고객경험팀장', type: '간접 연관', description: '기술 무시하는 강행 입장에 불만' },
    { target_name: 'CCO·경영진', type: '경영진', description: '전형적인 의사결정 구조의 문제 원천' },
  ]},
];

// ── 원본 add-conflict-relations.js 데이터 (Case 3 sid 동적) ──
const CONFLICT_DATA = (case3Id) => [
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
  { scenarioIds: [case3Id], cardNumber: 3, items: [
    { target_name: '박기훈 운영전략팀장', type: '갈등', description: '강행 전환 vs 연기 결정 — 위기 대응 우선순위 충돌' },
  ]},
  { scenarioIds: [case3Id], cardNumber: 4, items: [
    { target_name: '강민경 고객경험팀장', type: '갈등', description: '연기 확정 vs 강행 고집 — 위기 대응 방향 충돌' },
  ]},
  { scenarioIds: [case3Id], cardNumber: 5, items: [
    { target_name: '이동현 시스템통합 책임', type: '갈등', description: '데이터 분석 vs 기술 현장 리스크 — 판단 기준 충돌' },
  ]},
  { scenarioIds: [case3Id], cardNumber: 6, items: [
    { target_name: '윤서준 데이터분석 수석', type: '갈등', description: '기술 리스크 경고 vs 데이터 분석 해석 — 우선순위 갈등' },
  ]},
];

async function setStructured(conn, sid, cardNumber, structured) {
  /* learner_detail NULL 카드 (backfill 미커버·S3 등) 초기화 — JSON_SET(NULL,...)은 NULL 반환 */
  await conn.query(
    `UPDATE scenario_characters SET learner_detail = JSON_OBJECT()
     WHERE scenario_id = ? AND card_number = ? AND learner_detail IS NULL`,
    [sid, cardNumber]
  );
  const [r] = await conn.query(
    `UPDATE scenario_characters
     SET learner_detail = JSON_SET(learner_detail, '$.relationships_structured', JSON_COMPACT(?))
     WHERE scenario_id = ? AND card_number = ?`,
    [JSON.stringify(structured), sid, cardNumber]
  );
  return r.affectedRows;
}

async function migrate() {
  const conn = await pool.getConnection();
  try {
    // Case 3 scenario_id 동적 해석
    const [c3rows] = await conn.query(
      `SELECT DISTINCT scenario_id AS id FROM scenario_characters WHERE name = '오현철 CCO' LIMIT 1`
    );
    const case3Id = c3rows.length ? c3rows[0].id : null;
    console.log(`[SHIM] Case 3 scenario_id = ${case3Id}`);

    await conn.beginTransaction();

    // ── 1. relationships_structured ──
    for (let i = 0; i < CARD12_STRUCTURED.length; i++) {
      for (const sid of [1, 2]) {
        const n = await setStructured(conn, sid, i + 1, CARD12_STRUCTURED[i].structured);
        console.log(`[SHIM-1] S${sid} card${i + 1}: ${n}행`);
        if (n === 0) throw new Error(`S${sid} card${i + 1} 업데이트 실패`);
      }
    }
    if (case3Id) {
      for (let i = 0; i < CASE3_STRUCTURED.length; i++) {
        const n = await setStructured(conn, case3Id, i + 1, CASE3_STRUCTURED[i].structured);
        console.log(`[SHIM-1] S${case3Id} card${i + 1}: ${n}행`);
        if (n === 0) throw new Error(`S${case3Id} card${i + 1} 업데이트 실패`);
      }
    }

    // ── 2. conflict relations (JSON_ARRAY_APPEND + JSON_COMPACT) ──
    for (const { scenarioIds, cardNumber, items } of CONFLICT_DATA(case3Id)) {
      for (const sid of scenarioIds) {
        if (!sid) continue;
        for (const item of items) {
          const [rows] = await conn.query(
            `SELECT JSON_EXTRACT(learner_detail, '$.relationships_structured') AS rs
             FROM scenario_characters WHERE scenario_id = ? AND card_number = ?`,
            [sid, cardNumber]
          );
          if (!rows.length) { console.error(`[SHIM-2] ❌ S${sid} card${cardNumber} 행 없음`); continue; }
          const rs = rows[0].rs;
          if (rs) {
            const arr = typeof rs === 'string' ? JSON.parse(rs) : rs;
            if (arr.some(r => r.target_name === item.target_name && r.type === '갈등')) {
              console.log(`[SHIM-2] SKIP S${sid} card${cardNumber} 갈등(${item.target_name}) 이미 존재`);
              continue;
            }
          }
          const [r] = await conn.query(
            `UPDATE scenario_characters
             SET learner_detail = JSON_ARRAY_APPEND(learner_detail, '$.relationships_structured', JSON_COMPACT(?))
             WHERE scenario_id = ? AND card_number = ?`,
            [JSON.stringify(item), sid, cardNumber]
          );
          console.log(`[SHIM-2] ✅ S${sid} card${cardNumber} +갈등(${item.target_name}): ${r.affectedRows}행`);
        }
      }
    }

    // ── 검증 ──
    const [check] = await conn.query(
      `SELECT scenario_id, card_number,
              JSON_TYPE(JSON_EXTRACT(learner_detail, '$.relationships_structured')) AS arr_type,
              JSON_LENGTH(JSON_EXTRACT(learner_detail, '$.relationships_structured')) AS arr_len
       FROM scenario_characters
       ORDER BY scenario_id, card_number`
    );
    let fail = 0;
    for (const c of check) {
      const ok = c.arr_type === 'ARRAY' && c.arr_len > 0;
      if (!ok) { console.error(`[VERIFY] ❌ S${c.scenario_id} card${c.card_number} type=${c.arr_type} len=${c.arr_len}`); fail++; }
      else console.log(`[VERIFY] ✅ S${c.scenario_id} card${c.card_number} len=${c.arr_len}`);
    }
    if (fail > 0) { await conn.rollback(); process.exit(1); }

    await conn.commit();
    console.log('[SHIM] ✅ 로컬 MariaDB shim 완료 — relationships_structured + 갈등 관계 전수 적용');
  } catch (err) {
    await conn.rollback();
    console.error('[SHIM] ❌ 오류:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    await pool.end();
  }
}

migrate();
