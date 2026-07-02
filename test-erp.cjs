const XLSX = require('xlsx');

const ws = XLSX.utils.aoa_to_sheet([
  ['歐萊德國際股份有限公司'],
  ['歷史交易記錄表'],
  ['製表日期: 2026/06/26', '', '', '', '', '', '', '', '', '', '', '', '', '期間: 2026/06/01 至 2026/06/25', '', '', '', '', '第 1 頁'],
  ['客戶代號\n▼', '客戶簡稱', '銷貨日期', '銷貨單號', '訂單單號', '品號', '品名', '銷貨數量', '贈品/備品', '單價', '銷貨金額▼', '本幣未稅金額▼', '本幣稅額▼', '部門▼', '業務▼', '批號▼', '備註▼', '促銷代號▼', '促銷名稱▼'],
  ['A17093', '李梓菱', '2026/06/17']
]);

const rawData = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

let headerRowIndex = -1;
let allHeadersDebug = [];
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

console.log('headerRowIndex:', headerRowIndex);
console.log('allHeadersDebug:', allHeadersDebug);

