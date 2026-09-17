import { ALL_QUOTE_TICKERS } from "./etf-catalog";
import type { QuoteMetrics } from "./types";

type SparkMeta = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  regularMarketVolume?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
};

type SparkResult = {
  symbol?: string;
  response?: Array<{
    meta?: SparkMeta;
    timestamp?: number[];
    indicators?: {
      quote?: Array<{
        close?: Array<number | null>;
      }>;
    };
  }>;
};

type SparkResponse = {
  spark?: {
    result?: SparkResult[];
    error?: unknown;
  };
};

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

const BATCH_SIZE = 10;

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function pct(current: number | null, base: number | null) {
  if (current == null || base == null || base === 0) return null;
  return ((current - base) / base) * 100;
}

function validCloses(values: Array<number | null> | undefined) {
  return (values ?? []).filter(
    (value): value is number => typeof value === "number" && Number.isFinite(value),
  );
}

function closeFromEnd(closes: number[], offset: number) {
  if (closes.length === 0) return null;
  const index = closes.length - 1 - offset;
  if (index < 0) return closes[0] ?? null;
  return closes[index] ?? null;
}

function parseSparkItem(item: SparkResult): QuoteMetrics | null {
  const payload = item.response?.[0];
  const meta = payload?.meta ?? {};
  const ticker = (item.symbol || meta.symbol || "").toUpperCase();
  if (!ticker) return null;

  const closes = validCloses(payload?.indicators?.quote?.[0]?.close);
  const price = asNumber(meta.regularMarketPrice) ?? closes.at(-1) ?? null;
  const previousClose = closeFromEnd(closes, 1);
  const weekBase = closeFromEnd(closes, 5);
  const monthBase = closes[0] ?? null;
  const change1d =
    asNumber(meta.regularMarketChangePercent) ?? pct(price, previousClose);

  return {
    ticker,
    price,
    change1d,
    change1w: pct(price, weekBase),
    change1m: pct(price, monthBase),
    volume: asNumber(meta.regularMarketVolume),
    previousClose,
    dayHigh: asNumber(meta.regularMarketDayHigh),
    dayLow: asNumber(meta.regularMarketDayLow),
    updatedAt: new Date().toISOString(),
    stale: false,
  };
}

async function fetchJson<T>(url: string, timeoutMs = 12000): Promise<T> {
  const response = await fetch(url, {
    headers: YAHOO_HEADERS,
    cache: "no-store",
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) {
    throw new Error(`Yahoo HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

async function fetchSparkBatch(symbols: string[]) {
  const url = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(symbols.join(","))}&range=1mo&interval=1d`;
  const payload = await fetchJson<SparkResponse>(url);
  const rows = payload.spark?.result ?? [];
  const parsed: QuoteMetrics[] = [];

  for (const row of rows) {
    const quote = parseSparkItem(row);
    if (quote) parsed.push(quote);
  }

  return parsed;
}

async function fetchChartQuote(symbol: string): Promise<QuoteMetrics | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`;
  const payload = await fetchJson<{
    chart?: { result?: SparkResult["response"]; error?: unknown };
  }>(url);

  const result = payload.chart?.result?.[0];
  if (!result) return null;
  return parseSparkItem({ symbol, response: [result] });
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
) {
  const output: R[] = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await mapper(items[index]);
    }
  }

  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return output;
}

export async function fetchYahooQuotes(
  tickers: string[] = ALL_QUOTE_TICKERS,
): Promise<Map<string, QuoteMetrics>> {
  const unique = [...new Set(tickers.map((ticker) => ticker.toUpperCase()))];
  const quotes = new Map<string, QuoteMetrics>();
  const batches: string[][] = [];

  for (let index = 0; index < unique.length; index += BATCH_SIZE) {
    batches.push(unique.slice(index, index + BATCH_SIZE));
  }

  const batchResults = await Promise.allSettled(
    batches.map((batch) => fetchSparkBatch(batch)),
  );

  const missing: string[] = [];

  batchResults.forEach((result, index) => {
    const batch = batches[index];
    if (result.status === "fulfilled") {
      for (const quote of result.value) {
        quotes.set(quote.ticker, quote);
      }
      for (const ticker of batch) {
        if (!quotes.has(ticker)) missing.push(ticker);
      }
    } else {
      missing.push(...batch);
    }
  });

  if (missing.length > 0) {
    const recovered = await mapPool(missing, 4, async (ticker) => {
      try {
        return await fetchChartQuote(ticker);
      } catch {
        return null;
      }
    });

    for (const quote of recovered) {
      if (quote) quotes.set(quote.ticker, quote);
    }
  }

  return quotes;
}
