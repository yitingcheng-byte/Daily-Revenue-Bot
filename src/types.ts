export type Channel =
  | "電子商務處"
  | "百貨體驗館"
  | "沙龍事業處"
  | "企新(通路/企戶/環教館)"
  | "大型通路"
  | "國際事業處(其他國家)"
  | "國際事業處(日本)"
  | "中國事業處"
  | "永續美妝OBM·ODM·OEM"
  | "策略產品發展處"
  | "行政總部(員購)"
  | "總經理室"
  | "其他";

export const CHANNELS: Channel[] = [
  "電子商務處",
  "百貨體驗館",
  "沙龍事業處",
  "企新(通路/企戶/環教館)",
  "大型通路",
  "國際事業處(其他國家)",
  "國際事業處(日本)",
  "中國事業處",
  "永續美妝OBM·ODM·OEM",
  "策略產品發展處",
  "行政總部(員購)",
  "總經理室",
  "其他",
];

export interface ERPData {
  deptCode: string;
  revenue: number;
}

export interface CloudStoreData {
  storeCode: string;
  revenueTaxInc: number;
}

export interface ManualInputs {
  pchome: number;
  books: number;
  momo: number;
  shanghaiRmb: number;
  chn018: number;
  generalNote?: string;
}

export interface MonthlyTarget {
  month: string;
  channel: string;
  annual_target: number;
  cy_revenue: number;
  py_revenue: number;
  ppy_revenue: number;
  high_target: number;
  low_target: number;
  note: string;
}

export interface ExchangeRate {
  month: string;
  buy_rate: number;
  sell_rate: number;
  avg_rate: number;
}

export interface P000004Note {
  date: string;
  customerName: string;
  amount: number;
}

export interface StoreComparison {
  storeCode: string;
  erpRevenue: number;
  cloudRevenueTaxExcl: number;
  diff: number;
  selectedSource: 'ERP' | 'Cloud';
  finalRevenue: number;
}

export interface CalculationResult {
  channel: string;
  revenue: number;
  target?: MonthlyTarget;
  achievement_rate?: number;
  yoy_rate?: number;
  ppy_rate?: number;
  high_achievement_rate?: number;
  low_achievement_rate?: number;
  breakdown?: Record<string, string | number>;
  p000004Notes?: P000004Note[];
  generalNote?: string;
}

export interface QuarterForecast {
  quarter: number;
  year: number;
  high_target: number;
  low_target: number;
  py_revenue: number;
  cy_revenue: number;
  yoy_high: number;
  yoy_low: number;
  details?: { month: string; type: string; valueHigh: number; valueLow: number; pyRevenue: number; cyRevenue: number }[];
}

export interface Anomaly {
  type: "error" | "warning" | "info";
  message: string;
}
