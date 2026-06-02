import 'dotenv/config';
import pool from '../../src/data-store/db.js';

// catch 21호 정정: 시나리오 3건 역할 편향 → 상황·갈등 중립 개편
// learner_role "그룹장/본부장" → "자유 선택"
// learner_brief 역할 고정 시점 → 상황 설명 + 캐릭터 입장 안내

const UPDATES = [
  {
    id: 1,
    title:               'AI 전환 압박 — 팀원 저항과 신뢰 회복',
    case_name:           'AI혁신센터 조직 갈등 시뮬레이션 — Case 1',
    context_description: '글로벌 IT기업 AI혁신센터. 경영진 성과 압박이 빨라지면서 현장 팀원들의 반발이 거세다. 각자의 입장에서 이 갈등을 어떻게 풀어갈 것인가.',
    learner_role:        '자유 선택',
    learner_brief:       'AI혁신센터 내부에서 AI 전환 압박과 팀원 저항이 충돌하는 상황입니다. 선택한 캐릭터의 입장에서 대화를 통해 갈등을 해소해 보세요.',
    learner_mission:     '대화 상대의 입장과 우려를 파악하고, 공감과 설득으로 협력을 이끌어내세요. 역할별 상세 미션은 캐릭터 카드에서 확인할 수 있습니다.',
  },
  {
    id: 2,
    title:               'AI 성과 보고 D-14 — 경영진 압박과 현장 번아웃',
    case_name:           'AI혁신센터 조직 갈등 시뮬레이션 — Case 2',
    context_description: '글로벌 IT기업 AI혁신센터. 경영진 KPI 보고 2주 전, 팀 내 번아웃과 회의감이 극에 달했다. 성과와 현장 사이, 각자의 선택은?',
    learner_role:        '자유 선택',
    learner_brief:       'AI 성과 보고를 앞두고 경영진 압박과 현장 번아웃이 충돌하는 상황입니다. 선택한 캐릭터의 입장에서 이 간극을 어떻게 좁힐지 경험해 보세요.',
    learner_mission:     '이해관계자의 감정과 입장을 파악하고, 실현 가능한 협력 방향을 찾아가세요. 역할별 상세 미션은 캐릭터 카드에서 확인할 수 있습니다.',
  },
  {
    id: 4,
    title:               'CDP 전환 위기 — 30일의 선택',
    case_name:           '시스템 전환 위기 시뮬레이션 — 긴급 의사결정',
    context_description: '대형 유통그룹 DX통합본부. 147억 원을 투자한 CDP 전환 D-30, 치명적 오류가 발견됐다. 각자의 입장에서 이 위기를 어떻게 돌파할 것인가.',
    learner_role:        '자유 선택',
    learner_brief:       'DX통합본부 CDP 전환 D-30에 치명적 오류가 발견된 위기 상황입니다. 선택한 캐릭터의 입장에서 위기를 분석하고 해결책을 이끌어내세요.',
    learner_mission:     '이해관계자들의 우려를 파악하고, 구체적 근거와 공감으로 합의 가능한 방향을 도출하세요. 역할별 상세 미션은 캐릭터 카드에서 확인할 수 있습니다.',
  },
];

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    for (const u of UPDATES) {
      const [result] = await conn.query(
        `UPDATE scenarios
         SET title = ?, case_name = ?, context_description = ?,
             learner_role = ?, learner_brief = ?, learner_mission = ?
         WHERE id = ?`,
        [u.title, u.case_name, u.context_description,
         u.learner_role, u.learner_brief, u.learner_mission, u.id]
      );
      console.log(`[MIGRATE] ID ${u.id} (${u.title}): ${result.affectedRows}건 업데이트`);
      if (result.affectedRows === 0) {
        throw new Error(`ID ${u.id} — DB에서 시나리오를 찾지 못했습니다.`);
      }
    }

    // 검증: 역할 편향 표현 잔존 확인
    const [check] = await conn.query(
      `SELECT id, title
       FROM scenarios
       WHERE title      LIKE '%그룹장 워크샵%'
          OR case_name  LIKE '%그룹장 리더십%'
          OR learner_role IN ('그룹장', '본부장')`
    );
    if (check.length > 0) {
      console.error('[MIGRATE] ❌ 역할 편향 표현 잔존:', check.map(r => `${r.id}:${r.title}`));
      await conn.rollback();
      process.exit(1);
    }

    await conn.commit();
    console.log('[MIGRATE] ✅ 시나리오 3건 중립 개편 완료');
    console.log('[MIGRATE] ✅ 역할 편향 표현 잔존 0건 PASS');
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
