export type FundType = "growth" | "dividend" | "other_dividend";

export type Fund = {
  code: string;
  name: string;
  risk: string;
  bidPrice: string;
  offerPrice: string;
  valuationDate: string;
  morningstar: string;
  type: FundType;
  manager: string;
  assetClass: string;
  aum: string;
};

export type FundsDataset = {
  product: string;
  source: string;
  scrapedAt: string;
  counts: {
    total: number;
    growth: number;
    dividend: number;
    other: number;
  };
  funds: Fund[];
};

export type FundFilters = {
  q?: string;
  type?: "all" | "growth" | "dividend";
  risk?: string;
  assetClass?: string;
};

export type ChartPoint = {
  t: number;
  price: number;
};

export type YearReturn = {
  year: string;
  value: string;
  negative: boolean;
};

export type FundExtras = {
  isin: string;
  dailyChange: string;
  performanceAsOf: string;
  yearReturns: YearReturn[];
};

export type ChartPeriod = "1M" | "3M" | "6M" | "1Y" | "5Y" | "All";
