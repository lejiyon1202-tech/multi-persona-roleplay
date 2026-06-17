-- EC2 B·C안 스키마 마이그레이션
-- 적용 전 EC2 schema SSM 직접 확인 후 필요 블록만 실행
-- charset: utf8mb4, DB: persona_roleplay

USE persona_roleplay;

-- ━━━ BLOCK 1: learners 테이블 신설 (B안) ━━━
-- EC2에 learners 테이블이 없을 경우에만 실행
CREATE TABLE IF NOT EXISTS learners (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100)  NOT NULL,
  department      VARCHAR(100)  NOT NULL DEFAULT '',
  email           VARCHAR(200)  NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT (NOW()),
  UNIQUE KEY uq_learner_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ━━━ BLOCK 2: sessions.learner_id 컬럼 + FK (B안) ━━━
-- sessions에 learner_id 컬럼이 없을 경우에만 실행
-- 주의: learners 테이블 먼저 존재해야 FK 생성 가능
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS learner_id INT UNSIGNED NOT NULL DEFAULT 0
    AFTER id;

-- learner_id DEFAULT 0 제거 후 FK 적용 (MariaDB ALTER 제약 순서 대응)
-- FK 이미 존재하면 스킵 (MariaDB 10.x: IF NOT EXISTS FK 미지원 — 수동 확인 후 실행)
-- ALTER TABLE sessions
--   ADD CONSTRAINT fk_sess_learner
--     FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE;

-- ━━━ BLOCK 3: sessions.character_id NULL 허용 (A안 v3) ━━━
-- character_id가 NOT NULL인 경우에만 실행
ALTER TABLE sessions
  MODIFY COLUMN character_id INT UNSIGNED DEFAULT NULL
    COMMENT 'deprecated — use learner_character_id';

-- ━━━ BLOCK 4: sessions 확장 컬럼 (A안 v3) ━━━
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS learner_character_id INT UNSIGNED DEFAULT NULL AFTER character_id,
  ADD COLUMN IF NOT EXISTS dialogue_partner_ids JSON DEFAULT NULL AFTER learner_character_id;

-- learner_character_id FK (ADD IF NOT EXISTS 미지원 — 수동 확인 후 실행)
-- ALTER TABLE sessions
--   ADD CONSTRAINT fk_sess_learner_char
--     FOREIGN KEY (learner_character_id) REFERENCES scenario_characters(id)
--     ON DELETE SET NULL;

-- ━━━ BLOCK 5: evaluations 테이블 신설 (C안) ━━━
CREATE TABLE IF NOT EXISTS evaluations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id      INT UNSIGNED  NOT NULL,
  scores          JSON          NOT NULL,
  feedback        JSON          NOT NULL,
  total_score     DECIMAL(4,2)  NOT NULL,
  grade           VARCHAR(10)   NOT NULL,
  evaluated_at    DATETIME      NOT NULL DEFAULT (NOW()),
  CONSTRAINT fk_eval_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_eval_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ━━━ BLOCK 6: scenario_characters 확장 (A안 v3) ━━━
ALTER TABLE scenario_characters
  ADD COLUMN IF NOT EXISTS learner_detail JSON DEFAULT NULL AFTER display_order,
  ADD COLUMN IF NOT EXISTS emoji VARCHAR(10) DEFAULT NULL AFTER learner_detail;

-- ━━━ BLOCK 7: scenarios 확장 (Phase D-3) ━━━
ALTER TABLE scenarios
  ADD COLUMN IF NOT EXISTS briefing JSON NULL,
  ADD COLUMN IF NOT EXISTS learner_brief TEXT DEFAULT NULL AFTER learner_role,
  ADD COLUMN IF NOT EXISTS learner_mission TEXT DEFAULT NULL AFTER learner_brief,
  ADD COLUMN IF NOT EXISTS learner_competencies JSON DEFAULT NULL AFTER learner_mission;

-- ━━━ BLOCK 8: messages.character_id (Phase E B안) ━━━
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS character_id INT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Phase E B안: AI 발화자 캐릭터 ID';

-- 적용 후 검증
SELECT TABLE_NAME, COLUMN_NAME
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'persona_roleplay'
  AND TABLE_NAME IN ('learners','sessions','evaluations','scenario_characters','scenarios','messages')
ORDER BY TABLE_NAME, ORDINAL_POSITION;
