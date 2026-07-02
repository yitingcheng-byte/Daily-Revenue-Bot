import { useState, useEffect } from 'react';
import { safeStorage } from '../utils/storage';
import { Save, Calculator } from 'lucide-react';

export default function ExchangeRatePage() {
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rates, setRates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchRates();
  }, [year]);

  const fetchRates = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rates/year/${year}`);
      const data = await res.json();
      
      let localData: any[] = [];
      if (data.length === 0) {
        const stored = safeStorage.getItem(`rates_year_${year}`);
        if (stored) {
          try {
            localData = JSON.parse(stored);
          } catch(e) {}
        }
      }

      const dataSource = data.length > 0 ? data : localData;
      const allRates: any[] = [];

      for (let i = 1; i <= 12; i++) {
        const m = `${year}-${String(i).padStart(2, '0')}`;
        const found = dataSource.find((d: any) => d.month === m);
        allRates.push(found || {
          month: m,
          buy_rate: '',
          sell_rate: '',
          avg_rate: ''
        });
      }
      setRates(allRates);
      
      if (data.length === 0 && localData.length > 0) {
        fetch('/api/rates/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rates: allRates })
        }).catch(console.error);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (rates.length > 0) {
      safeStorage.setItem(`rates_year_${year}`, JSON.stringify(rates));
    }
  }, [rates, year]);

  const saveRates = async () => {
    try {
      await fetch('/api/rates/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rates })
      });
      console.log('匯率已儲存');
    } catch(e) {
      console.log('儲存失敗');
    }
  };

  const updateRateField = (index: number, field: string, value: number | '') => {
    const newRates = [...rates];
    newRates[index] = { ...newRates[index], [field]: value };
    
    // Auto-calculate avg_rate if both buy and sell are present
    if (field === 'buy_rate' || field === 'sell_rate') {
      const b = typeof newRates[index].buy_rate === 'number' ? newRates[index].buy_rate : null;
      const s = typeof newRates[index].sell_rate === 'number' ? newRates[index].sell_rate : null;
      if (b !== null && s !== null) {
        newRates[index].avg_rate = (b + s) / 2;
      } else {
        newRates[index].avg_rate = '';
      }
    }
    
    setRates(newRates);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-140px)]">
      <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white shrink-0">
        <h2 className="text-xl font-medium text-gray-900 tracking-tight flex items-center gap-2">
           <Calculator className="w-5 h-5 text-indigo-600" />
           匯率設定
        </h2>
        <div className="flex gap-4 items-center">
          <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
            className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow text-sm" />
          
          <button onClick={saveRates} disabled={loading}
            className="flex gap-2 items-center text-sm font-medium text-white bg-indigo-600 px-5 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50">
            <Save className="w-4 h-4" /> 儲存年度 RMB 固定匯率
          </button>
        </div>
      </div>
      
      <div className="overflow-auto grow p-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">設定月份</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">即期買入</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">即期賣出</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">當月固定匯率 (均值)</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {rates.map((r, i) => (
              <tr key={r.month} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold text-gray-900">{r.month}</td>
                <td className="px-4 py-2">
                  <input type="number" step="0.0001" value={r.buy_rate} onChange={e => updateRateField(i, 'buy_rate', e.target.value ? Number(e.target.value) : '')}
                    className="w-32 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" />
                </td>
                <td className="px-4 py-2">
                  <input type="number" step="0.0001" value={r.sell_rate} onChange={e => updateRateField(i, 'sell_rate', e.target.value ? Number(e.target.value) : '')}
                    className="w-32 px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm" />
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="text-lg font-bold text-indigo-700 font-mono">
                    {typeof r.avg_rate === 'number' ? r.avg_rate.toFixed(4) : '-'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
