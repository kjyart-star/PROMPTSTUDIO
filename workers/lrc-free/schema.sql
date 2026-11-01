-- Workers AI 하루 뉴런 카운터(UTC 날짜별) — 하드 상한 9,000
CREATE TABLE IF NOT EXISTS ai_budget (
  day TEXT PRIMARY KEY,
  used REAL NOT NULL DEFAULT 0,
  reserved REAL NOT NULL DEFAULT 0
);
-- 처리 기록(최근 것만 보면 된다)
CREATE TABLE IF NOT EXISTS runs (
  at TEXT NOT NULL,
  song_id TEXT,
  kind TEXT,
  neurons REAL,
  result TEXT
);
-- 동시 실행 막기(마지막 실행 시각)
CREATE TABLE IF NOT EXISTS meta (
  k TEXT PRIMARY KEY,
  v TEXT NOT NULL
);
