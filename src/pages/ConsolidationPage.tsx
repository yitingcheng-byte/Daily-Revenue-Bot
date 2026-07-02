import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { safeStorage } from '../utils/storage';
import { ERPData, CloudStoreData, ManualInputs, CalculationResult, Anomaly, QuarterForecast, CHANNELS, P000004Note, StoreComparison } from '../types';
import { calculateRevenue } from '../utils/calculator';
import { AlertCircle, FileUp, Save, View, FileText, AlertTriangle } from 'lucide-react';
import { Dashboard } from '../components/Dashboard';
import { ReportText } from '../components/ReportText';

export interface ChannelQuarterForecast {
  channel: string;
  quarterNum: number;
  budget_target: number;
  realized_revenue: number;
  unrealized_high: number;
  unrealized_low: number;
  est_high: number;
  est_low: number;
  py_revenue: number;
  est_yoy_high: number;
  isTotal?: boolean;
}

const ChannelQuarterForecastTable = ({ data, isExportingPdf = false, reportMonth }: { data: ChannelQuarterForecast[], isExportingPdf?: boolean, reportMonth?: string }) => {
  if (!data || data.length === 0) return null;
  const quarterNum = data[0]?.quarterNum || 1;
  
  const pxClass = isExportingPdf ? "px-2" : "px-6";
  
  let realizedText = "已實現(實際)";
  let unrealizedHighText = "待實現(高標預估)";
  let unrealizedLowText = "待實現(低標預估)";

  if (reportMonth) {
    const monthNum = parseInt(reportMonth.substring(5, 7), 10);
    const startMonth = (quarterNum - 1) * 3 + 1;
    const endMonth = quarterNum * 3;
    
    if (monthNum > startMonth) {
      const endRealized = monthNum - 1;
      realizedText = startMonth === endRealized 
        ? `本季已實現(${startMonth}月實際)` 
        : `本季已實現(${startMonth}-${endRealized}月實際)`;
    } else {
      realizedText = `本季已實現(實際)`;
    }
    
    if (monthNum === endMonth) {
      unrealizedHighText = `待實現(${monthNum}月高標預估)`;
      unrealizedLowText = `待實現(${monthNum}月低標預估)`;
    } else {
      unrealizedHighText = `待實現(${monthNum}-${endMonth}月高標預估)`;
      unrealizedLowText = `待實現(${monthNum}-${endMonth}月低標預估)`;
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="w-full">
        <table className="min-w-full divide-y divide-gray-200" style={isExportingPdf ? { tableLayout: 'fixed', width: '100%' } : {}}>
          <thead className="bg-gray-50">
            <tr>
              <th className={`${pxClass} py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[16%]' : ''}`}>通路</th>
              <th className={`${pxClass} py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[11%]' : ''}`}>Q{quarterNum} 季度目標</th>
              <th className={`${pxClass} py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[11%]' : ''}`}>
                {isExportingPdf && realizedText.includes('(') ? (
                  <>
                    {realizedText.split('(')[0]}<br/>
                    <span className="text-[10px] break-words whitespace-normal leading-tight">({realizedText.substring(realizedText.indexOf('(') + 1)}</span>
                  </>
                ) : realizedText}
              </th>
              <th className={`${pxClass} py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[10%]' : ''}`}>
                {isExportingPdf && unrealizedHighText.includes('(') ? (
                  <>
                    {unrealizedHighText.split('(')[0]}<br/>
                    <span className="text-[10px] break-words whitespace-normal leading-tight">({unrealizedHighText.substring(unrealizedHighText.indexOf('(') + 1)}</span>
                  </>
                ) : unrealizedHighText}
              </th>
              <th className={`${pxClass} py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[10%]' : ''}`}>
                {isExportingPdf && unrealizedLowText.includes('(') ? (
                  <>
                    {unrealizedLowText.split('(')[0]}<br/>
                    <span className="text-[10px] break-words whitespace-normal leading-tight">({unrealizedLowText.substring(unrealizedLowText.indexOf('(') + 1)}</span>
                  </>
                ) : unrealizedLowText}
              </th>
              <th className={`${pxClass} py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[12%]' : ''}`}>
                Q{quarterNum} 高標預估
                {isExportingPdf ? <><br/><span className="text-[10px] break-words whitespace-normal leading-tight">(實際+待高標)</span></> : '(實際+待高標)'}
              </th>
              <th className={`${pxClass} py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[12%]' : ''}`}>
                Q{quarterNum} 低標預估
                {isExportingPdf ? <><br/><span className="text-[10px] break-words whitespace-normal leading-tight">(實際+待低標)</span></> : '(實際+待低標)'}
              </th>
              <th className={`${pxClass} py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[10%]' : ''}`}>去年同期實際</th>
              <th className={`${pxClass} py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider ${isExportingPdf ? 'w-[8%]' : ''}`}>
                預估 YoY
                {isExportingPdf ? <><br/><span className="text-[10px] break-words whitespace-normal leading-tight">(高標對比)</span></> : '(高標對比)'}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((r, i) => (
              <tr key={r.channel} className={`${r.isTotal ? 'bg-indigo-50/50 font-bold border-t-2 border-indigo-200' : 'hover:bg-gray-50 transition-colors'}`}>
                <td className={`${pxClass} py-4 ${isExportingPdf ? 'w-20 whitespace-normal break-words leading-tight' : 'whitespace-nowrap'} text-sm text-gray-900`}>{r.channel}</td>
                <td className={`${pxClass} py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono`}>{Math.round(r.budget_target || 0).toLocaleString()}</td>
                <td className={`${pxClass} py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono`}>{Math.round(r.realized_revenue || 0).toLocaleString()}</td>
                <td className={`${pxClass} py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono`}>{Math.round(r.unrealized_high || 0).toLocaleString()}</td>
                <td className={`${pxClass} py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono`}>{Math.round(r.unrealized_low || 0).toLocaleString()}</td>
                <td className={`${pxClass} py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono font-medium`}>{Math.round(r.est_high || 0).toLocaleString()}</td>
                <td className={`${pxClass} py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono`}>{Math.round(r.est_low || 0).toLocaleString()}</td>
                <td className={`${pxClass} py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono`}>{Math.round(r.py_revenue || 0).toLocaleString()}</td>
                <td className={`${pxClass} py-4 whitespace-nowrap text-sm text-right font-mono font-medium`}>
                  {r.est_yoy_high !== undefined && !isNaN(r.est_yoy_high) ? (
                    <span className={r.est_yoy_high >= 0 ? "text-emerald-600" : "text-rose-600"}>
                       {r.est_yoy_high > 0 ? '+' : ''}{(r.est_yoy_high * 100).toFixed(1)}%
                    </span>
                  ) : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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

export default function ConsolidationPage() {
  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return format(d, 'yyyy-MM');
  });
  const [reportDate, setReportDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return format(d, 'yyyy-MM-dd');
  });
  
  const [erpData, setErpData] = useState<ERPData[]>([]);
  const [erpTxDataCount, setErpTxDataCount] = useState<number>(0);
  const [erpTxDebug, setErpTxDebug] = useState<string>('');
  const [cloudData, setCloudData] = useState<CloudStoreData[]>([]);
  const [platformData, setPlatformData] = useState<ERPData[]>([]);
  const [manual, setManual] = useState<ManualInputs>({ pchome: 0, books: 0, momo: 0, shanghaiRmb: 0, chn018: 0 });
  const [p000004Notes, setP000004Notes] = useState<P000004Note[]>([]);
  
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [storeComparisons, setStoreComparisons] = useState<StoreComparison[]>([]);
  const [quarterForecast, setQuarterForecast] = useState<QuarterForecast | null>(null);
  const [channelQuarterForecast, setChannelQuarterForecast] = useState<ChannelQuarterForecast[]>([]);
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const processExcelData = (ws: any, codeKeywords: string[], revKeywords: string[]) => {
    const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    
    let headerRowIndex = -1;
    let codeColIndex = -1;
    let revColIndex = -1;

    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i];
      if (!Array.isArray(row)) continue;
      
      let bestCodeIdx = -1;
      let bestCodeScore = Infinity;
      let bestRevIdx = -1;
      let bestRevScore = Infinity;
      
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();
        if (!cell) continue;
        
        const cScore = codeKeywords.findIndex(kw => cell.includes(kw));
        if (cScore !== -1 && cScore < bestCodeScore) {
          bestCodeScore = cScore;
          bestCodeIdx = j;
        }

        if (cell.includes('筆數') || cell.includes('折讓') || cell.includes('退')) {
          continue; // Explicitly skip these columns
        }

        const exactRevMatch = revKeywords.findIndex(kw => cell === kw);
        const includesRevMatch = revKeywords.findIndex(kw => cell.includes(kw));
        
        const rScore = exactRevMatch !== -1 ? exactRevMatch : (includesRevMatch !== -1 ? includesRevMatch + 100 : -1);

        if (rScore !== -1 && rScore < bestRevScore) {
          bestRevScore = rScore;
          bestRevIdx = j;
        }
      }
      
      if (bestCodeIdx !== -1 && bestRevIdx !== -1) {
        headerRowIndex = i;
        codeColIndex = bestCodeIdx;
        revColIndex = bestRevIdx;
        break;
      }
    }

    if (headerRowIndex === -1) {
      console.warn("Could not find header row matching keywords.");
      return [];
    }

    const mapped = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!Array.isArray(row)) continue;
      
      const code = String(row[codeColIndex] || '').trim();
      const revRaw = row[revColIndex];
      let rev = typeof revRaw === 'number' ? revRaw : Number(String(revRaw || '').replace(/,/g, ''));
      if (isNaN(rev)) rev = 0;

      if (code && code !== 'undefined' && code !== 'null' && !['合計', '總計', '合计', '总计'].includes(code) && !code.includes('合計') && !code.includes('总计')) {
        mapped.push({ code, rev });
      }
    }
    
    return mapped;
  };

  const handleErpUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = readXlsxSilent(data, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      const mapped: {code: string, rev: number}[] = [];
      
      for (const row of rows) {
        if (!Array.isArray(row) || row.length === 0) continue;
        
        const colA = String(row[0] || '').trim();
        // Skip header or obvious non-data rows
        if (!colA || colA.includes('部門代號') || colA.includes('合計') || colA.includes('總計')) continue;
        
        // Match a department code format
        const match = colA.match(/^[A-Za-z0-9]+/);
        if (match) {
           const code = match[0];
           // Column H is index 7
           const colH = row[7];
           const revRaw = String(colH || '').replace(/,/g, '').trim();
           let rev = parseFloat(revRaw);
           if (isNaN(rev)) rev = 0;
           mapped.push({ code, rev });
        }
      }

      if (mapped.length === 0) {
        const fallbackMapped = processExcelData(ws, ['代號', '代号', '客戶', '客户', '專案', '部門'], ['銷貨淨額', '销货净额', '未稅', '未税', '金額', '金额', '实际不含税金额', 'revenue']);
        setErpData(fallbackMapped.map(item => {
          const match = item.code.match(/^[A-Za-z0-9-]+/);
          return { deptCode: match ? match[0] : item.code, revenue: item.rev };
        }));
      } else {
        setErpData(mapped.map(item => ({ deptCode: item.code, revenue: item.rev })));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleErpTxUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = readXlsxSilent(data, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
      if (rawData.length === 0) {
        setErpTxDebug('檔案空白');
        return;
      }
      
      // Find header row (skip empty rows)
      let headerRowIndex = -1;
      let allHeadersDebug: string[] = [];
      for (let i = 0; i < Math.min(20, rawData.length); i++) {
        const row = rawData[i];
        if (Array.isArray(row) && row.length > 0) {
          const headers = row.map(h => String(h || '').replace(/\s/g, ''));
          allHeadersDebug.push(headers.slice(0, 5).join(','));
          const hasCustomer = headers.some(h => h.includes('客戶') || h.includes('客戶代號') || h.includes('客戶名稱'));
          const hasRev = headers.some(h => h.includes('本幣未稅') || h.includes('未稅金額') || h.includes('金額') || h.includes('銷貨金額'));
          const hasDept = headers.some(h => h.includes('部門'));
          
          if ((hasCustomer && hasRev) || (hasCustomer && hasDept) || (hasRev && hasDept)) {
            headerRowIndex = i;
            break;
          }
        }
      }
      
      if (headerRowIndex === -1) {
        setErpTxDebug(`找不到標題列。解析前幾列: ${allHeadersDebug.join(' | ')}`);
        return;
      }
      
      const headers = rawData[headerRowIndex].map(h => String(h || '').replace(/\s/g, ''));
      
      // Find column indices
      const deptCodeIdx = headers.findIndex(h => h.includes('部門代號') || h.includes('部門'));
      const customerCodeIdx = headers.findIndex(h => h.includes('客戶代號') || h.includes('客戶'));
      const customerNameIdx = headers.findIndex(h => h.includes('客戶簡稱') || h.includes('客戶名稱') || h.includes('客戶姓名'));
      const dateIdx = headers.findIndex(h => h.includes('銷貨日期') || h.includes('日期'));
      const revIdx = headers.findIndex(h => h.includes('本幣未稅金額') || h.includes('本幣未稅'));
      // Fallback for revIdx
      const fallbackRevIdx = headers.findIndex(h => h.includes('未稅金額') || h.includes('銷貨金額') || h.includes('金額'));
      
      const actualRevIdx = revIdx !== -1 ? revIdx : fallbackRevIdx;
      
      if (actualRevIdx === -1) {
        setErpTxDebug(`找到標題列，但找不到金額欄位 (headerIdx: ${headerRowIndex})`);
        return;
      }

      let chn018Sum = 0;
      let sampleRevMatch = '';
      const p000004Acc: {date: string, customerName: string, amount: number}[] = [];
      let validRowCount = 0;
      let currentDeptCode = '';
      let currentCustomerName = '';
      let currentDate = '';

      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!Array.isArray(row) || row.length === 0) continue;
        
        // 排除含有「銷貨小計」、「退貨小計」、「銷貨合計」與「退貨合計」等關鍵字的列數
        const rowString = row.join(' ');
        if (rowString.includes('銷貨小計') || rowString.includes('退貨小計') || rowString.includes('銷貨合計') || rowString.includes('退貨合計')) {
          continue;
        }
        
        let shipDate = '';
        if (dateIdx !== -1) {
          const rawDate = row[dateIdx];
          if (rawDate !== undefined && rawDate !== null && rawDate !== '') {
            if (typeof rawDate === 'number') {
              const dateObj = new Date(Math.round((rawDate - 25569) * 86400 * 1000));
              shipDate = `${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`;
            } else {
              shipDate = String(rawDate || '').trim();
            }
            currentDate = shipDate;
          }
        }
        
        const activeDate = shipDate || currentDate || '未具名日期';
        
        const revRaw = String(row[actualRevIdx] || '').replace(/,/g, '').trim();
        let rev = parseFloat(revRaw);
        if (isNaN(rev)) rev = 0;

        if (rowString.includes('2CHN018')) {
          chn018Sum += rev;
          if (!sampleRevMatch) {
            sampleRevMatch = `[2CHN018] revRaw: "${revRaw}", parsed: ${rev}`;
          }
        }
        
        const rowDeptCode = deptCodeIdx !== -1 ? String(row[deptCodeIdx] || '').trim() : '';
        if (rowDeptCode) currentDeptCode = rowDeptCode;
        
        const rowCustomerNameRaw = customerNameIdx !== -1 ? String(row[customerNameIdx] || '').trim() : '';
        if (rowCustomerNameRaw) currentCustomerName = rowCustomerNameRaw;

        const activeDeptCode = rowDeptCode || currentDeptCode;
        const activeCustomerName = rowCustomerNameRaw || currentCustomerName;

        const isGM = activeDeptCode.startsWith('P000') || rowString.includes('P000') || activeDeptCode.includes('總經理') || rowString.includes('總經理');
        if (isGM) {
          p000004Acc.push({ date: activeDate, customerName: activeCustomerName || '未具名客戶', amount: rev });
        }
        
        // Count any valid data row
        if (rowString.trim() !== '') {
          validRowCount++;
        }
      }
      
      setManual(prev => ({ ...prev, chn018: chn018Sum }));
      
      setP000004Notes(p000004Acc);
      setErpTxDataCount(validRowCount);
      setErpTxDebug(`Hdr: ${headerRowIndex}, revIdx: ${actualRevIdx}, 2CHN018_Sum: ${chn018Sum}. ${sampleRevMatch}`);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleCloudUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = readXlsxSilent(data, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      
      const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
      let isHorizontal = false;
      let totalRowIdx = -1;
      let codeRowIdx = -1;

      for (let i = 0; i < rawData.length; i++) {
        const row = rawData[i];
        if (Array.isArray(row)) {
          const firstCol = String(row[0] || '').trim();
          const secondCol = String(row[1] || '').trim();
          if (firstCol === '總計' || secondCol === '總計' || firstCol === '合计' || secondCol === '合计') {
            totalRowIdx = i;
            break;
          }
        }
      }

      let mapped: {storeCode: string, revenueTaxInc: number}[] = [];

      if (totalRowIdx !== -1 && totalRowIdx > 0) {
        // Horizontal layout detected
        for (let i = 0; i < totalRowIdx; i++) {
          if (Array.isArray(rawData[i])) {
            const hasCodesOrSubtotal = rawData[i].some((cell: any) => {
              const str = String(cell || '').trim();
              return str === '單日小計' || str === '单日小计' || /^[A-Z_a-z]\d+/.test(str);
            });
            if (hasCodesOrSubtotal) {
              codeRowIdx = i;
              break;
            }
          }
        }

        if (codeRowIdx !== -1) {
          const codes = rawData[codeRowIdx];
          const totals = rawData[totalRowIdx];
          
          for (let j = 0; j < codes.length; j++) {
            const codeRaw = String(codes[j] || '').trim();
            if (codeRaw && codeRaw !== '日期' && codeRaw !== '總計' && codeRaw !== '合计') {
              const revRaw = totals[j];
              let rev = typeof revRaw === 'number' ? revRaw : Number(String(revRaw || '').replace(/,/g, ''));
              if (isNaN(rev)) rev = 0;
              
              if (!['合計', '總計', '合计', '总计', '單日小計', '单日小计'].includes(codeRaw)) {
                mapped.push({ storeCode: codeRaw, revenueTaxInc: rev });
              }
            }
          }
        }
      }

      if (mapped.length === 0) {
        // Fallback to vertical
        const fallbackMapped = processExcelData(ws, ['櫃位', '代號', '代号', '店', '客戶'], ['單日小計', '總計', '合計', '含稅', '含税', '金額', '金额', 'revenue']);
        mapped = fallbackMapped.map(item => ({ storeCode: item.code, revenueTaxInc: item.rev }));
      }
      
      setCloudData(mapped);
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handlePlatformUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = readXlsxSilent(data, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const mapped = processExcelData(ws, ['客戶代號', '客户代码', '客戶名稱', '客户名称', '代號', '代号', '客戶', '客户'], ['銷貨淨額', '销货净额', '未稅', '未税', '金額', '金额', '实际不含税金额', 'revenue', '總計', '合計']);
      setPlatformData(mapped.map(item => {
        const match = item.code.match(/^[A-Za-z0-9-]+/);
        return { deptCode: match ? match[0] : item.code, revenue: item.rev };
      }));
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const handleShanghaiUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = readXlsxSilent(data, { type: 'array' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        
        const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        // Find header row and column indices
        let headerRowIdx = -1;
        let customerIDColIdx = -1;
        let customerNameColIdx = -1;
        let amountColIdx = -1;

        for (let i = 0; i < Math.min(20, rawData.length); i++) {
          const row = rawData[i];
          if (!Array.isArray(row)) continue;
          
          for (let j = 0; j < row.length; j++) {
            const cell = String(row[j] || '').trim();
            if (cell.includes('客户编号') || cell.includes('客戶編碼') || cell.includes('客户编码') || cell === '客户代码') customerIDColIdx = j;
            if (cell.includes('客户名称') || cell.includes('客戶名稱')) customerNameColIdx = j;
            if (cell.includes('实际不含税金额本位币') || cell.includes('實際不含稅金額本位幣')) amountColIdx = j;
          }
          
          if ((customerIDColIdx !== -1 || customerNameColIdx !== -1) && amountColIdx !== -1) {
            headerRowIdx = i;
            break;
          }
        }

        if (headerRowIdx === -1) {
          console.log('找不到對應的欄位（客户编号/名称 或 实际不含税金额本位币）');
          return;
        }

        let totalAmount = 0;
        let t001Amount = 0;

        for (let i = headerRowIdx + 1; i < rawData.length; i++) {
          const row = rawData[i];
          if (!Array.isArray(row) || row.length === 0) continue;

          let id = customerIDColIdx !== -1 ? String(row[customerIDColIdx] || '').trim() : '';
          let name = customerNameColIdx !== -1 ? String(row[customerNameColIdx] || '').trim() : '';
          
          // Check if this is the "合计" row
          const firstCol = String(row[0] || '').trim();
          const isTotal = id.includes('合计') || name.includes('合计') || firstCol.includes('合计');

          let amountVal = row[amountColIdx];
          let amount = typeof amountVal === 'number' ? amountVal : Number(String(amountVal || '').replace(/,/g, ''));
          if (isNaN(amount)) amount = 0;

          if (isTotal) {
            totalAmount = amount;
          }

          if (id === 'T001' || name.includes('欧莱德') || name.includes('歐萊德')) {
            t001Amount = amount;
          }
        }

        const calculatedShanghaiRmb = totalAmount - t001Amount;
        setManual(prev => ({ ...prev, shanghaiRmb: calculatedShanghaiRmb }));
      } catch (err) {
        console.error(err);
        console.log('匯入上海業績失敗，格式可能有誤');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };

  const generateReport = async () => {
    setLoading(true);
    try {
      // Fetch rate and targets from API
      const rateRes = await fetch(`/api/rates/${reportMonth}`);
      let exchangeRate = await rateRes.json();
      
      const targetsRes = await fetch(`/api/targets/${reportMonth}`);
      let targets = await targetsRes.json();

      const qfRes = await fetch(`/api/quarter-forecast/${reportMonth}`);
      let qf = await qfRes.json();
      setQuarterForecast(qf);

      const year = parseInt(reportMonth.substring(0, 4), 10);
      const allTargetsRes = await fetch(`/api/targets/year/${year}`);
      let allTargets = await allTargetsRes.json();

      // Check localStorage fallbacks
      if (!exchangeRate) {
        const year = reportMonth.substring(0, 4);
        const localYearRates = safeStorage.getItem(`rates_year_${year}`);
        if (localYearRates) {
          try {
            const ratesList = JSON.parse(localYearRates);
            const foundRate = ratesList.find((r: any) => r.month === reportMonth);
            if (foundRate) exchangeRate = foundRate;
          } catch(e) {}
        }
        
        // Legacy fallback
        if (!exchangeRate) {
          const localRate = safeStorage.getItem(`rates_${reportMonth}`);
          if (localRate) {
            try { exchangeRate = JSON.parse(localRate); } catch(e) {}
          }
        }
      }

      if (!targets || targets.length === 0) {
        const localTargets = safeStorage.getItem(`targets_${reportMonth}`);
        if (localTargets) {
          try { targets = JSON.parse(localTargets); } catch(e) {}
        }
      }

      const { results: newResults, anomalies: newAnomalies, storeComparisons: newStoreComparisons } = calculateRevenue(
        erpData, cloudData, platformData, manual, targets || [], exchangeRate, new Date(reportDate), p000004Notes
      );

      // Compute Channel Quarter Forecast
      const monthNum = parseInt(reportMonth.substring(5, 7), 10);
      const quarterNum = Math.ceil(monthNum / 3);
      const m1 = `${year}-${String((quarterNum - 1) * 3 + 1).padStart(2, '0')}`;
      const m2 = `${year}-${String((quarterNum - 1) * 3 + 2).padStart(2, '0')}`;
      const m3 = `${year}-${String((quarterNum - 1) * 3 + 3).padStart(2, '0')}`;
      const quarterMonths = [m1, m2, m3];

      const cStats: Record<string, ChannelQuarterForecast> = {};
      for (const c of CHANNELS) {
        cStats[c] = {
          channel: c,
          quarterNum,
          budget_target: 0,
          realized_revenue: 0,
          unrealized_high: 0,
          unrealized_low: 0,
          est_high: 0,
          est_low: 0,
          py_revenue: 0,
          est_yoy_high: 0
        };
      }

      for (const m of quarterMonths) {
        const tForM = Array.isArray(allTargets) ? allTargets.filter((t: any) => t.month === m) : [];
        
        for (const t of tForM) {
          const c = t.channel;
          if (!cStats[c]) continue;

          cStats[c].budget_target += t.annual_target || 0;
          cStats[c].py_revenue += t.py_revenue || 0;

          // Figure out actual revenue for month prior/current
          if (m < reportMonth) {
            cStats[c].realized_revenue += t.cy_revenue || 0;
          } else {
            // For current month and future months, we use targets for upcoming estimate
            cStats[c].unrealized_high += t.high_target || 0;
            cStats[c].unrealized_low += t.low_target || 0;
          }
        }
      }

      const qArr = CHANNELS.map(c => cStats[c]).filter(s => 
        s.budget_target > 0 || 
        s.realized_revenue > 0 || 
        s.py_revenue > 0 || 
        s.unrealized_high > 0 || 
        s.unrealized_low > 0
      );
      
      const totalRow: ChannelQuarterForecast = {
          channel: '合計',
          quarterNum,
          budget_target: 0,
          realized_revenue: 0,
          unrealized_high: 0,
          unrealized_low: 0,
          est_high: 0,
          est_low: 0,
          py_revenue: 0,
          est_yoy_high: 0,
          isTotal: true
      };

      for (const s of qArr) {
        s.est_high = s.realized_revenue + s.unrealized_high;
        s.est_low = s.realized_revenue + s.unrealized_low;
        s.est_yoy_high = s.py_revenue > 0 ? (s.est_high - s.py_revenue) / s.py_revenue : 0;

        totalRow.budget_target += s.budget_target;
        totalRow.realized_revenue += s.realized_revenue;
        totalRow.unrealized_high += s.unrealized_high;
        totalRow.unrealized_low += s.unrealized_low;
        totalRow.py_revenue += s.py_revenue;
      }

      totalRow.est_high = totalRow.realized_revenue + totalRow.unrealized_high;
      totalRow.est_low = totalRow.realized_revenue + totalRow.unrealized_low;
      totalRow.est_yoy_high = totalRow.py_revenue > 0 ? (totalRow.est_high - totalRow.py_revenue) / totalRow.py_revenue : 0;
      
      if (qArr.length > 0) {
        qArr.push(totalRow);
      }

      setChannelQuarterForecast(qArr);
      setResults(newResults);
      setStoreComparisons(newStoreComparisons);
      setAnomalies(newAnomalies);
    } catch (e) {
      console.error(e);
      console.log('無法產生報表，請確認後端服務是否正常執行。');
    } finally {
      setLoading(false);
    }
  };

  const saveSnapshot = async () => {
    try {
      await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          snapshot_date: new Date().toISOString().split('T')[0],
          report_month: reportMonth,
          report_date: reportDate,
          results
        })
      });
      console.log('快照已成功儲存！');
    } catch(e) {
      console.log('儲存快照失敗');
    }
  };

  const [activeTab, setActiveTab] = useState<'upload' | 'dashboard' | 'report'>('upload');

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    
    // 業績儀表板 (Basic dashboard data export)
    const dashboardData = results.map(r => ({
      '通路/單位': r.channel,
      '累積業績': Math.round(r.revenue),
      '月目標': r.target?.annual_target || 0,
      '達成率': r.achievement_rate ? (r.achievement_rate * 100).toFixed(2) + '%' : '',
    }));
    const wsDashboard = XLSX.utils.json_to_sheet(dashboardData);
    XLSX.utils.book_append_sheet(wb, wsDashboard, '業績儀表板');

    // 通路季業績預估統計表
    if (channelQuarterForecast.length > 0) {
      const quarterNum = channelQuarterForecast[0]?.quarterNum || 1;
      let realizedText = "已實現(實際)";
      let unrealizedHighText = "待實現(高標預估)";
      let unrealizedLowText = "待實現(低標預估)";

      if (reportMonth) {
        const monthNum = parseInt(reportMonth.substring(5, 7), 10);
        const startMonth = (quarterNum - 1) * 3 + 1;
        const endMonth = quarterNum * 3;
        
        if (monthNum > startMonth) {
          const endRealized = monthNum - 1;
          realizedText = startMonth === endRealized 
            ? `本季已實現(${startMonth}月實際)` 
            : `本季已實現(${startMonth}-${endRealized}月實際)`;
        } else {
          realizedText = `本季已實現(實際)`;
        }
        
        if (monthNum === endMonth) {
          unrealizedHighText = `待實現(${monthNum}月高標預估)`;
          unrealizedLowText = `待實現(${monthNum}月低標預估)`;
        } else {
          unrealizedHighText = `待實現(${monthNum}-${endMonth}月高標預估)`;
          unrealizedLowText = `待實現(${monthNum}-${endMonth}月低標預估)`;
        }
      }

      const qfData = channelQuarterForecast.map(r => ({
        '通路': r.channel,
        [`Q${quarterNum} 季度目標`]: Math.round(r.budget_target || 0),
        [realizedText]: Math.round(r.realized_revenue || 0),
        [unrealizedHighText]: Math.round(r.unrealized_high || 0),
        [unrealizedLowText]: Math.round(r.unrealized_low || 0),
        [`Q${quarterNum} 高標預估 (實際+待高標)`]: Math.round(r.est_high || 0),
        [`Q${quarterNum} 低標預估 (實際+待低標)`]: Math.round(r.est_low || 0),
        '去年同期實際': Math.round(r.py_revenue || 0),
        '預估 YoY (高標對比)': r.est_yoy_high !== undefined && !isNaN(r.est_yoy_high) ? (r.est_yoy_high > 0 ? '+' : '') + (r.est_yoy_high * 100).toFixed(1) + '%' : '-'
      }));
      const wsQf = XLSX.utils.json_to_sheet(qfData);
      XLSX.utils.book_append_sheet(wb, wsQf, '通路季業績預估統計表');
    }

    // 每日回報文字 (Placeholder, can't easily export multiline text to excel but can put in a single cell)
    const wsText = XLSX.utils.aoa_to_sheet([['若要取得每日回報文字，請於系統介面複製']]);
    XLSX.utils.book_append_sheet(wb, wsText, '每日回報文字');

    // 通路明細
    const summaryData = results.map(r => ({
      '通路/單位': r.channel,
      '業績': Math.round(r.revenue),
      '預算目標金額': (r.target && r.target.annual_target !== undefined && r.target.annual_target !== null) ? Math.round(r.target.annual_target) : '',
      '高標預估金額': (r.target && r.target.high_target !== undefined && r.target.high_target !== null) ? Math.round(r.target.high_target) : '',
      '低標預估金額': (r.target && r.target.low_target !== undefined && r.target.low_target !== null) ? Math.round(r.target.low_target) : '',
      '預算目標達成率': (r.achievement_rate !== undefined && r.achievement_rate !== null) ? (r.achievement_rate * 100).toFixed(2) + '%' : '',
      '高標達成率': (r.high_achievement_rate !== undefined && r.high_achievement_rate !== null) ? (r.high_achievement_rate * 100).toFixed(2) + '%' : '',
      '低標達成率': (r.low_achievement_rate !== undefined && r.low_achievement_rate !== null) ? (r.low_achievement_rate * 100).toFixed(2) + '%' : '',
      '去年營收金額': (r.target && r.target.py_revenue !== undefined && r.target.py_revenue !== null) ? Math.round(r.target.py_revenue) : '',
      '去年YOY': (r.yoy_rate !== undefined && r.yoy_rate !== null) ? (r.yoy_rate * 100).toFixed(2) + '%' : '',
      '前年營收金額': (r.target && r.target.ppy_revenue !== undefined && r.target.ppy_revenue !== null) ? Math.round(r.target.ppy_revenue) : '',
      '前年YOY': (r.ppy_rate !== undefined && r.ppy_rate !== null) ? (r.ppy_rate * 100).toFixed(2) + '%' : ''
    }));
    const ws1 = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws1, '通路明細');
    XLSX.utils.book_append_sheet(wb, ws1, '每日總覽');

    const wsExclude = XLSX.utils.aoa_to_sheet([['排除明細暫無資料']]);
    XLSX.utils.book_append_sheet(wb, wsExclude, '排除明細');

    // 百貨業績比對明細
    if (storeComparisons.length > 0) {
      const storeCompData = storeComparisons.map(s => ({
        '百貨櫃點': s.storeCode,
        'ERP金額': s.erpRevenue,
        '雲端未稅金額': s.cloudRevenueTaxExcl,
        '差額 (ERP - 雲端)': s.diff,
        '採用基準': s.selectedSource === 'ERP' ? 'ERP數據' : '雲端數據',
        '最終採用金額': s.finalRevenue
      }));
      const wsStoreComp = XLSX.utils.json_to_sheet(storeCompData);
      XLSX.utils.book_append_sheet(wb, wsStoreComp, '百貨業績比對明細');
    }

    // 異常檢查與提示
    const anoData = anomalies.map(a => ({
      '類型': a.type === 'error' ? '錯誤' : a.type === 'info' ? '提示' : '警告',
      '說明': a.message
    }));
    const ws2 = XLSX.utils.json_to_sheet(anoData);
    XLSX.utils.book_append_sheet(wb, ws2, '系統檢查結果');

    // 操作參數
    const wsParam = XLSX.utils.json_to_sheet([{
      '報表月份': reportMonth,
      '統計截止日': reportDate,
      'PChome': manual.pchome,
      '博客來': manual.books,
      'MOMO': manual.momo,
      '上海RMB': manual.shanghaiRmb,
      '2CHN018': manual.chn018,
      '全局備註': manual.generalNote || ''
    }]);
    XLSX.utils.book_append_sheet(wb, wsParam, '操作參數');

    XLSX.writeFile(wb, `業績總覽_${reportMonth}.xlsx`);
  };

  const exportPdf = () => {
    setIsExportingPdf(true);
    // Wait for the DOM to render the combined layout and Recharts animations to finish
    setTimeout(async () => {
      try {
        const { toPng } = await import('html-to-image');
        const { default: jsPDF } = await import('jspdf');

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4'
        });

        const sections = ['pdf-section-1', 'pdf-section-2', 'pdf-section-3', 'pdf-section-4'];
        let isFirstPage = true;

        for (const id of sections) {
          const el = document.getElementById(id);
          if (!el) continue;

          // Optional: Give elements a white background for exporting
          const dataUrl = await toPng(el, {
            quality: 0.95,
            pixelRatio: 2,
            backgroundColor: '#ffffff'
          });

          if (!isFirstPage) {
            pdf.addPage();
          }
          isFirstPage = false;

          const imgProps = pdf.getImageProperties(dataUrl);
          const pdfWidth = pdf.internal.pageSize.getWidth();
          const margin = 10;
          const availableWidth = pdfWidth - margin * 2;
          const pdfHeight = pdf.internal.pageSize.getHeight();
          const availableHeight = pdfHeight - margin * 2;
          const imgHeightToDraw = (imgProps.height * availableWidth) / imgProps.width;

          let heightLeft = imgHeightToDraw;
          let position = margin;

          if (id === 'pdf-section-3') {
             pdf.addImage(dataUrl, 'PNG', margin, position, availableWidth, imgHeightToDraw);
          } else {
             pdf.addImage(dataUrl, 'PNG', margin, position, availableWidth, imgHeightToDraw);
             heightLeft -= availableHeight;

             // Only paginate if there's a significant amount of content trailing (e.g. > 10mm)
             // to avoid blank pages with just a few pixels of borders or shadows.
             while (heightLeft > 10) {
               position = position - availableHeight; // Move the image up
               pdf.addPage();
               pdf.addImage(dataUrl, 'PNG', margin, position, availableWidth, imgHeightToDraw);
               heightLeft -= availableHeight;
             }
          }
        }
        
        pdf.save(`業績總覽_${reportMonth}.pdf`);
      } catch (err) {
        console.error('PDF匯出失敗', err);
        console.log('PDF匯出失敗');
      } finally {
        setIsExportingPdf(false);
      }
    }, 800);
  };

  return (
    <div className="space-y-6">
      {results.length > 0 && (
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('upload')}
              className={`${activeTab === 'upload' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              📊 業績總覽與上傳
            </button>
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`${activeTab === 'dashboard' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              📈 業績儀表板
            </button>
            <button
              onClick={() => setActiveTab('report')}
              className={`${activeTab === 'report' ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
            >
              📝 每日回報文字
            </button>
          </nav>
        </div>
      )}

      {isExportingPdf ? (
        <div className="fixed inset-0 top-0 left-0 -z-50 overflow-hidden bg-white w-[1024px]">
          <div id="pdf-export-container" className="bg-white p-8 space-y-12 w-[1024px]">
            <div id="pdf-section-1" className="bg-white space-y-6">
            <div className="text-center pb-6 border-b border-gray-200">
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">營收業績總覽</h1>
              <p className="text-gray-500">
                報表月份: {reportMonth} | 統計截止日: {reportDate}
              </p>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 border-l-4 border-indigo-600 pl-4">業績儀表板</h2>
            <Dashboard results={results} reportMonth={reportMonth} reportDate={reportDate} hideTable={true} quarterForecast={quarterForecast} />
          </div>

          <div id="pdf-section-2" className="bg-white space-y-6 pt-8 break-before-page">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 border-l-4 border-indigo-600 pl-4">通路業績統計表(月)</h2>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
              <div className="w-full">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">通路</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">業績</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">預算目標達成率</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">去年 YOY</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">前年 YOY</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">高標達成率</th>
                      <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">低標達成率</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((r, i) => (
                      <tr key={r.channel} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {r.channel === '總經理室' && (r.revenue !== 0 || (r.p000004Notes && r.p000004Notes.length > 0)) ? (
                            <div className="relative group inline-flex items-center cursor-help">
                              <span>{r.channel}</span>
                              <AlertTriangle className="w-4 h-4 ml-1.5 text-rose-500 transition-colors" />
                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-4 bg-gray-900 text-white rounded-xl shadow-xl z-[100] whitespace-normal text-sm ring-1 ring-white/10 font-sans">
                                <div className="font-semibold mb-2 flex items-center text-rose-400">
                                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                                  總經理室出貨明細
                                </div>
                                {r.p000004Notes && r.p000004Notes.length > 0 ? (
                                  <div className="text-gray-300 text-xs mt-2 border-t border-gray-700 pt-2 space-y-1.5">
                                    {Object.entries(
                                      r.p000004Notes.reduce((acc, note) => {
                                        const key = `${note.customerName || '未具名客戶'}|${note.date}`;
                                        acc[key] = (acc[key] || 0) + note.amount;
                                        return acc;
                                      }, {} as Record<string, number>)
                                    ).map(([key, amount], idx) => {
                                      const [customer, date] = key.split('|');
                                      return (
                                        <div key={idx} className="flex items-center justify-between gap-4 mt-1.5">
                                          <span className="truncate">{customer} <span className="text-gray-500">({date})</span></span>
                                          <span className="shrink-0 font-mono">${Math.round(amount as number).toLocaleString()}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-gray-400 text-xs mt-2 border-t border-gray-700 pt-2">
                                    查無詳細出貨日期資料
                                  </div>
                                )}
                                <div className="absolute left-6 -bottom-1.5 w-3 h-3 bg-gray-900 border-b border-r border-white/10 rotate-45 transform origin-center"></div>
                              </div>
                            </div>
                          ) : (
                            r.channel
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                          {Math.round(r.revenue).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono">
                          {r.achievement_rate ? (r.achievement_rate * 100).toFixed(1) + '%' : '-'}
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium">
                          {r.yoy_rate !== undefined ? (
                            <span className={r.yoy_rate >= 0 ? "text-emerald-600" : "text-rose-600"}>
                               {r.yoy_rate > 0 ? '+' : ''}{(r.yoy_rate * 100).toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                         <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium">
                          {r.ppy_rate !== undefined ? (
                            <span className={r.ppy_rate >= 0 ? "text-emerald-600" : "text-rose-600"}>
                               {r.ppy_rate > 0 ? '+' : ''}{(r.ppy_rate * 100).toFixed(1)}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono">
                          {r.high_achievement_rate ? (r.high_achievement_rate * 100).toFixed(1) + '%' : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono">
                          {r.low_achievement_rate ? (r.low_achievement_rate * 100).toFixed(1) + '%' : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {channelQuarterForecast.length > 0 && (
            <div id="pdf-section-3" className="bg-white space-y-6 pt-8 break-before-page">
              <h2 className="text-2xl font-bold tracking-tight text-gray-900 border-l-4 border-indigo-600 pl-4">通路季業績預估統計表</h2>
              <ChannelQuarterForecastTable data={channelQuarterForecast} isExportingPdf={true} reportMonth={reportMonth} />
            </div>
          )}

          <div id="pdf-section-4" className="bg-white space-y-6 pt-8 break-before-page">
            <h2 className="text-2xl font-bold tracking-tight text-gray-900 border-l-4 border-indigo-600 pl-4">每日回報文字</h2>
            <ReportText results={results} reportMonth={reportMonth} reportDate={reportDate} quarterForecast={quarterForecast} />
          </div>
        </div>
        </div>
      ) : (
        <React.Fragment>
          {activeTab === 'upload' && (
            <React.Fragment>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
           <h2 className="text-lg font-medium text-gray-900 mb-4 tracking-tight flex items-center gap-2">
            <View className="w-5 h-5 text-indigo-600" />
            報表條件
          </h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">報表月份 (Report Month)</label>
              <input type="month" value={reportMonth} onChange={e => setReportMonth(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">統計截止日 (Cutoff Date)</label>
              <input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow" />
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative">
           <h2 className="text-lg font-medium text-gray-900 mb-4 tracking-tight flex items-center gap-2">
            <FileUp className="w-5 h-5 text-indigo-600" />
            資料上傳
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ERP 當月累計業績檔 (Excel/CSV)</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleErpUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors" />
              {erpData.length > 0 && <span className="text-xs text-green-600 ml-2">已載入 {erpData.length} 筆</span>}
            </div>
            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100">
              <label className="block text-sm font-medium text-blue-900 mb-1 flex items-center gap-2">
                ERP 當月交易明細 (Excel/CSV)
                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">新功能</span>
              </label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleErpTxUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-100 file:text-blue-700 hover:file:bg-blue-200 transition-colors" />
              {erpTxDataCount > 0 && <span className="text-xs font-medium text-blue-700 block mt-2">✅ 已載入交易明細，自動排除小計並抓取本幣未稅金額</span>}
              {erpTxDebug && <span className="text-xs font-mono text-gray-500 block mt-1">{erpTxDebug}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">百貨雲端業績檔 (含稅)</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleCloudUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors" />
              {cloudData.length > 0 && <span className="text-xs text-green-600 ml-2">已載入 {cloudData.length} 筆</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">上海業績資料上傳 (Excel/CSV)</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleShanghaiUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors" />
              {manual.shanghaiRmb > 0 && <span className="text-xs font-medium text-green-600 block mt-1">已計算: RMB {manual.shanghaiRmb.toLocaleString(undefined, {maximumFractionDigits: 2})}</span>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">平台客戶ABC業績檔 (Excel/CSV)</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handlePlatformUpload}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 transition-colors" />
              {platformData.length > 0 && <span className="text-xs text-green-600 ml-2">已載入 {platformData.length} 筆</span>}
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm lg:col-span-2">
           <h2 className="text-lg font-medium text-gray-900 mb-4 tracking-tight flex items-center gap-2">
            手動收單輸入
          </h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {Object.entries({pchome: 'PChome', books: '博客來', momo: 'MOMO', chn018: '2CHN018 歐萊德上海子公司'}).map(([key, label]) => (
              <div key={key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                <input type="number" min="0" step="any"
                  value={manual[key as keyof ManualInputs] || ''} 
                  onChange={e => setManual({...manual, [key]: Number(e.target.value)})}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow font-mono text-sm" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">文字編輯欄位 (全局備註)</label>
              <textarea
                value={manual.generalNote || ''} 
                onChange={e => setManual({...manual, generalNote: e.target.value})}
                placeholder="請輸入其他備註..."
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-shadow text-sm min-h-[42px]" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center bg-gray-50 p-4 border border-gray-200 rounded-xl">
        <button onClick={generateReport} disabled={loading}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium tracking-tight hover:bg-indigo-700 transition-colors disabled:opacity-50">
          {loading ? '計算中...' : '產生通路業績統計'}
        </button>

        {results.length > 0 && (
          <div className="space-x-3">
             <button onClick={exportExcel} className="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
              Excel 匯出
            </button>
            <button onClick={exportPdf} disabled={isExportingPdf} className="bg-rose-50 text-rose-700 border border-rose-200 px-4 py-2 rounded-lg text-sm font-medium hover:bg-rose-100 transition-colors inline-flex items-center gap-2">
              <FileText className="w-4 h-4" /> {isExportingPdf ? '匯出中...' : 'PDF 匯出'}
            </button>
            <button onClick={saveSnapshot} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors flex items-center gap-2 inline-flex">
              <Save className="w-4 h-4" /> 保存快照
            </button>
          </div>
        )}
      </div>

      {anomalies.filter(a => a.type !== 'info').length > 0 && (
        <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
           <h2 className="text-sm font-bold text-amber-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            異常檢查 ({anomalies.filter(a => a.type !== 'info').length})
          </h2>
          <ul className="space-y-1 text-sm text-amber-800 list-disc list-inside">
            {anomalies.filter(a => a.type !== 'info').map((a, i) => <li key={i} className={a.type === 'error' ? 'font-medium text-red-700' : ''}>{a.message}</li>)}
          </ul>
        </div>
      )}

      {anomalies.filter(a => a.type === 'info').length > 0 && (
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
           <h2 className="text-sm font-bold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-600" />
            系統提示與核對結果 ({anomalies.filter(a => a.type === 'info').length})
          </h2>
          <ul className="space-y-1 text-sm text-blue-800 list-disc list-inside">
            {anomalies.filter(a => a.type === 'info').map((a, i) => <li key={i}>{a.message}</li>)}
          </ul>
        </div>
      )}

      {results.length > 0 && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">通路</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">業績</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">預算目標達成率</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">去年 YOY</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">前年 YOY</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">高標達成率</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">低標達成率</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((r, i) => (
                    <tr key={r.channel} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {r.channel === '總經理室' && (r.revenue !== 0 || (r.p000004Notes && r.p000004Notes.length > 0)) ? (
                            <div className="relative group inline-flex items-center cursor-help">
                              <span>{r.channel}</span>
                              <AlertTriangle className="w-4 h-4 ml-1.5 text-rose-500 transition-colors" />
                              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-4 bg-gray-900 text-white rounded-xl shadow-xl z-[100] whitespace-normal text-sm ring-1 ring-white/10 font-sans">
                                <div className="font-semibold mb-2 flex items-center text-rose-400">
                                  <AlertTriangle className="w-4 h-4 mr-1.5" />
                                  總經理室出貨明細
                                </div>
                                {r.p000004Notes && r.p000004Notes.length > 0 ? (
                                  <div className="text-gray-300 text-xs mt-2 border-t border-gray-700 pt-2 space-y-1.5">
                                    {Object.entries(
                                      r.p000004Notes.reduce((acc, note) => {
                                        const key = `${note.customerName || '未具名客戶'}|${note.date}`;
                                        acc[key] = (acc[key] || 0) + note.amount;
                                        return acc;
                                      }, {} as Record<string, number>)
                                    ).map(([key, amount], idx) => {
                                      const [customer, date] = key.split('|');
                                      return (
                                        <div key={idx} className="flex items-center justify-between gap-4 mt-1.5">
                                          <span className="truncate">{customer} <span className="text-gray-500">({date})</span></span>
                                          <span className="shrink-0 font-mono">${Math.round(amount as number).toLocaleString()}</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-gray-400 text-xs mt-2 border-t border-gray-700 pt-2">
                                    查無詳細出貨日期資料
                                  </div>
                                )}
                                <div className="absolute left-6 -bottom-1.5 w-3 h-3 bg-gray-900 border-b border-r border-white/10 rotate-45 transform origin-center"></div>
                              </div>
                            </div>
                          ) : (
                            r.channel
                          )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                        {Math.round(r.revenue).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono">
                        {r.achievement_rate ? (r.achievement_rate * 100).toFixed(1) + '%' : '-'}
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium">
                        {r.yoy_rate !== undefined ? (
                          <span className={r.yoy_rate >= 0 ? "text-emerald-600" : "text-rose-600"}>
                             {r.yoy_rate > 0 ? '+' : ''}{(r.yoy_rate * 100).toFixed(1)}%
                          </span>
                        ) : '-'}
                      </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium">
                        {r.ppy_rate !== undefined ? (
                          <span className={r.ppy_rate >= 0 ? "text-emerald-600" : "text-rose-600"}>
                             {r.ppy_rate > 0 ? '+' : ''}{(r.ppy_rate * 100).toFixed(1)}%
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono">
                        {r.high_achievement_rate ? (r.high_achievement_rate * 100).toFixed(1) + '%' : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono">
                        {r.low_achievement_rate ? (r.low_achievement_rate * 100).toFixed(1) + '%' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {channelQuarterForecast.length > 0 && (
            <div className="pt-2">
              <h2 className="text-xl font-bold tracking-tight text-gray-900 mb-4 flex items-center gap-2">
                📊 通路季業績預估統計表
              </h2>
              <ChannelQuarterForecastTable data={channelQuarterForecast} reportMonth={reportMonth} />
            </div>
          )}
        </div>
      )}
      </React.Fragment>
    )}
    </React.Fragment>
  )}

  {!isExportingPdf && activeTab === 'dashboard' && <Dashboard results={results} reportDate={reportDate} reportMonth={reportMonth} quarterForecast={quarterForecast} />}

      {!isExportingPdf && activeTab === 'report' && <ReportText results={results} reportMonth={reportMonth} reportDate={reportDate} quarterForecast={quarterForecast} generalNote={manual.generalNote} />}

    </div>
  );
}
