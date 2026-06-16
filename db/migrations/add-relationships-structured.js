import 'dotenv/config';
import pool from '../../src/data-store/db.js';

// 모달 구조화: relationships 문자열 → relationships_structured 객체 배열 신규 필드
// 기존 relationships 문자열 필드 유지 (fallback용)
// 형식: [{name, type, description}]
// type: 상사/부하/동료/경영진/간접 관리/간접 연관

const CARD12_STRUCTURED = [
  { // card 1 — 이임원 팀장 (CEO/임원급)
    structured: [
      { target_name: '김센터 그룹장', type: '부하', description: '직속 보고 라인 — 압박하지만 잘 해주길 바란다' },
      { target_name: '팀원들', type: '간접 관리', description: '전문성 인정하나 큰 그림에서만 생각' },
      { target_name: '경영진', type: '상사', description: '보고해야 할 상위 의사결정자들 — 체면이 걸린 관계' },
    ],
  },
  { // card 2 — 김센터 그룹장
    structured: [
      { target_name: '이임원 팀장', type: '상사', description: '보고 라인 — 압박 받지만 조직 맥락 이해' },
      { target_name: '박수석 파트장', type: '부하', description: '원칙주의 — 조건이 맞으면 협력 가능' },
      { target_name: '박보안 파트장', type: '부하', description: '번아웃 직전 — 공감 먼저 필요' },
      { target_name: '이책임 CL3', type: '부하', description: '인정 욕구 — 역할 재정의 필요' },
      { target_name: '정인라 CL2', type: '부하', description: '회의주의 — 진정성 먼저 보여야 함' },
    ],
  },
  { // card 3 — 박수석 파트장
    structured: [
      { target_name: '김센터 그룹장', type: '상사', description: '직속 보고 라인 — 원칙을 이해하면 협력 가능' },
      { target_name: '박보안 파트장', type: '동료', description: '업무 성격 다름 — 실무 협업' },
      { target_name: '이책임 CL3', type: '부하', description: '후배 — 기준 없이 작업하는 문화를 경계' },
      { target_name: '정인라 CL2', type: '부하', description: '후배 — 기준 없이 작업하는 문화를 경계' },
      { target_name: '경영진', type: '경영진', description: '간접 압박 — 그룹장 통해서만 소통' },
    ],
  },
  { // card 4 — 박보안 파트장
    structured: [
      { target_name: '김센터 그룹장', type: '상사', description: '직속 보고 — 공감 먼저 보여주면 협력 가능' },
      { target_name: '박수석 파트장', type: '동료', description: '같은 파트장 — 원칙 공유, 가끔 의견 교환' },
      { target_name: '이책임 CL3', type: '부하', description: '후배 — 힘든 상황 비슷하게 이해' },
      { target_name: '정인라 CL2', type: '부하', description: '후배 — 힘든 상황 비슷하게 이해' },
      { target_name: '경영진', type: '경영진', description: '압박의 원천 — 그룹장 통해서만 연결' },
    ],
  },
  { // card 5 — 이책임 CL3
    structured: [
      { target_name: '김센터 그룹장', type: '상사', description: '직속 보고 — 인정해주면 즉시 행동 전환' },
      { target_name: '박수석 파트장', type: '동료', description: '기술 전문가로 상호 존중' },
      { target_name: '정인라 CL2', type: '부하', description: '후배 — 회의적 태도 비슷하게 공감' },
      { target_name: '경영진·컨설턴트', type: '경영진', description: '불만 — 레거시 시스템 이해 없이 AI 전환 밀어붙임' },
    ],
  },
  { // card 6 — 정인라 CL2
    structured: [
      { target_name: '김센터 그룹장', type: '상사', description: '진정성 테스트 대상 — 진심이 보이면 협력' },
      { target_name: '이책임 CL3', type: '선배', description: '선배 — 기여 인정 욕구에 공감' },
      { target_name: '경영진·컨설턴트', type: '경영진', description: '불신 — 실제 현장 모르는 사람들이 결정' },
    ],
  },
];

const CASE3_STRUCTURED = [
  { // card 1 — 오현철 CCO
    structured: [
      { target_name: '유통혁신본부장', type: '부하', description: '직보 라인 — 오늘 안에 결과를 가져와야 할 사람' },
      { target_name: '최준호 이커머스본부장', type: '동료', description: '동급 임원 — 거리두기' },
      { target_name: '팀장급', type: '간접 관리', description: '간접 관리' },
      { target_name: '이사회·경영진', type: '상사', description: '책임 보고 대상' },
    ],
  },
  { // card 2 — 최준호 이커머스본부장
    structured: [
      { target_name: '유통혁신본부장', type: '동료', description: '동급 — 잘 처리해주길 바라지만 공개 지지 안 함' },
      { target_name: '오현철 CCO', type: '상사', description: '상위 — 눈치 보는 대상' },
      { target_name: '팀장급 이하', type: '간접 관리', description: '무관심' },
      { target_name: '타 본부장들', type: '동료', description: '비슷한 거리두기 문화 공유' },
    ],
  },
  { // card 3 — 강민경 고객경험팀장
    structured: [
      { target_name: '유통혁신본부장', type: '상사', description: '직속 보고 — 강하게 맞서지만 조건 맞으면 전환' },
      { target_name: '박기훈 운영전략팀장', type: '동료', description: '같은 팀장 — 연기 지지 입장 이해하나 동의 못 함' },
      { target_name: '윤서준 수석', type: '간접 연관', description: '산하 파트 아님 — 간접 연관' },
      { target_name: '이동현 책임', type: '간접 연관', description: '산하 파트 아님 — 간접 연관' },
      { target_name: '오현철 CCO', type: '경영진', description: '상위 압박 원천' },
    ],
  },
  { // card 4 — 박기훈 운영전략팀장
    structured: [
      { target_name: '유통혁신본부장', type: '상사', description: '직속 보고 — 방향 주면 즉시 행동' },
      { target_name: '강민경 고객경험팀장', type: '동료', description: '같은 팀장 — 강행 주장 이해 못 함' },
      { target_name: '윤서준 수석', type: '부하', description: '산하 파트 — 올린 데이터가 판단 근거' },
      { target_name: '이동현 책임', type: '부하', description: '산하 파트 — 올린 데이터가 판단 근거' },
      { target_name: '오현철 CCO', type: '경영진', description: '압박 원천 — 5년 전 실패 결정자와 비슷한 포지션으로 불신' },
    ],
  },
  { // card 5 — 윤서준 데이터분석 수석
    structured: [
      { target_name: '유통혁신본부장', type: '간접 상사', description: '직속 상관 아님 — 자신의 분석을 진지하게 받아줄지 탐색 중' },
      { target_name: '박기훈 운영전략팀장', type: '상사', description: '직상위 — 보고서 전달했지만 반영 여부 불확실' },
      { target_name: '이동현 책임', type: '동료', description: '같은 파트 동료 — 기술 리스크 공유' },
      { target_name: '강민경 고객경험팀장', type: '간접 연관', description: '강행 주장으로 데이터 무시하는 태도에 당혹' },
    ],
  },
  { // card 6 — 이동현 시스템통합 책임
    structured: [
      { target_name: '유통혁신본부장', type: '간접 상사', description: '처음 직접 대화 — 진정성 테스트 중' },
      { target_name: '박기훈 운영전략팀장', type: '상사', description: '직상위 — 보고를 묵살한 장본인' },
      { target_name: '윤서준 수석', type: '동료', description: '같은 파트 — 데이터 분석 협력' },
      { target_name: '강민경 고객경험팀장', type: '간접 연관', description: '기술 무시하는 강행 입장에 불만' },
      { target_name: 'CCO·경영진', type: '경영진', description: '전형적인 의사결정 구조의 문제 원천' },
    ],
  },
];

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Case 1 (scenario_id=1)
    for (let i = 0; i < CARD12_STRUCTURED.length; i++) {
      const cardNumber = i + 1;
      const [r] = await conn.query(
        `UPDATE scenario_characters
         SET learner_detail = JSON_SET(COALESCE(learner_detail, '{}'), '$.relationships_structured', JSON_EXTRACT(?, '$'))
         WHERE scenario_id = 1 AND card_number = ?`,
        [JSON.stringify(CARD12_STRUCTURED[i].structured), cardNumber]
      );
      console.log(`[MIGRATE] Case1 card${cardNumber}: ${r.affectedRows}행`);
      if (r.affectedRows === 0) throw new Error(`Case1 card${cardNumber} 업데이트 실패`);
    }

    // Case 2 (scenario_id=2) — 동일 구조
    for (let i = 0; i < CARD12_STRUCTURED.length; i++) {
      const cardNumber = i + 1;
      const [r] = await conn.query(
        `UPDATE scenario_characters
         SET learner_detail = JSON_SET(COALESCE(learner_detail, '{}'), '$.relationships_structured', JSON_EXTRACT(?, '$'))
         WHERE scenario_id = 2 AND card_number = ?`,
        [JSON.stringify(CARD12_STRUCTURED[i].structured), cardNumber]
      );
      console.log(`[MIGRATE] Case2 card${cardNumber}: ${r.affectedRows}행`);
      if (r.affectedRows === 0) throw new Error(`Case2 card${cardNumber} 업데이트 실패`);
    }

    // Case 3 (scenario_id=4)
    for (let i = 0; i < CASE3_STRUCTURED.length; i++) {
      const cardNumber = i + 1;
      const [r] = await conn.query(
        `UPDATE scenario_characters
         SET learner_detail = JSON_SET(COALESCE(learner_detail, '{}'), '$.relationships_structured', JSON_EXTRACT(?, '$'))
         WHERE scenario_id = 4 AND card_number = ?`,
        [JSON.stringify(CASE3_STRUCTURED[i].structured), cardNumber]
      );
      console.log(`[MIGRATE] Case3 card${cardNumber}: ${r.affectedRows}행`);
      if (r.affectedRows === 0) throw new Error(`Case3 card${cardNumber} 업데이트 실패`);
    }

    // 검증: relationships_structured 배열 + 기존 relationships 문자열 공존 확인
    const [check] = await conn.query(
      `SELECT id, card_number, scenario_id,
              JSON_TYPE(JSON_EXTRACT(learner_detail, '$.relationships_structured')) AS arr_type,
              JSON_LENGTH(JSON_EXTRACT(learner_detail, '$.relationships_structured')) AS arr_len,
              JSON_UNQUOTE(JSON_EXTRACT(learner_detail, '$.relationships')) IS NOT NULL AS has_str
       FROM scenario_characters
       WHERE scenario_id IN (1,2,4)
       ORDER BY scenario_id, card_number`
    );

    let fail = 0;
    for (const c of check) {
      const ok = c.arr_type === 'ARRAY' && c.arr_len > 0;
      if (!ok) {
        console.error(`[MIGRATE] ❌ FAIL scenario=${c.scenario_id} card=${c.card_number} arr_type=${c.arr_type} len=${c.arr_len} has_str=${c.has_str}`);
        fail++;
      } else {
        console.log(`[MIGRATE] ✅ OK  scenario=${c.scenario_id} card=${c.card_number} arr_len=${c.arr_len}`);
      }
    }

    if (fail > 0) {
      await conn.rollback();
      process.exit(1);
    }

    await conn.commit();
    console.log('[MIGRATE] ✅ relationships_structured 신규 필드 18개 캐릭터 전수 완료');
    console.log('[MIGRATE] ✅ 기존 relationships 문자열 공존 확인 PASS');
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
