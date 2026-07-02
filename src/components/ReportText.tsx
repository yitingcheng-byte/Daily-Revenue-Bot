import React from 'react';
import { CalculationResult, QuarterForecast } from '../types';
import { ClipboardCopy } from 'lucide-react';

interface Props {
  results: CalculationResult[];
  reportMonth: string;
  reportDate: string;
  quarterForecast?: QuarterForecast | null;
  generalNote?: string;
}

export function ReportText({ results, reportMonth, reportDate, quarterForecast, generalNote }: Props) {
  const totalResult = results.find(r => r.channel === '合計 (全公司合併營收)');
  const channels = results.filter(r => r.channel !== '合計 (全公司合併營收)');

  const formatCurrency = (val: number) => `$${Math.round(val).toLocaleString()}`;
  const formatPct = (val: number | undefined) => val !== undefined ? `${(val * 100).toFixed(1)}%` : 'N/A';
  const formatYoY = (val: number | undefined) => val !== undefined ? `${val > 0 ? '+' : ''}${(val * 100).toFixed(1)}%` : 'N/A';

  const monthParts = reportMonth.split('-');
  const mm = monthParts[1] || '01';

  let text = `【${mm}月 全公司通路業績每日回報】\n`;
  text += `統計區間：${mm}/1 ~ ${reportDate.replace(/-/g, '/')}\n\n`;
  
  if (totalResult) {
    text += `📊 累積合併總業績：${formatCurrency(totalResult.revenue)}\n`;
  }
  text += `-----------------------------\n`;
  text += `[各處室累積明細 (達成率 | YoY去年 | YoY前年)]\n`;

  const icons: Record<string, string> = {
    "電子商務處": "🌐",
    "百貨體驗館": "🏬",
    "沙龍事業處": "✂️",
    "企新(通路/企戶/環教館)": "🏢",
    "大型通路": "🛒",
    "國際事業處(其他國家)": "✈️",
    "國際事業處(日本)": "✈️",
    "中國事業處": "🇨🇳",
    "總經理室": "📁",
    "永續美妝OBM·ODM·OEM": "📁",
    "策略產品發展處": "📁",
    "行政總部(員購)": "📁",
    "其他": "📁"
  };

  const nameMapping: Record<string, string> = {
    "電子商務處": "電商處",
    "百貨體驗館": "百貨體驗館(未稅)",
    "企新(通路/企戶/環教館)": "企新",
    "中國事業處": "中國事業處(合併)",
    "行政總部(員購)": "行政總務部(員購)"
  };

  // Merge Intl together as requested
  const intlOther = channels.find(c => c.channel === '國際事業處(其他國家)');
  const intlJapan = channels.find(c => c.channel === '國際事業處(日本)');
  const intlCombinedRevenue = (intlOther?.revenue || 0) + (intlJapan?.revenue || 0);

  channels.forEach(ch => {
    if (ch.channel === '國際事業處(日本)') return; // Handled under other
    
    if (ch.channel === '國際事業處(其他國家)') {
       text += `✈️ 國際事業處：${formatCurrency(intlCombinedRevenue)}\n`;
       if (intlOther) {
         text += `   - 其他國家: ${Math.round(intlOther.revenue).toLocaleString()} (達: ${formatPct(intlOther.achievement_rate)} | YoY去年: ${formatYoY(intlOther.yoy_rate)} | 前年: ${formatYoY(intlOther.ppy_rate)})\n`;
       }
       if (intlJapan) {
         text += `   - 日本: ${Math.round(intlJapan.revenue).toLocaleString()} (達: ${formatPct(intlJapan.achievement_rate)} | YoY去年: ${formatYoY(intlJapan.yoy_rate)} | 前年: ${formatYoY(intlJapan.ppy_rate)})\n`;
       }
       return;
    }

    const icon = icons[ch.channel] || "📁";
    const displayName = nameMapping[ch.channel] || ch.channel;
    
    text += `${icon} ${displayName}：${formatCurrency(ch.revenue)} (達: ${formatPct(ch.achievement_rate)} | YoY去年: ${formatYoY(ch.yoy_rate)} | 前年: ${formatYoY(ch.ppy_rate)})\n`;
    
    if (ch.channel === '總經理室') {
      if (ch.p000004Notes && ch.p000004Notes.length > 0) {
        const grouped: Record<string, number> = {};
        ch.p000004Notes.forEach(note => {
          const key = `${note.customerName || '未具名客戶'}|${note.date}`;
          grouped[key] = (grouped[key] || 0) + note.amount;
        });
        text += `   總經理室出貨明細：\n`;
        Object.entries(grouped).forEach(([key, amount]) => {
          const [customer, date] = key.split('|');
          text += `   - ${customer} (${date}): ${formatCurrency(amount)}\n`;
        });
      }
    }

    if (ch.breakdown) {
      if (ch.channel === '電子商務處') {
        const bd = ch.breakdown;
        text += `   (PChome: ${Math.round(Number(bd['PChome']) || 0).toLocaleString()}, 博客來: ${Math.round(Number(bd['博客來']) || 0).toLocaleString()}, MOMO: ${Math.round(Number(bd['MOMO']) || 0).toLocaleString()}, 其他: ${Math.round(Number(bd['其他']) || 0).toLocaleString()})\n`;
      } else if (ch.channel === '百貨體驗館') {
        const bd = ch.breakdown;
        text += `   (百貨各櫃合計 ${formatCurrency(Number(bd['百貨各櫃合計(依差異判定)']) || 0)} + ERP O216營運部 ${formatCurrency(Number(bd['ERP O216營運部']) || 0)})\n`;
      } else if (ch.channel === '中國事業處') {
         const bd = ch.breakdown;
         const nonRelatedSales = (Number(bd['台端出貨']) || 0) - (Number(bd['沖銷']) || 0);
         const rmbFormatted = (Number(bd['上海當地RMB']) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
         text += `   (台端出貨 ${Math.round(Number(bd['台端出貨']) || 0).toLocaleString()} - 沖銷 ${Math.round(Number(bd['沖銷']) || 0).toLocaleString()} + 上海當地 RMB ${rmbFormatted} * 均值匯率 ${Number(bd['均值匯率']).toFixed(4)})\n`;
         text += `   備註：\n`;
         text += `   - 上海原幣金額/匯率: RMB ${rmbFormatted} / ${Number(bd['均值匯率']).toFixed(4)}\n`;
         text += `   - 中國事業處非關係人銷售金額(中國事業處扣除2CHN018後業績金額): ${Math.round(nonRelatedSales).toLocaleString()}\n`;
      }
    }
  });

  text += `-----------------------------\n`;
  text += `[全公司合併目標與整體達成率]\n`;
  if (totalResult?.target) {
    text += `🎯 年度月預算 (${formatCurrency(totalResult.target.annual_target)})：達成率 ${formatPct(totalResult.achievement_rate)}\n`;
    text += `📈 月高標預估 (${formatCurrency(totalResult.target.high_target)})：達成率 ${formatPct(totalResult.high_achievement_rate)}\n`;
    text += `📉 月低標預估 (${formatCurrency(totalResult.target.low_target)})：達成率 ${formatPct(totalResult.low_achievement_rate)}\n`;
    text += `🔄 去年同月財報 (${formatCurrency(totalResult.target.py_revenue)})：YoY比率 ${formatYoY(totalResult.yoy_rate)}\n`;
    text += `🔄 前年同月財報 (${formatCurrency(totalResult.target.ppy_revenue)})：YoY比率 ${formatYoY(totalResult.ppy_rate)}\n`;
  }

  if (quarterForecast) {
    text += `-----------------------------\n`;
    text += `[${quarterForecast.year} Q${quarterForecast.quarter} 當季高低標預估與去年同期 YoY]\n`;
    text += `📈 當季高標預估 (${formatCurrency(quarterForecast.high_target)})：去年同期 ${formatCurrency(quarterForecast.py_revenue)}，YoY ${formatYoY(quarterForecast.yoy_high)}\n`;
    text += `📉 當季低標預估 (${formatCurrency(quarterForecast.low_target)})：去年同期 ${formatCurrency(quarterForecast.py_revenue)}，YoY ${formatYoY(quarterForecast.yoy_low)}\n`;
  }

  if (generalNote) {
    text += `-----------------------------\n`;
    text += `[備註]\n`;
    text += `${generalNote}\n`;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    console.log('已複製到剪貼簿！');
  };

  return (
    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative group">
      <button 
        onClick={handleCopy}
        className="absolute top-4 right-4 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 p-2 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium opacity-0 group-hover:opacity-100"
      >
        <ClipboardCopy className="w-4 h-4" /> 複製文字
      </button>
      <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed bg-gray-50 p-6 rounded-lg border border-gray-200">
        {text}
      </pre>
    </div>
  );
}
