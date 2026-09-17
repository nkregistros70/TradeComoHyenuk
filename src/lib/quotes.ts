import { db } from "@/db";
import { etfQuotes, etfs } from "@/db/schema";
import { sql } from "drizzle-orm";
import {
  ANOMALY_THRESHOLD,
  BENCHMARKS,
  ETF_CATALOG,
  SECTORS,
} from "./etf-catalog";
import { getMarketStatus, quoteTtlMs } from "./market-hours";
import type {
  BreadthStats,
  EtfCardData,
  IndexQuote,
  MarketPayload,
  QuoteMetrics,
  SectorStat,
} from "./types";
import { fetchYahooQuotes } from "./yahoo";

function average(values: Array<number | null | undefined>) {
  const valid = values.filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
  if (valid.length === 0) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function toIso(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

export async function ensureCatalog() {
  await db
    .insert(etfs)
    .values(ETF_CATALOG)
    .onConflictDoUpdate({
      target: etfs.ticker,
      set: {
        name: sql`excluded.name`,
        shortName: sql`excluded.short_name`,
        sector: sql`excluded.sector`,
        sectorKey: sql`excluded.sector_key`,
        macroProfile: sql`excluded.macro_profile`,
        theme: sql`excluded.theme`,
      },
    });
}

async function persistQuotes(quotes: Map<string, QuoteMetrics>) {
  const now = new Date();
  const rows = [...quotes.values()].map((quote) => ({
    ticker: quote.ticker,
    price: quote.price,
    change1d: quote.change1d,
    change1w: quote.change1w,
    change1m: quote.change1m,
    volume: quote.volume,
    previousClose: quote.previousClose,
    dayHigh: quote.dayHigh,
    dayLow: quote.dayLow,
    updatedAt: now,
    stale: 0,
  }));

  if (rows.length === 0) return;

  await db
    .insert(etfQuotes)
    .values(rows)
    .onConflictDoUpdate({
      target: etfQuotes.ticker,
      set: {
        price: sql`excluded.price`,
        change1d: sql`excluded.change_1d`,
        change1w: sql`excluded.change_1w`,
        change1m: sql`excluded.change_1m`,
        volume: sql`excluded.volume`,
        previousClose: sql`excluded.previous_close`,
        dayHigh: sql`excluded.day_high`,
        dayLow: sql`excluded.day_low`,
        updatedAt: sql`excluded.updated_at`,
        stale: sql`excluded.stale`,
      },
    });
}

function isFresh(updatedAt: Date | null, open: boolean) {
  if (!updatedAt) return false;
  return Date.now() - updatedAt.getTime() < quoteTtlMs(open);
}

export async function refreshQuotesIfNeeded(force = false) {
  const market = getMarketStatus();
  const latest = await db
    .select({ updatedAt: etfQuotes.updatedAt })
    .from(etfQuotes)
    .orderBy(sql`${etfQuotes.updatedAt} desc`)
    .limit(1);

  if (!force && isFresh(latest[0]?.updatedAt ?? null, market.open)) {
    return { refreshed: false, market };
  }

  try {
    const quotes = await fetchYahooQuotes();
    if (quotes.size > 0) {
      await persistQuotes(quotes);
    }
  } catch (error) {
    console.error("Yahoo refresh failed", error);
  }

  return { refreshed: true, market };
}

function buildSectorStats(etfRows: EtfCardData[]): SectorStat[] {
  return SECTORS.map((sector) => {
    const members = etfRows.filter((row) => row.sectorKey === sector.key);
    const avg1d = average(members.map((row) => row.change1d));
    return {
      key: sector.key,
      label: sector.label,
      color: sector.color,
      count: members.length,
      avg1d,
      avg1w: average(members.map((row) => row.change1w)),
      avg1m: average(members.map((row) => row.change1m)),
      leaders: members.filter((row) => (row.change1d ?? 0) > 0).length,
      laggards: members.filter((row) => (row.change1d ?? 0) < 0).length,
    };
  });
}

function buildBreadth(etfRows: EtfCardData[]): BreadthStats {
  const cyclicalAvg = average(
    etfRows
      .filter((row) => row.macroProfile === "ciclico")
      .map((row) => row.change1d),
  );
  const defensiveAvg = average(
    etfRows
      .filter((row) => row.macroProfile === "defensivo")
      .map((row) => row.change1d),
  );
  const sensitiveAvg = average(
    etfRows
      .filter((row) => row.macroProfile === "sensible")
      .map((row) => row.change1d),
  );

  let riskBias: BreadthStats["riskBias"] = "Neutral";
  if (cyclicalAvg != null && defensiveAvg != null) {
    if (cyclicalAvg - defensiveAvg >= 0.15) riskBias = "Risk-On";
    else if (defensiveAvg - cyclicalAvg >= 0.15) riskBias = "Risk-Off";
  }

  return {
    up: etfRows.filter((row) => (row.change1d ?? 0) > 0.005).length,
    down: etfRows.filter((row) => (row.change1d ?? 0) < -0.005).length,
    flat: etfRows.filter(
      (row) => row.change1d != null && Math.abs(row.change1d) <= 0.005,
    ).length,
    anomalous: etfRows.filter((row) => row.anomalous).length,
    riskBias,
    cyclicalAvg,
    defensiveAvg,
    sensitiveAvg,
  };
}

export async function assemblePayload(): Promise<MarketPayload> {
  const market = getMarketStatus();
  const catalog = await db.select().from(etfs);
  const quotes = await db.select().from(etfQuotes);
  const quoteMap = new Map(quotes.map((quote) => [quote.ticker, quote]));

  const etfRows: EtfCardData[] = catalog.map((item) => {
    const quote = quoteMap.get(item.ticker);
    const change1d = quote?.change1d ?? null;
    return {
      ticker: item.ticker,
      name: item.name,
      shortName: item.shortName,
      sector: item.sector,
      sectorKey: item.sectorKey,
      macroProfile: item.macroProfile as EtfCardData["macroProfile"],
      theme: item.theme,
      price: quote?.price ?? null,
      change1d,
      change1w: quote?.change1w ?? null,
      change1m: quote?.change1m ?? null,
      volume: quote?.volume ?? null,
      previousClose: quote?.previousClose ?? null,
      dayHigh: quote?.dayHigh ?? null,
      dayLow: quote?.dayLow ?? null,
      updatedAt: toIso(quote?.updatedAt),
      stale: (quote?.stale ?? 1) > 0,
      anomalous:
        change1d != null && Math.abs(change1d) >= ANOMALY_THRESHOLD,
    };
  });

  const indices: IndexQuote[] = BENCHMARKS.map((benchmark) => {
    const quote = quoteMap.get(benchmark.ticker);
    return {
      ticker: benchmark.ticker,
      name: benchmark.name,
      fullName: benchmark.fullName,
      price: quote?.price ?? null,
      change1d: quote?.change1d ?? null,
      change1w: quote?.change1w ?? null,
      change1m: quote?.change1m ?? null,
      volume: quote?.volume ?? null,
      previousClose: quote?.previousClose ?? null,
      dayHigh: quote?.dayHigh ?? null,
      dayLow: quote?.dayLow ?? null,
      updatedAt: toIso(quote?.updatedAt),
      stale: (quote?.stale ?? 1) > 0,
    };
  });

  const timestamps = quotes
    .map((quote) => quote.updatedAt)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime());

  return {
    market,
    updatedAt: toIso(timestamps[0] ?? null),
    indices,
    etfs: etfRows,
    sectors: buildSectorStats(etfRows),
    breadth: buildBreadth(etfRows),
  };
}

export async function getMarketData(options?: {
  force?: boolean;
  refresh?: boolean;
}): Promise<MarketPayload> {
  await ensureCatalog();
  if (options?.refresh !== false) {
    await refreshQuotesIfNeeded(options?.force);
  }
  return assemblePayload();
}
