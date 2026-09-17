export type MacroProfile = "ciclico" | "defensivo" | "sensible";

export type EtfDefinition = {
  ticker: string;
  name: string;
  shortName: string;
  sector: string;
  sectorKey: string;
  macroProfile: MacroProfile;
  theme: string;
};

export type QuoteMetrics = {
  ticker: string;
  price: number | null;
  change1d: number | null;
  change1w: number | null;
  change1m: number | null;
  volume: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  updatedAt: string | null;
  stale: boolean;
};

export type EtfCardData = EtfDefinition &
  QuoteMetrics & {
    anomalous: boolean;
  };

export type IndexQuote = {
  ticker: string;
  name: string;
  fullName: string;
} & QuoteMetrics;

export type SectorStat = {
  key: string;
  label: string;
  color: string;
  count: number;
  avg1d: number | null;
  avg1w: number | null;
  avg1m: number | null;
  leaders: number;
  laggards: number;
};

export type MarketStatus = {
  open: boolean;
  label: string;
  timezone: string;
  session: string;
  nyTime: string;
};

export type BreadthStats = {
  up: number;
  down: number;
  flat: number;
  anomalous: number;
  riskBias: "Risk-On" | "Risk-Off" | "Neutral";
  cyclicalAvg: number | null;
  defensiveAvg: number | null;
  sensitiveAvg: number | null;
};

export type MarketPayload = {
  market: MarketStatus;
  updatedAt: string | null;
  indices: IndexQuote[];
  etfs: EtfCardData[];
  sectors: SectorStat[];
  breadth: BreadthStats;
};
