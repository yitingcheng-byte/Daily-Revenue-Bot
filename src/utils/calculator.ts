import { ERPData, CloudStoreData, ManualInputs, CalculationResult, Anomaly, MonthlyTarget, ExchangeRate, P000004Note, StoreComparison } from '../types';

interface Context {
  erpMap: Record<string, number>;
  cloudMap: Record<string, number>;
  platformMap: Record<string, number>;
  manual: ManualInputs;
  targetsMap: Record<string, MonthlyTarget>;
  exchangeRate: ExchangeRate | null;
  reportDate: Date;
  anomalies: Anomaly[];
  p000004Notes: P000004Note[];
  storeComparisons: StoreComparison[];
}

export function calculateRevenue(
  erpData: ERPData[],
  cloudData: CloudStoreData[],
  platformData: ERPData[],
  manual: ManualInputs,
  targets: MonthlyTarget[],
  exchangeRate: ExchangeRate | null,
  reportDate: Date,
  p000004Notes: P000004Note[] = []
): { results: CalculationResult[]; anomalies: Anomaly[]; storeComparisons: StoreComparison[] } {
  // Aggregate ERP Data manually as there might be duplicates
  const erpMap: Record<string, number> = {};
  for (const row of erpData) {
    erpMap[row.deptCode] = (erpMap[row.deptCode] || 0) + row.revenue;
  }

  const platformMap: Record<string, number> = {};
  for (const row of platformData) {
    platformMap[row.deptCode] = (platformMap[row.deptCode] || 0) + row.revenue;
  }

  // Aggregate Cloud Data
  const cloudMap: Record<string, number> = {};
  for (const row of cloudData) {
    cloudMap[row.storeCode] = (cloudMap[row.storeCode] || 0) + row.revenueTaxInc;
  }

  const targetsMap: Record<string, MonthlyTarget> = {};
  for (const target of targets) {
    targetsMap[target.channel] = target;
  }

  const anomalies: Anomaly[] = [];
  const storeComparisons: StoreComparison[] = [];
  const ctx: Context = { erpMap, cloudMap, platformMap, manual, targetsMap, exchangeRate, reportDate, anomalies, p000004Notes, storeComparisons };

  const results: CalculationResult[] = [];

  // Check Exchange Rate if Shanghai RMB is provided
  if (manual.shanghaiRmb > 0 && (!exchangeRate || exchangeRate.avg_rate <= 0)) {
    anomalies.push({ type: 'error', message: '已輸入上海 RMB 業績，但未設定有效的 RMB 固定匯率。 (Exchange rate not set)' });
  }

  // Check 6100001, 6100003, 6100006 are not adding to master (they shouldn't be added directly to O323 sum if our logic just uses O323)
  const websitePayments = ['6100001', '6100003', '6100006'];
  for (const wp of websitePayments) {
    if (erpMap[wp] > 0) {
      anomalies.push({ type: 'warning', message: `偵測到官網支付別 ${wp} 存在，提醒：不可與 O323 重複計入。` });
    }
  }

  if (erpMap['O334']) {
    anomalies.push({ type: 'warning', message: 'ERP 檔案中包含 O334 彙總，系統將忽略並依平台明細重新計算，避免重複加總。' });
  }


  results.push(calcECommerce(ctx));
  results.push(calcDepartmentStores(ctx));
  results.push(calcSalon(ctx));
  results.push(calcEnterpriseNew(ctx));
  results.push(calcLargeChannel(ctx));
  results.push(calcIntlOther(ctx));
  results.push(calcIntlJapan(ctx));
  results.push(calcChina(ctx));
  results.push(calcSustainable(ctx));
  results.push(calcStrategic(ctx));
  results.push(calcAdmin(ctx));
  results.push(calcGM(ctx));
  results.push(calcOther(ctx));

  // Add achievement calculations
  for (const res of results) {
    const target = targetsMap[res.channel];
    if (target) {
      res.target = target;
      if (target.annual_target > 0) res.achievement_rate = res.revenue / target.annual_target;
      if (target.py_revenue > 0) res.yoy_rate = (res.revenue - target.py_revenue) / target.py_revenue;
      if (target.ppy_revenue > 0) res.ppy_rate = (res.revenue - target.ppy_revenue) / target.ppy_revenue;
      if (target.high_target > 0) res.high_achievement_rate = res.revenue / target.high_target;
      if (target.low_target > 0) res.low_achievement_rate = res.revenue / target.low_target;
    }
  }

  // Check for unknown codes in ERP
  const knownPrefixes = [
    'O323', 'O334', '6100001', '6100003', '6100006', 
    '6009001', '6012001', '5001020', '6013001', '6003002', '5001025', '6007001',
    'O216', 'O109', 'O234', 'O235', 'O236',
    'O112', 'O227', 'O324',
    'O118', 'O104', 'O237', 'O238', 'O107',
    'O117', '2CHN018', 'O120', 'O119', 'G201', 'P000', 'F101', 'L305', 'O201'
  ];
  
  for (const code of Object.keys(erpMap)) {
    // Dept stores are O302~O367 roughly, filter them dynamically
    if (code.match(/^O3\d{2}$/)) continue;
    if (!knownPrefixes.includes(code) && erpMap[code] !== 0) {
      anomalies.push({ type: 'warning', message: `未對照代號: ${code} ${erpMap[code]}` });
    }
  }

  let totalRevenue = 0;
  let totalAnnualTarget = 0;
  let totalHighTarget = 0;
  let totalLowTarget = 0;
  let totalCy = 0;
  let totalPy = 0;
  let totalPpy = 0;

  for (const res of results) {
    totalRevenue += res.revenue;
    if (res.target) {
      if (res.target.annual_target) totalAnnualTarget += res.target.annual_target;
      if (res.target.high_target) totalHighTarget += res.target.high_target;
      if (res.target.low_target) totalLowTarget += res.target.low_target;
      if (res.target.cy_revenue) totalCy += res.target.cy_revenue;
      if (res.target.py_revenue) totalPy += res.target.py_revenue;
      if (res.target.ppy_revenue) totalPpy += res.target.ppy_revenue;
    }
  }

  const totalResult: CalculationResult = {
    channel: "合計 (全公司合併營收)",
    revenue: totalRevenue,
    target: {
      month: "",
      channel: "合計 (全公司合併營收)",
      annual_target: totalAnnualTarget,
      high_target: totalHighTarget,
      low_target: totalLowTarget,
      cy_revenue: totalCy,
      py_revenue: totalPy,
      ppy_revenue: totalPpy,
      note: ""
    }
  };

  if (totalAnnualTarget > 0) totalResult.achievement_rate = totalRevenue / totalAnnualTarget;
  if (totalHighTarget > 0) totalResult.high_achievement_rate = totalRevenue / totalHighTarget;
  if (totalLowTarget > 0) totalResult.low_achievement_rate = totalRevenue / totalLowTarget;
  if (totalPy > 0) totalResult.yoy_rate = (totalRevenue - totalPy) / totalPy;
  if (totalPpy > 0) totalResult.ppy_rate = (totalRevenue - totalPpy) / totalPpy;

  results.push(totalResult);

  return { results, anomalies, storeComparisons };
}

function sumERP(ctx: Context, codes: string[]): number {
  return codes.reduce((sum, code) => sum + (ctx.erpMap[code] || 0), 0);
}

function calcECommerce(ctx: Context): CalculationResult {
  // O323 + O334 rule
  const o323 = ctx.erpMap['O323'] || 0;
  
  const hasPlatformData = Object.keys(ctx.platformMap).length > 0;

  // Platform logic from platform file
  const shopee = ctx.platformMap['6009001'] || 0;
  const lineGift = ctx.platformMap['6012001'] || 0;
  const yahoo = ctx.platformMap['5001020'] || 0;
  const coupang = ctx.platformMap['6013001'] || 0;
  const otherPlatform = ctx.platformMap['6003003'] || 0;

  // Prioritize manual input if filled, otherwise use platform data (ERP numbers)
  const pchome = ctx.manual.pchome > 0 ? ctx.manual.pchome : (ctx.platformMap['6003002'] || 0);
  const books = ctx.manual.books > 0 ? ctx.manual.books : (ctx.platformMap['6007001'] || 0);
  const momo = ctx.manual.momo > 0 ? ctx.manual.momo : (ctx.platformMap['5001025'] || 0);

  let o334 = 0;
  if (hasPlatformData) {
    o334 = shopee + lineGift + yahoo + coupang + pchome + books + momo + otherPlatform;
  } else {
    o334 = ctx.erpMap['O334'] || 0;
  }

  // Calculate elements for "其他"
  // If we don't have platform data, we can't accurately split O334 into shopee/lineGift without it.
  // In that case, O334 represents everything. We just need to subtract the manual inputs (pchome, books, momo) from O334.
  let remainingO334 = o334;
  if (!hasPlatformData) {
     remainingO334 = o334 - pchome - books - momo;
     if (remainingO334 < 0) remainingO334 = 0; // fallback if manual exceeds O334
  } else {
     remainingO334 = shopee + lineGift + yahoo + coupang + otherPlatform;
  }

  return {
    channel: "電子商務處",
    revenue: o323 + o334,
    breakdown: {
      PChome: pchome,
      博客來: books,
      MOMO: momo,
      其他: o323 + remainingO334
    }
  };
}

function calcDepartmentStores(ctx: Context): CalculationResult {
  const o216 = ctx.erpMap['O216'] || 0;
  let cloudStoreSum = 0;
  let erpStoreSum = 0;

  const cloudCodes = Object.keys(ctx.cloudMap);
  const hasCloudData = cloudCodes.length > 0;

  const allStoreCodes = new Set<string>();

  if (hasCloudData) {
    for (const code of cloudCodes) {
      if (code !== 'O323' && code !== 'O334' && code !== 'O324') {
        cloudStoreSum += (ctx.cloudMap[code] / 1.05);
        allStoreCodes.add(code);
      }
    }
  }

  for (const code of Object.keys(ctx.erpMap)) {
    if (code.startsWith('O3') && code !== 'O323' && code !== 'O334' && code !== 'O324') {
      erpStoreSum += ctx.erpMap[code];
      allStoreCodes.add(code);
    }
  }

  let finalStoreSum = 0;

  if (hasCloudData) {
    let useErpCount = 0;
    let useCloudCount = 0;
    const storesUsingCloud: string[] = [];

    for (const code of allStoreCodes) {
      const erpValue = ctx.erpMap[code] || 0;
      const cloudValue = (ctx.cloudMap[code] || 0) / 1.05;
      const diff = Math.abs(erpValue - cloudValue);
      
      let selectedSource: 'ERP' | 'Cloud' = 'ERP';
      let finalValue = 0;

      if (diff < 20) {
        finalValue = erpValue;
        selectedSource = 'ERP';
        useErpCount++;
      } else {
        finalValue = cloudValue;
        selectedSource = 'Cloud';
        useCloudCount++;
        storesUsingCloud.push(`${code} (ERP:${Math.round(erpValue).toLocaleString()}, 雲端:${Math.round(cloudValue).toLocaleString()})`);
      }
      
      finalStoreSum += finalValue;
      ctx.storeComparisons.push({
        storeCode: code,
        erpRevenue: erpValue,
        cloudRevenueTaxExcl: cloudValue,
        diff: erpValue - cloudValue,
        selectedSource,
        finalRevenue: finalValue
      });
    }

    if (useCloudCount > 0) {
      ctx.anomalies.push({ type: 'info', message: `百貨業績比對：依據各館差額決定基準。有 ${useCloudCount} 館差異 ≥ $20 使用 [雲端數字]，其餘 ${useErpCount} 館使用 [ERP數字]。差異大於$20館別：${storesUsingCloud.join(', ')}` });
    } else {
      ctx.anomalies.push({ type: 'info', message: `百貨業績比對：各館別 ERP金額 與 雲端未稅金額 差距皆小於 $20，全數使用 [ERP業績數字]。` });
    }
  } else {
    // Priority back to ERP if no cloud data
    finalStoreSum = erpStoreSum;
  }

  return {
    channel: "百貨體驗館",
    revenue: o216 + finalStoreSum,
    breakdown: {
      "百貨各櫃合計(依差異判定)": finalStoreSum,
      "ERP O216營運部": o216
    }
  };
}

function calcSalon(ctx: Context): CalculationResult {
  return { channel: "沙龍事業處", revenue: sumERP(ctx, ['O109', 'O234', 'O235', 'O236']) };
}

function calcEnterpriseNew(ctx: Context): CalculationResult {
  return { channel: "企新(通路/企戶/環教館)", revenue: sumERP(ctx, ['O112', 'O227', 'O324']) };
}

function calcLargeChannel(ctx: Context): CalculationResult {
  return { channel: "大型通路", revenue: sumERP(ctx, ['O118']) };
}

function calcIntlOther(ctx: Context): CalculationResult {
  return { 
    channel: "國際事業處(其他國家)", 
    revenue: sumERP(ctx, ['O104', 'O237', 'O238']),
    breakdown: {
      "其他國家": sumERP(ctx, ['O104', 'O237', 'O238'])
    }
  };
}

function calcIntlJapan(ctx: Context): CalculationResult {
  return { 
    channel: "國際事業處(日本)", 
    revenue: sumERP(ctx, ['O107']),
    breakdown: {
      "日本": sumERP(ctx, ['O107'])
    }
  };
}

function calcChina(ctx: Context): CalculationResult {
  const o117 = ctx.erpMap['O117'] || 0;
  
  // Prioritize manual input for 2CHN018, otherwise fall back to ERP
  const chn018 = ctx.manual.chn018 && ctx.manual.chn018 !== 0 
    ? ctx.manual.chn018 
    : (ctx.erpMap['2CHN018'] || 0);
    
  if (chn018 < 0) {
    ctx.anomalies.push({ type: 'warning', message: '2CHN018 金額為負，依公式 O117 - 2CHN018 會變成加總，請確認。' });
  }

  const rmbRate = ctx.exchangeRate?.avg_rate || 0;
  const localTwd = ctx.manual.shanghaiRmb * rmbRate;

  return { 
    channel: "中國事業處", 
    revenue: o117 - chn018 + localTwd,
    breakdown: {
      台端出貨: o117,
      沖銷: chn018,
      上海當地RMB: ctx.manual.shanghaiRmb,
      均值匯率: rmbRate
    }
  };
}

function calcSustainable(ctx: Context): CalculationResult {
  return { channel: "永續美妝OBM·ODM·OEM", revenue: sumERP(ctx, ['O120']) };
}

function calcStrategic(ctx: Context): CalculationResult {
  return { channel: "策略產品發展處", revenue: sumERP(ctx, ['O119']) };
}

function calcAdmin(ctx: Context): CalculationResult {
  return { channel: "行政總部(員購)", revenue: sumERP(ctx, ['G201']) };
}

function calcGM(ctx: Context): CalculationResult {
  return { 
    channel: "總經理室", 
    revenue: sumERP(ctx, ['P000']),
    p000004Notes: ctx.p000004Notes
  };
}

function calcOther(ctx: Context): CalculationResult {
  // F101, L305, O201 (+ dynamic other codes if any not matched)
  return { channel: "其他", revenue: sumERP(ctx, ['F101', 'L305', 'O201']) };
}

