-- multi-persona-roleplay DB 스키마
-- RDS MySQL 8.0 / charset utf8mb4

CREATE DATABASE IF NOT EXISTS persona_roleplay
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE persona_roleplay;

-- ── 1. 시나리오 ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenarios (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title           VARCHAR(200)  NOT NULL,
  case_name       VARCHAR(200)  NOT NULL,
  context_description TEXT      NOT NULL,
  learner_role    VARCHAR(100)  NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT (NOW())
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 2. 시나리오 캐릭터 ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scenario_characters (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  scenario_id     INT UNSIGNED  NOT NULL,
  name            VARCHAR(100)  NOT NULL,
  department      VARCHAR(100)  NOT NULL,
  role_level      ENUM('상위리더','그룹장','파트장','부서원') NOT NULL,
  card_number     TINYINT UNSIGNED NOT NULL,
  core_mindset    TEXT          NOT NULL,
  situation       TEXT          NOT NULL,
  mission         TEXT          NOT NULL,
  persona_prompt  LONGTEXT      NOT NULL,
  emotion_stages  JSON          NOT NULL,
  avatar_url      VARCHAR(500)  DEFAULT NULL,
  is_selectable   TINYINT(1)    NOT NULL DEFAULT 1
                  COMMENT '1=학습자 선택 가능 / 0=컨텍스트 전용',
  display_order   TINYINT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_sc_scenario
    FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sc_scenario   ON scenario_characters (scenario_id);
CREATE INDEX idx_sc_selectable ON scenario_characters (scenario_id, is_selectable);

-- ── 3. 학습자 ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learners (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name            VARCHAR(100)  NOT NULL,
  department      VARCHAR(100)  NOT NULL DEFAULT '',
  email           VARCHAR(200)  NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT (NOW()),
  UNIQUE KEY uq_learner_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ── 4. 세션 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sessions (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  learner_id      INT UNSIGNED  NOT NULL,
  scenario_id     INT UNSIGNED  NOT NULL,
  character_id    INT UNSIGNED  NOT NULL,
  started_at      DATETIME      NOT NULL DEFAULT (NOW()),
  ended_at        DATETIME      DEFAULT NULL,
  turn_count      SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  status          ENUM('active','completed','abandoned') NOT NULL DEFAULT 'active',
  CONSTRAINT fk_sess_learner
    FOREIGN KEY (learner_id)   REFERENCES learners(id)            ON DELETE CASCADE,
  CONSTRAINT fk_sess_scenario
    FOREIGN KEY (scenario_id)  REFERENCES scenarios(id)           ON DELETE CASCADE,
  CONSTRAINT fk_sess_character
    FOREIGN KEY (character_id) REFERENCES scenario_characters(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_sess_learner   ON sessions (learner_id);
CREATE INDEX idx_sess_scenario  ON sessions (scenario_id);
CREATE INDEX idx_sess_character ON sessions (character_id);
CREATE INDEX idx_sess_status    ON sessions (status);

-- ── 5. 메시지 ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id      INT UNSIGNED  NOT NULL,
  role            ENUM('user','assistant') NOT NULL,
  content         LONGTEXT      NOT NULL,
  turn_number     SMALLINT UNSIGNED NOT NULL,
  created_at      DATETIME      NOT NULL DEFAULT (NOW()),
  CONSTRAINT fk_msg_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX idx_msg_session ON messages (session_id, turn_number);

-- ── 6. 평가 ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS evaluations (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id      INT UNSIGNED  NOT NULL,
  scores          JSON          NOT NULL
                  COMMENT '{"역량1": 1.0, "역량2": 0.5, ...}',
  feedback        JSON          NOT NULL
                  COMMENT '{"strengths": [], "improvements": [], "overall": ""}',
  total_score     DECIMAL(4,2)  NOT NULL,
  grade           VARCHAR(10)   NOT NULL,
  evaluated_at    DATETIME      NOT NULL DEFAULT (NOW()),
  CONSTRAINT fk_eval_session
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
  UNIQUE KEY uq_eval_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
