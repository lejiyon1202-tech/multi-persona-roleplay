-- Phase E B안: messages 테이블에 character_id 컬럼 추가
-- AI 발화자 구분용 (user 발화는 NULL)
ALTER TABLE messages
  ADD COLUMN character_id INT UNSIGNED NULL DEFAULT NULL
    COMMENT 'Phase E B안: AI 발화자 캐릭터 ID (user 발화는 NULL)',
  ADD INDEX idx_msg_character (character_id);
