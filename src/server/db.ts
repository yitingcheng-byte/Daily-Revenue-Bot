import Database from 'better-sqlite3';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

// Ensure data directory exists
const dataDir = join(process.cwd(), 'data');
if (!existsSync(dataDir)) {
  mkdirSync(dataDir);
}

const db = new Database(join(dataDir, 'erp_revenue.sqlite'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS exchange_rates (
    month TEXT PRIMARY KEY,
    buy_rate REAL,
    sell_rate REAL,
    avg_rate REAL
  );

  CREATE TABLE IF NOT EXISTS monthly_targets (
    month TEXT,
    channel TEXT,
    annual_target REAL,
    cy_revenue REAL,
    py_revenue REAL,
    ppy_revenue REAL,
    high_target REAL,
    low_target REAL,
    note TEXT,
    PRIMARY KEY (month, channel)
  );

  CREATE TABLE IF NOT EXISTS daily_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_date TEXT,
    report_month TEXT,
    report_date TEXT,
    channel TEXT,
    revenue REAL,
    achievement_rate REAL,
    yoy_rate REAL,
    ppy_rate REAL,
    high_achievement_rate REAL,
    low_achievement_rate REAL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

try {
  db.exec('ALTER TABLE monthly_targets ADD COLUMN cy_revenue REAL DEFAULT 0;');
} catch (e) {
  // Column may already exist, ignore
}

export default db;
