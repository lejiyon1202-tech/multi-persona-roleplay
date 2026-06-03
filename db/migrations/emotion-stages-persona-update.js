import 'dotenv/config';
import pool from '../../src/data-store/db.js';

// R-28-2: emotion_stages 3단계 완비 + label 표준화 (방어/저항/수용)
// R-26 #5: Samsung-ds 선택 캐릭터 persona_prompt 숨겨진 심리 추가

async function migrate() {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // ── 1. Samsung-ds 컨텍스트 캐릭터: label 표준화 + stage 3(수용) 추가 ────
    await conn.query(`
      UPDATE scenario_characters
      SET emotion_stages = JSON_ARRAY(
        JSON_OBJECT('stage', 1, 'label', '방어', 'mood', '조급함', 'trigger', '경영진 KPI 요청'),
        JSON_OBJECT('stage', 2, 'label', '저항', 'mood', '협상적', 'trigger', '일정 조정 논의'),
        JSON_OBJECT('stage', 3, 'label', '수용', 'mood', '협력적', 'trigger', '합의 도출')
      )
      WHERE name = '이임원 팀장' AND card_number = 1 AND is_selectable = 0
    `);

    await conn.query(`
      UPDATE scenario_characters
      SET emotion_stages = JSON_ARRAY(
        JSON_OBJECT('stage', 1, 'label', '방어', 'mood', '방어적', 'trigger', '양쪽 압박 동시 수신'),
        JSON_OBJECT('stage', 2, 'label', '저항', 'mood', '고민', 'trigger', '팀원 면담'),
        JSON_OBJECT('stage', 3, 'label', '수용', 'mood', '결단', 'trigger', '지지 확인')
      )
      WHERE name = '김센터 그룹장' AND card_number = 2 AND is_selectable = 0
    `);

    // ── 2. Scenario-b 컨텍스트 캐릭터: label 표준화 + stage 3(수용) 추가 ────
    await conn.query(`
      UPDATE scenario_characters
      SET emotion_stages = JSON_ARRAY(
        JSON_OBJECT('stage', 1, 'label', '방어', 'mood', '압박적', 'trigger', '치명적 결함 최초 보고 수신'),
        JSON_OBJECT('stage', 2, 'label', '저항', 'mood', '타협 가능', 'trigger', '학습자가 명분 있는 권고안 제시'),
        JSON_OBJECT('stage', 3, 'label', '수용', 'mood', '협력적', 'trigger', '명분 완전 충족')
      )
      WHERE name = '오현철 CCO' AND card_number = 1 AND is_selectable = 0
    `);

    await conn.query(`
      UPDATE scenario_characters
      SET emotion_stages = JSON_ARRAY(
        JSON_OBJECT('stage', 1, 'label', '방어', 'mood', '중립·불안', 'trigger', '사태 연루 가능성 인지'),
        JSON_OBJECT('stage', 2, 'label', '저항', 'mood', '관망', 'trigger', '학습자가 사태를 잘 수습할 것으로 보일 때'),
        JSON_OBJECT('stage', 3, 'label', '수용', 'mood', '안도', 'trigger', '사태 수습 확인')
      )
      WHERE name = '최준호 이커머스본부장' AND card_number = 2 AND is_selectable = 0
    `);

    // ── 3. Samsung-ds 선택 캐릭터: label 표준화 + 숨겨진 심리 추가 ───────────
    await conn.query(`
      UPDATE scenario_characters
      SET emotion_stages = JSON_ARRAY(
        JSON_OBJECT('stage', 1, 'label', '방어', 'mood', '방어적', 'trigger', '무리한 요구 수신'),
        JSON_OBJECT('stage', 2, 'label', '저항', 'mood', '신중함', 'trigger', '구체적 범위 제시'),
        JSON_OBJECT('stage', 3, 'label', '수용', 'mood', '협력적', 'trigger', '검증 기준 합의')
      ),
      persona_prompt = CONCAT(persona_prompt,
        '\n\n[숨겨진 심리 — 대화에서 직접 드러내지 말 것, 반응에만 반영]\n원칙을 지키지 못하면 팀 전체의 신뢰가 무너진다는 두려움이 있다. 하지만 조직 전체의 방향이 바뀌는 상황에서 혼자 버티면 고립될 수 있다는 불안감도 공존한다.')
      WHERE name = '박수석 파트장' AND card_number = 3 AND is_selectable = 1
        AND persona_prompt NOT LIKE '%숨겨진 심리%'
    `);

    await conn.query(`
      UPDATE scenario_characters
      SET emotion_stages = JSON_ARRAY(
        JSON_OBJECT('stage', 1, 'label', '방어', 'mood', '지침', 'trigger', '추가 요구 수신'),
        JSON_OBJECT('stage', 2, 'label', '저항', 'mood', '현실적', 'trigger', '우선순위 논의'),
        JSON_OBJECT('stage', 3, 'label', '수용', 'mood', '협력적', 'trigger', '업무 경감 약속')
      ),
      persona_prompt = CONCAT(persona_prompt,
        '\n\n[숨겨진 심리 — 대화에서 직접 드러내지 말 것, 반응에만 반영]\n사실 AI 전환 자체에는 기대감이 있다. 단지 아무런 지원 없이 과중한 업무만 추가되는 것이 두렵다. 제대로 된 지원을 받으면 협력할 의향이 있다.')
      WHERE name = '박보안 파트장' AND card_number = 4 AND is_selectable = 1
        AND persona_prompt NOT LIKE '%숨겨진 심리%'
    `);

    await conn.query(`
      UPDATE scenario_characters
      SET emotion_stages = JSON_ARRAY(
        JSON_OBJECT('stage', 1, 'label', '방어', 'mood', '서운함', 'trigger', '시스템 교체 통보'),
        JSON_OBJECT('stage', 2, 'label', '저항', 'mood', '방어적', 'trigger', 'AI 당위성 압박'),
        JSON_OBJECT('stage', 3, 'label', '수용', 'mood', '협력적', 'trigger', '기여 인정 + 역할 제안')
      ),
      persona_prompt = CONCAT(persona_prompt,
        '\n\n[숨겨진 심리 — 대화에서 직접 드러내지 말 것, 반응에만 반영]\n자신이 만든 시스템이 AI에 의해 완전히 대체되면 전문성이 쓸모없어진다는 두려움이 핵심이다. 역할을 인정받으면서 새 시스템에서도 활약할 수 있다는 확신이 생기면 태도가 바뀔 수 있다.')
      WHERE name = '이책임 CL3' AND card_number = 5 AND is_selectable = 1
        AND persona_prompt NOT LIKE '%숨겨진 심리%'
    `);

    await conn.query(`
      UPDATE scenario_characters
      SET emotion_stages = JSON_ARRAY(
        JSON_OBJECT('stage', 1, 'label', '방어', 'mood', '냉소적', 'trigger', '형식적 보고 지시'),
        JSON_OBJECT('stage', 2, 'label', '저항', 'mood', '비판적', 'trigger', '실적 압박'),
        JSON_OBJECT('stage', 3, 'label', '수용', 'mood', '동기부여됨', 'trigger', '진정성 + 실질 목표 확인')
      ),
      persona_prompt = CONCAT(persona_prompt,
        '\n\n[숨겨진 심리 — 대화에서 직접 드러내지 말 것, 반응에만 반영]\n회의감 뒤에는 사실 이 프로젝트가 성공하길 바라는 마음이 있다. 단지 또 형식적인 결과물을 만드는 도구가 되고 싶지 않을 뿐이다. 진짜 목적이 있다고 느끼면 몰입할 수 있다.')
      WHERE name = '정인라 CL2' AND card_number = 6 AND is_selectable = 1
        AND persona_prompt NOT LIKE '%숨겨진 심리%'
    `);

    await conn.commit();
    console.log('[MIGRATE] ✅ emotion_stages 표준화 + persona_prompt 숨겨진 심리 추가 완료');

    // ── 검증 ────────────────────────────────────────────────────────────────
    const [rows] = await conn.query(`
      SELECT name, card_number, is_selectable,
             JSON_LENGTH(emotion_stages) AS stage_count,
             JSON_UNQUOTE(JSON_EXTRACT(emotion_stages, '$[0].label')) AS s1,
             JSON_UNQUOTE(JSON_EXTRACT(emotion_stages, '$[1].label')) AS s2,
             JSON_UNQUOTE(JSON_EXTRACT(emotion_stages, '$[2].label')) AS s3,
             (persona_prompt LIKE '%숨겨진 심리%') AS has_hidden_psych
      FROM scenario_characters
      WHERE card_number BETWEEN 1 AND 6
        AND scenario_id IN (SELECT id FROM scenarios WHERE case_name LIKE '%AI혁신%' OR case_name LIKE '%유통그룹%' OR title LIKE '%Case%')
      ORDER BY scenario_id, card_number
    `);

    console.log('\n[VERIFY] 캐릭터별 검증:');
    for (const r of rows) {
      const stageOk = r.stage_count === 3 ? '✓' : '⚠️';
      const psychNote = r.is_selectable === 0 ? '' : (r.has_hidden_psych ? ' ✓심리' : ' ⚠️심리없음');
      console.log(`${stageOk} ${r.name} (card${r.card_number}·sel:${r.is_selectable}): ${r.stage_count}단계 [${r.s1}/${r.s2}/${r.s3}]${psychNote}`);
    }

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
