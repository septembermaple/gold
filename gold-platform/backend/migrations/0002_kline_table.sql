-- Gold Kline Table
-- Migration: 0002_kline_table

CREATE TABLE IF NOT EXISTS gold_kline (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period TEXT NOT NULL,  -- '1h', '4h', '1d', '1w'
  time TEXT NOT NULL,    -- 时间，如 '2025-01-01' 或 '2025-01-01 10:00'
  open_price REAL NOT NULL,
  high_price REAL NOT NULL,
  low_price REAL NOT NULL,
  close_price REAL NOT NULL,
  volume REAL DEFAULT 0,
  source TEXT DEFAULT 'yahoo',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(period, time)
);

CREATE INDEX idx_gold_kline_period_time ON gold_kline(period, time);
