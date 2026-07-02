import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { safeStorage } from '../utils/storage';
import { Save, UploadCloud, Download, Target } from 'lucide-react';
import { CHANNELS, MonthlyTarget } from '../types';

const readXlsxSilent = (data: any, options: any) => {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  try {
    return XLSX.read(data, options);
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
};

export default function TargetsPage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [targets, setTargets] = useState<MonthlyTarget[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchTargets();
  }, [year]);

  const fetchTargets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/targets/year/${year}`);
      const data: MonthlyTarget[] = await res.json();
      
      let localData: MonthlyTarget[] = [];
      if (data.length === 0) {
        const stored = safeStorage.getItem(`targets_year_${year}`);
        if (stored) {
          try {
            localData = JSON.parse(stored);
          } catch(e) {}
        }
      }

      const dataSource = data.length > 0 ? data : localData;
      const allTargets: MonthlyTarget[] = [];

      for (let i = 1; i <= 12; i++) {
        const m = `${year}-${String(i).padStart(2, '0')}`;
        for (const ch of CHANNELS) {
          const found = dataSource.find(d => d.month === m && d.channel === ch);
          allTargets.push(found || {
            month: m,
            channel: ch,
            annual_target: 0,
            cy_revenue: 0,
            py_revenue: 0,
            ppy_revenue: 0,
            high_target: 0,
            low_target: 0,
            note: ''
          });
        }
      }
      setTargets(allTargets);

      // Auto-save recovered data back to the ephemeral DB if it was empty
      if (data.length === 0 && localData.length > 0) {
        fetch('/api/targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ targets: allTargets })
        }).catch(console.error);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (targets.length > 0) {
      safeStorage.setItem(`targets_year_${year}`, JSON.stringify(targets));
    }
  }, [targets, year]);

  const saveTargets = async () => {
    try {
      await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targets })
      });
      console.log('目標設定已儲存！');
    } catch(e) {
      console.log('儲存失敗');
    }
  };

  const updateTargetField = (index: number, field: keyof MonthlyTarget, value: string | number) => {
    const newTargets = [...targets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setTargets(newTargets);
  };

  const downloadTemplate = () => {
    const data: any[] = [];
    for (let i = 1; i <= 12; i++) {
      const m = `${year}-${String(i).padStart(2, '0')}`;
      for (const ch of CHANNELS) {
        data.push({
          '報表月份': m,
          '通路': ch,
          '年度預算月目標': 0,
          '今年當月營收': 0,
          '去年當月營收': 0,
          '前年當月營收': 0,
          '高標預估': 0,
          '低標預估': 0,
          '備註': '年初版'
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '目標預估');
    XLSX.writeFile(wb, `年度目標範本_${year}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = readXlsxSilent(data, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const dataList = XLSX.utils.sheet_to_json<any>(ws);
      
      const importedTargets: MonthlyTarget[] = [];
      dataList.forEach(row => {
        const m = row['報表月份'] || row['月份'];
        const ch = row['通路'];
        if (!m || !ch) return;
        
        importedTargets.push({
          month: String(m),
          channel: String(ch),
          annual_target: Number(row['年度預算月目標'] || 0),
          cy_revenue: Number(row['今年當月營收'] || 0),
          py_revenue: Number(row['去年當月營收'] || 0),
          ppy_revenue: Number(row['前年當月營收'] || 0),
          high_target: Number(row['高標預估'] || 0),
          low_target: Number(row['低標預估'] || 0),
          note: String(row['備註'] || '')
        });
      });

      if (importedTargets.length > 0) {
        try {
          await fetch('/api/targets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ targets: importedTargets })
          });
          console.log('批次匯入成功！準備重新載入。');
          await fetchTargets();
        } catch(err) {
          console.log('匯入失敗');
        }
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
         <h2 className="text-xl font-medium text-gray-900 tracking-tight flex items-center gap-2">
            <Target className="w-5 h-5 text-indigo-600" />
            年度目標維護
         </h2>
         <div className="flex gap-4 items-center">
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-sm" />
            
            <button onClick={downloadTemplate} className="flex gap-2 items-center text-sm font-medium text-gray-600 hover:text-gray-900 px-3 py-2 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <Download className="w-4 h-4" /> 範本
            </button>

            <label className="flex gap-2 cursor-pointer items-center text-sm font-medium text-indigo-700 bg-indigo-50 px-4 py-2 border border-indigo-100 rounded-lg hover:bg-indigo-100 transition-colors">
              <UploadCloud className="w-4 h-4" /> 批次匯入
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
            </label>

            <button onClick={saveTargets} className="flex gap-2 items-center text-sm font-medium text-white bg-indigo-600 px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors">
              <Save className="w-4 h-4" /> 儲存年度目標
            </button>
         </div>
      </div>

      <div className="overflow-auto grow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">報表月份</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">通路</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">年度預算月目標</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">今年當月營收</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">去年當月營收</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">前年當月營收</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 flex flex-col items-end">
                 高標預估
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">低標預估</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50 min-w-[200px]">備註</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {targets.map((t, i) => (
              <tr key={`${t.month}-${t.channel}`} className={i % CHANNELS.length === 0 ? "border-t-2 border-indigo-100 hover:bg-gray-50/50" : "hover:bg-gray-50/50"}>
                {i % CHANNELS.length === 0 ? (
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-indigo-700 bg-indigo-50/30" rowSpan={CHANNELS.length}>{t.month}</td>
                ) : null}
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{t.channel}</td>
                <td className="px-4 py-2 text-right">
                  <input type="number" value={t.annual_target || ''} onChange={e => updateTargetField(i, 'annual_target', Number(e.target.value))}
                    className="w-24 px-2 py-1 border rounded text-right focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm inline-block" />
                </td>
                <td className="px-4 py-2 text-right">
                  <input type="number" value={t.cy_revenue || ''} onChange={e => updateTargetField(i, 'cy_revenue', Number(e.target.value))}
                    className="w-24 px-2 py-1 border rounded text-right focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm inline-block" />
                </td>
                <td className="px-4 py-2 text-right">
                  <input type="number" value={t.py_revenue || ''} onChange={e => updateTargetField(i, 'py_revenue', Number(e.target.value))}
                    className="w-24 px-2 py-1 border rounded text-right focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm inline-block" />
                </td>
                <td className="px-4 py-2 text-right">
                  <input type="number" value={t.ppy_revenue || ''} onChange={e => updateTargetField(i, 'ppy_revenue', Number(e.target.value))}
                    className="w-24 px-2 py-1 border rounded text-right focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm inline-block" />
                </td>
                <td className="px-4 py-2 text-right">
                  <input type="number" value={t.high_target || ''} onChange={e => updateTargetField(i, 'high_target', Number(e.target.value))}
                    className="w-24 px-2 py-1 border rounded text-right bg-emerald-50 focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm inline-block" />
                </td>
                <td className="px-4 py-2 text-right">
                  <input type="number" value={t.low_target || ''} onChange={e => updateTargetField(i, 'low_target', Number(e.target.value))}
                    className="w-24 px-2 py-1 border rounded text-right bg-rose-50 focus:ring-1 focus:ring-indigo-500 outline-none font-mono text-sm inline-block" />
                </td>
                <td className="px-4 py-2">
                  <input type="text" value={t.note || ''} onChange={e => updateTargetField(i, 'note', e.target.value)}
                    className="w-full px-2 py-1 border rounded focus:ring-1 focus:ring-indigo-500 outline-none text-sm placeholder:text-gray-300" placeholder="e.g. 2026-01-12 業管更新" />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-indigo-50 sticky bottom-0 z-10 font-medium">
            <tr>
              <td className="px-4 py-3 whitespace-nowrap text-sm text-indigo-900 border-t border-indigo-100 font-bold" colSpan={2}>一年合計</td>
              <td className="px-4 py-3 text-right text-sm text-indigo-900 font-mono border-t border-indigo-100">
                {targets.reduce((sum, t) => sum + (Number(t.annual_target) || 0), 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm text-indigo-900 font-mono border-t border-indigo-100">
                {targets.reduce((sum, t) => sum + (Number(t.cy_revenue) || 0), 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm text-indigo-900 font-mono border-t border-indigo-100">
                {targets.reduce((sum, t) => sum + (Number(t.py_revenue) || 0), 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm text-indigo-900 font-mono border-t border-indigo-100">
                {targets.reduce((sum, t) => sum + (Number(t.ppy_revenue) || 0), 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm text-emerald-700 font-mono border-t border-indigo-100 font-semibold">
                {targets.reduce((sum, t) => sum + (Number(t.high_target) || 0), 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 text-right text-sm text-rose-700 font-mono border-t border-indigo-100 font-semibold">
                {targets.reduce((sum, t) => sum + (Number(t.low_target) || 0), 0).toLocaleString()}
              </td>
              <td className="px-4 py-3 border-t border-indigo-100"></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
