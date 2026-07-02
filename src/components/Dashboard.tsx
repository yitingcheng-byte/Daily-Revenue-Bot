import React from 'react';
import { CalculationResult, QuarterForecast } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';
import { parseISO, getDaysInMonth, getDate } from 'date-fns';
import { Info, TrendingDown, TrendingUp, AlertTriangle } from 'lucide-react';

interface Props {
  results: CalculationResult[];
  reportMonth: string;
  reportDate: string;
  hideTable?: boolean;
  quarterForecast?: QuarterForecast | null;
}

export function Dashboard({ results, reportMonth, reportDate, hideTable = false, quarterForecast }: Props) {
  // Extract total and regular results
  const totalResult = results.find(r => r.channel === '合計 (全公司合併營收)');
  const channels = results.filter(r => r.channel !== '合計 (全公司合併營收)' && r.revenue > 0);

  // Patch quarter forecast with the current active report month's revenue
  let displayQuarterForecast = quarterForecast ? { ...quarterForecast } : undefined;
  if (displayQuarterForecast && totalResult && reportMonth) {
    const details = displayQuarterForecast.details ? displayQuarterForecast.details.map(d => ({...d})) : [];
    let patchedTotal = displayQuarterForecast.cy_revenue;
    const currentMonthDetail = details.find(d => d.month === reportMonth);
    if (currentMonthDetail) {
      if (currentMonthDetail.cyRevenue !== totalResult.revenue) {
        patchedTotal = patchedTotal - currentMonthDetail.cyRevenue + totalResult.revenue;
        currentMonthDetail.cyRevenue = totalResult.revenue;
      }
    }
    displayQuarterForecast = {
      ...displayQuarterForecast,
      cy_revenue: patchedTotal,
      details
    };
  }

  // Calculate time progress
  let timeProgress = 0;
  try {
    const dateObj = parseISO(reportDate);
    const day = getDate(dateObj);
    const daysInMonth = getDaysInMonth(dateObj);
    timeProgress = day / daysInMonth;
  } catch (e) {
    // fallback if parsing fails
  }

  const chartData = channels.map(r => ({
    name: r.channel.split('(')[0], // Shorten name
    '累積業績': Math.round(r.revenue),
    '低標目標': r.target ? Math.round(r.target.low_target) : 0,
    achievement: r.low_achievement_rate || 0,
  }));

  const formatCurrency = (val: number) => `$${Math.round(val).toLocaleString()}`;
  const formatPct = (val: number | undefined) => val !== undefined && !isNaN(val) ? `${(val * 100).toFixed(1)}%` : 'N/A';
  const formatDiff = (achieve: number | undefined, target: number) => {
    if (achieve === undefined || isNaN(achieve)) return 'N/A';
    const diff = achieve - target;
    return `${diff > 0 ? '+' : ''}${(diff * 100).toFixed(1)}%`;
  };

  return (
    <div className="space-y-8">
      {/* Hero KPI Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-800 shadow-lg border border-indigo-400/20">
        {/* Decorative Circles */}
        <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-white/10 mix-blend-overlay"></div>
        <div className="absolute top-1/2 right-1/4 w-32 h-32 rounded-full bg-indigo-400/20 blur-3xl"></div>

        <div className="p-8 pb-6 relative z-10">
          <h2 className="text-indigo-100 text-sm font-medium tracking-wider mb-2">全公司{parseInt(reportMonth.substring(5, 7), 10)}月合併總業績</h2>
          <div className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-8 drop-shadow-sm">
            {formatCurrency(totalResult?.revenue || 0)}
          </div>
          
          <div>
            <div className="flex justify-between items-end mb-2">
              <span className="text-indigo-100 text-sm font-medium">
                月預算達成率 ({formatCurrency(totalResult?.target?.annual_target || 0)})
              </span>
              <span className="text-white font-bold tracking-wide">
                {formatPct(totalResult?.achievement_rate)}
              </span>
            </div>
            <div className="h-2 w-full bg-indigo-900/40 rounded-full overflow-hidden shadow-inner">
              <div 
                className="h-full bg-emerald-400 rounded-full transition-all duration-1000 ease-out" 
                style={{ width: `${Math.min(100, (totalResult?.achievement_rate || 0) * 100)}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="h-px w-full bg-white/10 relative z-10"></div>

        <div className="p-8 pt-6 grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          {/* Left Column */}
          <div className="space-y-6">
            <div>
              <div className="text-indigo-200 text-sm mb-1 tracking-wide">月高標達成率 ({formatCurrency(totalResult?.target?.high_target || 0)})</div>
              <div className="text-2xl font-bold text-white tracking-tight">{formatPct(totalResult?.high_achievement_rate)}</div>
            </div>
            <div className="relative group w-max cursor-help">
              <div className="text-indigo-200 text-sm mb-1 tracking-wide flex items-center gap-1">
                去年同月財報 YoY
                <Info className="w-3.5 h-3.5 opacity-70" />
              </div>
              <div className={`text-xl font-bold flex items-center gap-1.5 ${(totalResult?.yoy_rate || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {(() => {
                  const yoy = totalResult?.yoy_rate || 0;
                  return yoy >= 0 ? (
                     <TrendingUp className="w-5 h-5 flex-shrink-0" />
                  ) : (
                     <TrendingDown className="w-5 h-5 flex-shrink-0" />
                  );
                })()}
                {((totalResult?.yoy_rate || 0) > 0 ? '+' : '')}{formatPct(totalResult?.yoy_rate)}
              </div>

              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900/95 backdrop-blur text-white text-xs rounded-lg p-3 shadow-xl z-50 ring-1 ring-white/10">
                <div className="font-medium text-gray-300 mb-1 border-b border-gray-700 pb-1">去年同月財報金額</div>
                <div className="font-mono text-sm font-semibold text-emerald-400">{formatCurrency(totalResult?.target?.py_revenue || 0)}</div>
                <div className="absolute left-4 -bottom-1.5 w-3 h-3 bg-gray-900 border-b border-r border-white/10 transform rotate-45"></div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <div>
              <div className="text-indigo-200 text-sm mb-1 tracking-wide">月低標達成率 ({formatCurrency(totalResult?.target?.low_target || 0)})</div>
              <div className="text-2xl font-bold text-white tracking-tight">{formatPct(totalResult?.low_achievement_rate)}</div>
            </div>
            <div className="relative group w-max cursor-help">
              <div className="text-indigo-200 text-sm mb-1 tracking-wide flex items-center gap-1">
                前年同月財報 YoY
                <Info className="w-3.5 h-3.5 opacity-70" />
              </div>
              <div className={`text-xl font-bold flex items-center gap-1.5 ${(totalResult?.ppy_rate || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {(() => {
                  const ppy = totalResult?.ppy_rate || 0;
                  return ppy >= 0 ? (
                     <TrendingUp className="w-5 h-5 flex-shrink-0" />
                  ) : (
                     <TrendingDown className="w-5 h-5 flex-shrink-0" />
                  );
                })()}
                {((totalResult?.ppy_rate || 0) > 0 ? '+' : '')}{formatPct(totalResult?.ppy_rate)}
              </div>
              
              <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-48 bg-gray-900/95 backdrop-blur text-white text-xs rounded-lg p-3 shadow-xl z-50 ring-1 ring-white/10">
                <div className="font-medium text-gray-300 mb-1 border-b border-gray-700 pb-1">前年同月財報金額</div>
                <div className="font-mono text-sm font-semibold text-emerald-400">{formatCurrency(totalResult?.target?.ppy_revenue || 0)}</div>
                <div className="absolute left-4 -bottom-1.5 w-3 h-3 bg-gray-900 border-b border-r border-white/10 transform rotate-45"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quarterly Forecast */}
      {displayQuarterForecast && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative group">
            <h3 className="text-sm font-medium text-gray-500 tracking-wide mb-1 flex items-center gap-2 whitespace-nowrap">
              {displayQuarterForecast.year} Q{displayQuarterForecast.quarter}累積合併季業績
            </h3>
            <div className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
              {formatCurrency(displayQuarterForecast.cy_revenue)}
            </div>
            {displayQuarterForecast.py_revenue > 0 && (
              <div className={`text-sm font-medium ${displayQuarterForecast.cy_revenue >= displayQuarterForecast.py_revenue ? 'text-emerald-600' : 'text-rose-600'}`}>
                YoY {(((displayQuarterForecast.cy_revenue - displayQuarterForecast.py_revenue) / displayQuarterForecast.py_revenue) * 100) > 0 ? '+' : ''}{(((displayQuarterForecast.cy_revenue - displayQuarterForecast.py_revenue) / displayQuarterForecast.py_revenue) * 100).toFixed(1)}%
              </div>
            )}
            {/* Details Tooltip */}
            {displayQuarterForecast.details && (
              <div className="hidden group-hover:block absolute z-10 bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
                <div className="font-medium text-gray-300 mb-2 border-b border-gray-700 pb-1">當季各月實際營收</div>
                {displayQuarterForecast.details.map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span>{d.month} 實際營收:</span>
                    <span className="font-mono">{formatCurrency(d.cyRevenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm bg-gray-50/50 relative group">
             <h3 className="text-sm font-medium text-gray-500 tracking-wide mb-1 whitespace-nowrap">
              去年同期營收
            </h3>
            <div className="text-3xl font-bold text-gray-600 tracking-tight">
              {formatCurrency(displayQuarterForecast.py_revenue)}
            </div>

            {/* Details Tooltip */}
            {displayQuarterForecast.details && (
              <div className="hidden group-hover:block absolute z-10 bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
                <div className="font-medium text-gray-300 mb-2 border-b border-gray-700 pb-1">去年同季營收各月分布</div>
                {displayQuarterForecast.details.map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span>{d.month} 去年實際營收:</span>
                    <span className="font-mono">{formatCurrency(d.pyRevenue)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative group">
            <h3 className="text-sm font-medium text-gray-500 tracking-wide mb-1 flex items-center gap-2 whitespace-nowrap">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              {displayQuarterForecast.year} Q{displayQuarterForecast.quarter} 當季高標預估
            </h3>
            <div className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
              {formatCurrency(displayQuarterForecast.high_target)}
            </div>
            <div className={`text-sm font-medium ${(displayQuarterForecast.yoy_high >= 0) ? 'text-emerald-600' : 'text-rose-600'}`}>
              YoY {(displayQuarterForecast.yoy_high > 0 ? '+' : '')}{(displayQuarterForecast.yoy_high * 100).toFixed(1)}%
            </div>
            
            {/* Details Tooltip */}
            {displayQuarterForecast.details && (
              <div className="hidden group-hover:block absolute z-10 bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
                <div className="font-medium text-gray-300 mb-2 border-b border-gray-700 pb-1">高標預估計算邏輯</div>
                {displayQuarterForecast.details.map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span>{d.month} {d.type === 'actual' ? '實際營收' : '高標預估'}:</span>
                    <span className="font-mono">{formatCurrency(d.valueHigh)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm relative group">
             <h3 className="text-sm font-medium text-gray-500 tracking-wide mb-1 flex items-center gap-2 whitespace-nowrap">
              <TrendingDown className="w-4 h-4 text-rose-500" />
              {displayQuarterForecast.year} Q{displayQuarterForecast.quarter} 當季低標預估
            </h3>
            <div className="text-3xl font-bold text-gray-900 tracking-tight mb-2">
              {formatCurrency(displayQuarterForecast.low_target)}
            </div>
            <div className={`text-sm font-medium ${(displayQuarterForecast.yoy_low >= 0) ? 'text-emerald-600' : 'text-rose-600'}`}>
              YoY {(displayQuarterForecast.yoy_low > 0 ? '+' : '')}{(displayQuarterForecast.yoy_low * 100).toFixed(1)}%
            </div>

            {/* Details Tooltip */}
            {displayQuarterForecast.details && (
              <div className="hidden group-hover:block absolute z-10 bottom-full left-0 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-xl pointer-events-none">
                <div className="font-medium text-gray-300 mb-2 border-b border-gray-700 pb-1">低標預估計算邏輯</div>
                {displayQuarterForecast.details.map((d, i) => (
                  <div key={i} className="flex justify-between items-center py-1">
                    <span>{d.month} {d.type === 'actual' ? '實際營收' : '低標預估'}:</span>
                    <span className="font-mono">{formatCurrency(d.valueLow)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
        <h3 className="text-lg font-medium text-gray-900 mb-6 font-sans">通路月長條圖(月累積vs低標月目標)</h3>
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} angle={-45} textAnchor="end" />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }}tickFormatter={(value) => `$${(value / 10000).toFixed(0)}w`} />
              <Tooltip 
                cursor={{ fill: '#F3F4F6' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar dataKey="低標目標" fill="#E5E7EB" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="低標目標" position="top" formatter={(value: number) => value > 0 ? `$${(value / 10000).toFixed(0)}w` : ''} fill="#9CA3AF" fontSize={11} offset={8} />
              </Bar>
              <Bar dataKey="累積業績" fill="#4F46E5" radius={[4, 4, 0, 0]}>
                <LabelList dataKey="累積業績" position="top" formatter={(value: number) => value > 0 ? `$${(value / 10000).toFixed(0)}w` : ''} fill="#4B5563" fontSize={11} offset={8} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detail Table */}
      {!hideTable && (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h3 className="text-lg font-medium text-gray-900 font-sans">通路明細表(月)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">通路</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">月累計</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">預算達成率</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">時間進度</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">進度差額</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">去年 YoY</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">前年 YoY</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {results.map((r, i) => {
                const diff = (r.achievement_rate !== undefined && !isNaN(r.achievement_rate)) 
                  ? r.achievement_rate - timeProgress 
                  : undefined;
                return (
                  <tr key={r.channel} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {r.channel === '中國事業處' ? (
                        <div className="relative group inline-flex items-center cursor-help">
                          <span>{r.channel}</span>
                          <Info className="w-4 h-4 ml-1.5 text-gray-400 group-hover:text-indigo-500 transition-colors" />
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-4 bg-gray-900 text-white rounded-xl shadow-xl z-50 whitespace-normal text-sm ring-1 ring-white/10">
                            <div className="font-semibold mb-3 flex items-center">
                              <Info className="w-4 h-4 mr-1.5 text-indigo-400" />
                              備註資訊
                            </div>
                            <div className="space-y-2 text-gray-300">
                              <div className="flex justify-between items-center py-1">
                                <span>上海原幣金額/匯率:</span>
                                <div className="text-right font-mono">
                                  <div>RMB {Math.round(Number(r.breakdown?.['上海當地RMB']) || 0).toLocaleString()}</div>
                                  <div className="text-xs text-gray-400">/ {Number(r.breakdown?.['均值匯率'] || 0).toFixed(4)}</div>
                                </div>
                              </div>
                              <div className="h-px bg-gray-700/50 my-2"></div>
                              <div className="py-1">
                                <div className="text-gray-300 mb-1">中國事業處非關係人銷售金額</div>
                                <div className="text-xs text-gray-500 mb-1">(中國事業處扣除2CHN018後業績金額)</div>
                                <div className="text-right font-mono text-[15px] font-medium text-white">
                                  {Math.round((Number(r.breakdown?.['台端出貨']) || 0) - (Number(r.breakdown?.['沖銷']) || 0)).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="absolute left-6 -bottom-1.5 w-3 h-3 bg-gray-900 border-b border-r border-white/10 rotate-45 transform origin-center"></div>
                          </div>
                        </div>
                      ) : r.channel === '總經理室' && (r.revenue !== 0 || r.p000004Notes?.length) ? (
                        <div className="relative group inline-flex items-center cursor-help">
                          <span>{r.channel}</span>
                          <AlertTriangle className="w-4 h-4 ml-1.5 text-rose-500 transition-colors" />
                          <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-72 p-4 bg-gray-900 text-white rounded-xl shadow-xl z-50 whitespace-normal text-sm ring-1 ring-white/10">
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
                                    <span className="shrink-0 font-mono">${Math.round(amount).toLocaleString()}</span>
                                  </div>
                                )})}
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
                      {formatPct(r.achievement_rate)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right font-mono text-indigo-600">
                      {timeProgress > 0 ? (timeProgress * 100).toFixed(1) + '%' : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-medium">
                      {diff !== undefined ? (
                         <span className={diff >= 0 ? "text-emerald-600" : "text-rose-600"}>
                           {diff > 0 ? '+' : ''}{(diff * 100).toFixed(1)}%
                         </span>
                      ) : '-'}
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </div>
  );
}
