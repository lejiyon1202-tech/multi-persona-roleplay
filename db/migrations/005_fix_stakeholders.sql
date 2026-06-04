-- Phase D-3 fix: briefing.stakeholders 환각 인물명/직책 정정 (R-28-1)
-- JSON_SET으로 stakeholders 필드만 수정 — 나머지 4요소(background·conflict·learning_goal·before_start) 무변경

-- scenario 1: 환각 "이모델·최데이터·신주니어" → 실제 characters DB 인물명
UPDATE scenarios
SET briefing = JSON_SET(
  briefing,
  '$.stakeholders',
  '이임원 팀장(상위리더)은 경영진 KPI 달성을 최우선으로 보며 팀의 속도를 압박합니다. 김센터 그룹장(그룹장)은 팀원과 경영진 사이에서 중재 역할을 맡고 있습니다. 박수석·박보안(파트장)과 이책임(CL3)·정인라(CL2) 부서원은 각자의 역할에서 변화 수용도와 우려 수준이 다릅니다.'
)
WHERE id = 1;

-- scenario 4: 환각 "DX통합본부장·아키텍처 수석" → 실제 characters DB 인물명/직책
UPDATE scenarios
SET briefing = JSON_SET(
  briefing,
  '$.stakeholders',
  'CCO(오현철)는 147억 투자 성과와 일정을 최우선으로 요구합니다. 최준호(이커머스본부장)는 비즈니스 관점에서 전환의 영향을 직접 받습니다. 윤서준(데이터분석 수석)과 이동현(시스템통합 책임)은 기술적 리스크를 가장 명확히 파악하고 있으며, 강민경(고객경험팀장)과 박기훈(운영전략팀장)은 각자의 우선순위에서 해결 방향이 다릅니다.'
)
WHERE id = 4;
