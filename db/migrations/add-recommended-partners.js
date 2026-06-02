import 'dotenv/config';
import pool from '../../src/data-store/db.js';

// Phase C v3 추천 첫 대화 상대 매핑
// learner_detail.recommended_first_partners: [{character_id, reason}]
// 대상 범위: 대화 상대 가능 전체 (is_selectable 무관, 학습자 본인 제외)
// 근거: learner_detail.relationships 기반

const MAPPINGS = [
  // ── Case 1 (scenario_id=1) ──────────────────────────────────────────────────
  {
    id: 1, // 이임원 팀장 연기 시
    recommended: [{ character_id: 2, reason: '직속 보고 라인 — AI 성과 압박 전달 대상' }],
  },
  {
    id: 2, // 김센터 그룹장 연기 시
    recommended: [
      { character_id: 1, reason: '상위 보고 라인 — 경영진 압박 수신 대상' },
      { character_id: 3, reason: '원칙주의 핵심 갈등 팀원 — 설득 우선순위' },
    ],
  },
  {
    id: 3, // 박수석 파트장 연기 시
    recommended: [{ character_id: 2, reason: '직속 보고 라인 — 현장 원칙 전달 대상' }],
  },
  {
    id: 4, // 박보안 파트장 연기 시
    recommended: [{ character_id: 2, reason: '직속 보고 라인 — 업무 과부하 조율 대상' }],
  },
  {
    id: 5, // 이책임 CL3 연기 시
    recommended: [{ character_id: 2, reason: '직속 보고 라인 — 기여 인정 요청 대상' }],
  },
  {
    id: 6, // 정인라 CL2 연기 시
    recommended: [{ character_id: 2, reason: '직속 보고 라인 — 프로젝트 진정성 확인 대상' }],
  },

  // ── Case 2 (scenario_id=2) — 동일 조직 구조, 동일 추천 패턴 ─────────────────
  {
    id: 7, // 이임원 팀장 연기 시
    recommended: [{ character_id: 8, reason: '직속 보고 라인 — AI 성과 압박 전달 대상' }],
  },
  {
    id: 8, // 김센터 그룹장 연기 시
    recommended: [
      { character_id: 7, reason: '상위 보고 라인 — 경영진 압박 수신 대상' },
      { character_id: 9, reason: '원칙주의 핵심 갈등 팀원 — 설득 우선순위' },
    ],
  },
  {
    id: 9,  // 박수석 파트장 연기 시
    recommended: [{ character_id: 8, reason: '직속 보고 라인 — 현장 원칙 전달 대상' }],
  },
  {
    id: 10, // 박보안 파트장 연기 시
    recommended: [{ character_id: 8, reason: '직속 보고 라인 — 업무 과부하 조율 대상' }],
  },
  {
    id: 11, // 이책임 CL3 연기 시
    recommended: [{ character_id: 8, reason: '직속 보고 라인 — 기여 인정 요청 대상' }],
  },
  {
    id: 12, // 정인라 CL2 연기 시
    recommended: [{ character_id: 8, reason: '직속 보고 라인 — 프로젝트 진정성 확인 대상' }],
  },

  // ── Case 3 (scenario_id=4) — CDP 전환 위기 ──────────────────────────────────
  {
    id: 13, // 오현철 CCO 연기 시
    recommended: [{ character_id: 15, reason: '핵심 갈등 팀장 — CDP 강행 주창자, 의견 차이 최대' }],
  },
  {
    id: 14, // 최준호 이커머스본부장 연기 시
    recommended: [{ character_id: 15, reason: '동본부 핵심 갈등 당사자 — CDP 위기 입장 파악 우선' }],
  },
  {
    id: 15, // 강민경 고객경험팀장 연기 시
    recommended: [{ character_id: 13, reason: '최종 의사결정자 — 전환 일정 확정 권한 보유' }],
  },
  {
    id: 16, // 박기훈 운영전략팀장 연기 시
    recommended: [{ character_id: 15, reason: '핵심 갈등 팀장 — 강행 vs 파일럿 의견 조율 대상' }],
  },
  {
    id: 17, // 윤서준 데이터분석 수석 연기 시
    recommended: [{ character_id: 15, reason: '상위 팀장 — 분석 결과 보고 및 방향 결정 대상' }],
  },
  {
    id: 18, // 이동현 시스템통합 책임 연기 시
    recommended: [{ character_id: 15, reason: '상위 팀장 — 시스템 통합 현황 보고 대상' }],
  },
];

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const m of MAPPINGS) {
      const [result] = await conn.query(
        `UPDATE scenario_characters
         SET learner_detail = JSON_SET(learner_detail, '$.recommended_first_partners', CAST(? AS JSON))
         WHERE id = ?`,
        [JSON.stringify(m.recommended), m.id]
      );
      console.log(`[MIGRATE] ID ${m.id}: ${result.affectedRows}건 업데이트 (추천 ${m.recommended.length}건)`);
      if (result.affectedRows === 0) {
        throw new Error(`ID ${m.id} — 캐릭터를 찾지 못했습니다.`);
      }
    }

    // 검증: 추천 ID가 자기 자신을 가리키는 경우 없는지
    const [selfRef] = await conn.query(
      `SELECT id, JSON_EXTRACT(learner_detail, '$.recommended_first_partners') AS recs
       FROM scenario_characters
       WHERE JSON_SEARCH(learner_detail, 'one', CAST(id AS CHAR), NULL, '$.recommended_first_partners[*].character_id') IS NOT NULL`
    );
    if (selfRef.length > 0) {
      console.error('[MIGRATE] ❌ 자기 자신 추천 오류:', selfRef.map(r => r.id));
      await conn.rollback();
      process.exit(1);
    }

    await conn.commit();
    console.log('[MIGRATE] ✅ 추천 첫 대화 상대 매핑 완료 — 18개 캐릭터');
    console.log('[MIGRATE] ✅ 자기 참조 오류 0건 PASS');
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
