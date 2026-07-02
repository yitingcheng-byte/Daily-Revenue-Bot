import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import db from './src/server/db.js';
import { CHANNELS } from './src/types.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // --- API Routes ---

  // Exchange Rates
  app.get('/api/rates/:month', (req, res) => {
    const rate = db.prepare('SELECT * FROM exchange_rates WHERE month = ?').get(req.params.month);
    res.json(rate || null);
  });

  app.get('/api/rates/year/:year', (req, res) => {
    const year = req.params.year;
    const rates = db.prepare(`SELECT * FROM exchange_rates WHERE month LIKE ? || '-%' ORDER BY month ASC`).all(year);
    res.json(rates);
  });

  app.post('/api/rates/batch', (req, res) => {
    const { rates } = req.body;
    if (!Array.isArray(rates)) return res.status(400).json({ error: 'Valid rates array required' });
    
    const insert = db.prepare(`
      INSERT INTO exchange_rates (month, buy_rate, sell_rate, avg_rate)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(month) DO UPDATE SET 
        buy_rate = excluded.buy_rate, 
        sell_rate = excluded.sell_rate, 
        avg_rate = excluded.avg_rate
    `);

    const insertMany = db.transaction((rates) => {
      for (const r of rates) {
        if (r.buy_rate && r.sell_rate) {
           insert.run(r.month, r.buy_rate, r.sell_rate, r.avg_rate);
        }
      }
    });

    insertMany(rates);
    res.json({ success: true });
  });

  app.post('/api/rates', (req, res) => {
    const { month, buy_rate, sell_rate, avg_rate } = req.body;
    db.prepare(`
      INSERT INTO exchange_rates (month, buy_rate, sell_rate, avg_rate)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(month) DO UPDATE SET 
        buy_rate = excluded.buy_rate, 
        sell_rate = excluded.sell_rate, 
        avg_rate = excluded.avg_rate
    `).run(month, buy_rate, sell_rate, avg_rate);
    res.json({ success: true });
  });

  // Targets
  app.get('/api/targets/:month', (req, res) => {
    const targets = db.prepare('SELECT * FROM monthly_targets WHERE month = ?').all(req.params.month);
    res.json(targets);
  });

  app.get('/api/targets/year/:year', (req, res) => {
    const year = req.params.year;
    const targets = db.prepare(`SELECT * FROM monthly_targets WHERE month LIKE ? || '-%' ORDER BY month ASC, channel ASC`).all(year);
    res.json(targets);
  });

  app.post('/api/targets', (req, res) => {
    const { targets } = req.body;
    if (!Array.isArray(targets)) return res.status(400).json({ error: 'Valid targets array required' });
    
    const insert = db.prepare(`
      INSERT INTO monthly_targets (month, channel, annual_target, cy_revenue, py_revenue, ppy_revenue, high_target, low_target, note)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(month, channel) DO UPDATE SET
        annual_target = excluded.annual_target,
        cy_revenue = excluded.cy_revenue,
        py_revenue = excluded.py_revenue,
        ppy_revenue = excluded.ppy_revenue,
        high_target = excluded.high_target,
        low_target = excluded.low_target,
        note = excluded.note
    `);

    const insertMany = db.transaction((targets) => {
      for (const t of targets) {
        insert.run(t.month, t.channel, t.annual_target, t.cy_revenue, t.py_revenue, t.ppy_revenue, t.high_target, t.low_target, t.note);
      }
    });

    insertMany(targets);
    res.json({ success: true });
  });

  // Snapshots
  app.get('/api/snapshots/:month', (req, res) => {
    const snapshots = db.prepare('SELECT * FROM daily_snapshots WHERE report_month = ?').all(req.params.month);
    res.json(snapshots);
  });

  app.post('/api/snapshots', (req, res) => {
    const { snapshot_date, report_month, report_date, results } = req.body;
    
    const insert = db.prepare(`
      INSERT INTO daily_snapshots (snapshot_date, report_month, report_date, channel, revenue, achievement_rate, yoy_rate, ppy_rate, high_achievement_rate, low_achievement_rate)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Remove old snapshots for this exact date before inserting
    db.prepare('DELETE FROM daily_snapshots WHERE snapshot_date = ? AND report_date = ?').run(snapshot_date, report_date);

    const insertMany = db.transaction((results) => {
      for (const r of results) {
        insert.run(snapshot_date, report_month, report_date, r.channel, r.revenue, r.achievement_rate, r.yoy_rate, r.ppy_rate, r.high_achievement_rate, r.low_achievement_rate);
      }
    });

    insertMany(results);
    res.json({ success: true });
  });

  // Quarterly Forecast
  app.get('/api/quarter-forecast/:month', (req, res) => {
    const reportMonth = req.params.month;
    if (!reportMonth || !reportMonth.match(/^\d{4}-\d{2}$/)) return res.json(null);

    const year = parseInt(reportMonth.substring(0, 4), 10);
    const month = parseInt(reportMonth.substring(5, 7), 10);
    const quarter = Math.ceil(month / 3);

    const m1 = `${year}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}`;
    const m2 = `${year}-${String((quarter - 1) * 3 + 2).padStart(2, '0')}`;
    const m3 = `${year}-${String((quarter - 1) * 3 + 3).padStart(2, '0')}`;
    const quarterMonths = [m1, m2, m3];

    let queryHigh = 0;
    let queryLow = 0;
    let queryPy = 0;
    let queryCy = 0;

    const details: any[] = [];
    for (const m of quarterMonths) {
      const targetsOfM = db.prepare('SELECT * FROM monthly_targets WHERE month = ?').all(m) as any[];
      let tHigh = 0;
      let tLow = 0;
      let tPy = 0;
      let tCy = 0;
      let usedSnapshot = false;
      if (m === reportMonth) {
        const latestSnap = db.prepare('SELECT snapshot_date, report_date FROM daily_snapshots WHERE report_month = ? ORDER BY report_date DESC, snapshot_date DESC LIMIT 1').get(m) as { snapshot_date: string, report_date: string } | undefined;
        if (latestSnap) {
          const snapshots = db.prepare('SELECT channel, revenue FROM daily_snapshots WHERE report_month = ? AND snapshot_date = ? AND report_date = ?').all(m, latestSnap.snapshot_date, latestSnap.report_date) as any[];
          for (const s of snapshots) {
            if (CHANNELS.includes(s.channel)) {
              tCy += s.revenue || 0;
            }
          }
          usedSnapshot = true;
        }
      }

      for (const t of targetsOfM) {
        if (!CHANNELS.includes(t.channel)) continue;
        tHigh += t.high_target || 0;
        tLow += t.low_target || 0;
        tPy += t.py_revenue || 0;
        if (!usedSnapshot) {
          tCy += t.cy_revenue || 0;
        }
      }
      queryPy += tPy;
      queryCy += tCy;

      if (m < reportMonth) {
        queryHigh += tCy;
        queryLow += tCy;
        details.push({ month: m, type: 'actual', valueHigh: tCy, valueLow: tCy, pyRevenue: tPy, cyRevenue: tCy });
      } else {
        queryHigh += tHigh;
        queryLow += tLow;
        details.push({ month: m, type: 'forecast', valueHigh: tHigh, valueLow: tLow, pyRevenue: tPy, cyRevenue: tCy });
      }
    }

    res.json({
      quarter,
      year,
      high_target: queryHigh,
      low_target: queryLow,
      py_revenue: queryPy,
      cy_revenue: queryCy,
      yoy_high: queryPy > 0 ? (queryHigh - queryPy) / queryPy : 0,
      yoy_low: queryPy > 0 ? (queryLow - queryPy) / queryPy : 0,
      details,
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
