"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Search,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { EtfCard } from "@/components/etf-card";
import { cn } from "@/lib/cn";
import { MACROS, SECTORS } from "@/lib/etf-catalog";
import { formatClock, formatPct, formatPrice } from "@/lib/format";
import type { EtfCardData, MarketPayload } from "@/lib/types";

type SortKey =
  | "sector"
  | "gainers-1d"
  | "losers-1d"
  | "gainers-1w"
  | "losers-1w"
  | "gainers-1m"
  | "losers-1m";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "sector", label: "Por sector" },
  { key: "gainers-1d", label: "Ganadores 1D" },
  { key: "losers-1d", label: "Perdedores 1D" },
  { key: "gainers-1w", label: "Ganadores 1S" },
  { key: "losers-1w", label: "Perdedores 1S" },
  { key: "gainers-1m", label: "Ganadores 1M" },
  { key: "losers-1m", label: "Perdedores 1M" },
];

function changeOf(etf: EtfCardData, horizon: "1d" | "1w" | "1m") {
  if (horizon === "1w") return etf.change1w;
  if (horizon === "1m") return etf.change1m;
  return etf.change1d;
}

function sortEtfs(list: EtfCardData[], sort: SortKey) {
  if (sort === "sector") {
    return [...list].sort((a, b) => a.ticker.localeCompare(b.ticker));
  }
  const horizon = sort.endsWith("1w") ? "1w" : sort.endsWith("1m") ? "1m" : "1d";
  const direction = sort.startsWith("gainers") ? -1 : 1;
  return [...list].sort((a, b) => {
    const av = changeOf(a, horizon);
    const bv = changeOf(b, horizon);
    if (av == null && bv == null) return a.ticker.localeCompare(b.ticker);
    if (av == null) return 1;
    if (bv == null) return -1;
    return (av - bv) * direction;
  });
}

function tone(value: number | null | undefined) {
  if (value == null) return "text-mute";
  if (value > 0) return "ticker-up";
  if (value < 0) return "ticker-down";
  return "text-mute";
}

function IndexCard({
  ticker,
  name,
  price,
  change1d,
  change1w,
  change1m,
}: {
  ticker: string;
  name: string;
  price: number | null;
  change1d: number | null;
  change1w: number | null;
  change1m: number | null;
}) {
  const up = (change1d ?? 0) >= 0;
  return (
    <a
      href={`https://finviz.com/quote.ashx?t=${ticker}`}
      target="_blank"
      rel="noopener noreferrer"
      className="panel min-w-[220px] flex-1 rounded-2xl px-4 py-3 transition hover:border-sky-300/30"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm tracking-[0.18em] text-gold">{ticker}</p>
          <p className="mt-0.5 text-xs text-mute">{name}</p>
        </div>
        {up ? (
          <ArrowUpRight className="h-4 w-4 text-up" />
        ) : (
          <ArrowDownRight className="h-4 w-4 text-down" />
        )}
      </div>
      <div className="mt-3 flex items-end justify-between">
        <p className="font-mono text-2xl text-white">{formatPrice(price)}</p>
        <p className={cn("font-mono text-base font-semibold", tone(change1d))}>
          {formatPct(change1d)}
        </p>
      </div>
      <div className="mt-2 flex gap-3 font-mono text-[11px] text-mute">
        <span>
          1S <span className={tone(change1w)}>{formatPct(change1w)}</span>
        </span>
        <span>
          1M <span className={tone(change1m)}>{formatPct(change1m)}</span>
        </span>
      </div>
    </a>
  );
}

export function Dashboard({ initialData }: { initialData: MarketPayload }) {
  const [data, setData] = useState(initialData);
  const [search, setSearch] = useState("");
  const [sector, setSector] = useState("all");
  const [macro, setMacro] = useState("all");
  const [sort, setSort] = useState<SortKey>("sector");
  const [onlyAnomalous, setOnlyAnomalous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function pull(force = false) {
      try {
        setLoading(true);
        const response = await fetch(`/api/market${force ? "?force=1" : ""}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("No se pudo actualizar el feed");
        const payload = (await response.json()) as MarketPayload;
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
        const wait = payload.market.open ? 20_000 : 120_000;
        if (!cancelled) timer = setTimeout(() => pull(false), wait);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Error de red");
          timer = setTimeout(() => pull(false), 30_000);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    const shouldForce = !initialData.updatedAt;
    pull(shouldForce);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [initialData.updatedAt]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = data.etfs.filter((etf) => {
      const haystack = `${etf.ticker} ${etf.name} ${etf.shortName}`.toLowerCase();
      const matchesQuery = query.length === 0 || haystack.includes(query);
      const matchesSector = sector === "all" || etf.sectorKey === sector;
      const matchesMacro = macro === "all" || etf.macroProfile === macro;
      const matchesAnomaly = !onlyAnomalous || etf.anomalous;
      return matchesQuery && matchesSector && matchesMacro && matchesAnomaly;
    });
    return sortEtfs(list, sort);
  }, [data.etfs, search, sector, macro, sort, onlyAnomalous]);

  const grouped = useMemo(() => {
    if (sort !== "sector") return null;
    return SECTORS.map((item) => ({
      ...item,
      avg1d: data.sectors.find((sectorRow) => sectorRow.key === item.key)?.avg1d ?? null,
      items: filtered.filter((etf) => etf.sectorKey === item.key),
    })).filter((group) => group.items.length > 0);
  }, [filtered, sort, data.sectors]);

  const maxAbsSector = Math.max(
    0.01,
    ...data.sectors.map((item) => Math.abs(item.avg1d ?? 0)),
  );

  const spy = data.indices.find((item) => item.ticker === "SPY");
  const qqq = data.indices.find((item) => item.ticker === "QQQ");

  return (
    <main className="mx-auto min-h-screen max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <header className="panel rounded-3xl px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10 font-display text-lg text-gold">
              M
            </div>
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-gold">
                Terminal de rotación
              </p>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Meridian
              </h1>
              <p className="mt-1 max-w-xl text-sm text-mute">
                Monitoreo sectorial de 43 ETFs con sesgo cíclico, defensivo y
                sensible. Clic en cualquier tarjeta abre Finviz.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="panel flex items-center gap-2 rounded-full px-3 py-2">
              <span className={data.market.open ? "live-dot" : "h-2 w-2 rounded-full bg-white/30"} />
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-white">
                  {data.market.label}
                </p>
                <p className="text-[11px] text-mute">
                  {data.market.session} · {data.market.nyTime}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void (async () => {
                  setLoading(true);
                  try {
                    const response = await fetch("/api/market?force=1", {
                      cache: "no-store",
                    });
                    const payload = (await response.json()) as MarketPayload;
                    setData(payload);
                    setError(null);
                  } catch {
                    setError("No se pudo forzar la recarga");
                  } finally {
                    setLoading(false);
                  }
                })();
              }}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white transition hover:border-sky-300/40 hover:bg-white/10"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {spy ? (
            <IndexCard
              ticker={spy.ticker}
              name={spy.name}
              price={spy.price}
              change1d={spy.change1d}
              change1w={spy.change1w}
              change1m={spy.change1m}
            />
          ) : null}
          {qqq ? (
            <IndexCard
              ticker={qqq.ticker}
              name={qqq.name}
              price={qqq.price}
              change1d={qqq.change1d}
              change1w={qqq.change1w}
              change1m={qqq.change1m}
            />
          ) : null}
        </div>
      </header>

      <section className="mt-5 grid gap-3 lg:grid-cols-4">
        <article className="panel rounded-2xl p-4">
          <div className="flex items-center gap-2 text-mute">
            <Activity className="h-4 w-4 text-sky-300" />
            <p className="text-xs uppercase tracking-[0.16em]">Amplitud</p>
          </div>
          <p className="mt-3 font-mono text-2xl text-white">
            <span className="ticker-up">{data.breadth.up}</span>
            <span className="px-2 text-white/20">/</span>
            <span className="ticker-down">{data.breadth.down}</span>
          </p>
          <p className="mt-1 text-xs text-mute">Avances vs descensos · 1D</p>
        </article>
        <article className="panel rounded-2xl p-4">
          <div className="flex items-center gap-2 text-mute">
            <Sparkles className="h-4 w-4 text-gold" />
            <p className="text-xs uppercase tracking-[0.16em]">Atípicos</p>
          </div>
          <p className="mt-3 font-mono text-2xl text-gold">{data.breadth.anomalous}</p>
          <p className="mt-1 text-xs text-mute">Movimientos ≥ ±2.5% en 1D</p>
        </article>
        <article className="panel rounded-2xl p-4">
          <div className="flex items-center gap-2 text-mute">
            <Zap className="h-4 w-4 text-amber-300" />
            <p className="text-xs uppercase tracking-[0.16em]">Sesgo macro</p>
          </div>
          <p className="mt-3 font-display text-2xl text-white">{data.breadth.riskBias}</p>
          <p className="mt-1 text-xs text-mute">
            Cíclico {formatPct(data.breadth.cyclicalAvg)} · Defensivo{" "}
            {formatPct(data.breadth.defensiveAvg)}
          </p>
        </article>
        <article className="panel rounded-2xl p-4">
          <div className="flex items-center gap-2 text-mute">
            <Shield className="h-4 w-4 text-emerald-300" />
            <p className="text-xs uppercase tracking-[0.16em]">Feed</p>
          </div>
          <p className="mt-3 font-mono text-lg text-white">
            {formatClock(data.updatedAt)}
          </p>
          <p className="mt-1 text-xs text-mute">
            Yahoo Finance vía proxy HTTPS · NY time
          </p>
        </article>
      </section>

      <section className="panel mt-5 rounded-2xl p-4 sm:p-5">
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-white">Rotación sectorial</h2>
            <p className="text-xs text-mute">Promedio 1D del universo filtrable</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-11">
          {data.sectors.map((item) => {
            const width = `${Math.max(8, (Math.abs(item.avg1d ?? 0) / maxAbsSector) * 100)}%`;
            const positive = (item.avg1d ?? 0) >= 0;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setSector(sector === item.key ? "all" : item.key)}
                className={cn(
                  "rounded-xl border px-2.5 py-2 text-left transition",
                  sector === item.key
                    ? "border-sky-300/40 bg-sky-400/10"
                    : "border-white/8 bg-black/20 hover:border-white/20",
                )}
              >
                <p className="truncate text-[11px] text-mute">{item.label}</p>
                <p className={cn("mt-1 font-mono text-sm", tone(item.avg1d))}>
                  {formatPct(item.avg1d)}
                </p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
                  <div
                    className={cn("h-full rounded-full", positive ? "bg-up" : "bg-down")}
                    style={{ width }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel mt-5 rounded-2xl p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1.4fr_repeat(3,minmax(0,0.9fr))_auto] lg:items-end">
          <label className="block">
            <span className="mb-1.5 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-mute">
              <Search className="h-3.5 w-3.5" />
              Buscador
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ticker o nombre"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none ring-sky-400/40 placeholder:text-white/30 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-mute">
              Sector
            </span>
            <select
              value={sector}
              onChange={(event) => setSector(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400/40"
            >
              <option value="all">Todos los sectores</option>
              {SECTORS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-mute">
              Perfil macro
            </span>
            <select
              value={macro}
              onChange={(event) => setMacro(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400/40"
            >
              <option value="all">Todos los perfiles</option>
              {MACROS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-[0.16em] text-mute">
              Ordenar
            </span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-sky-400/40"
            >
              {SORT_OPTIONS.map((item) => (
                <option key={item.key} value={item.key}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setOnlyAnomalous((value) => !value)}
            className={cn(
              "rounded-xl border px-3 py-2.5 text-sm transition",
              onlyAnomalous
                ? "border-gold/40 bg-gold/15 text-gold"
                : "border-white/10 bg-black/30 text-mute hover:text-white",
            )}
          >
            Solo atípicos
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-down">{error}</p> : null}
      </section>

      <section className="mt-6 pb-10">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-mute">
            {filtered.length} de {data.etfs.length} ETFs visibles
          </p>
        </div>

        {grouped ? (
          <div className="space-y-8">
            {grouped.map((group) => (
              <section key={group.key}>
                <div className="mb-3 flex items-end justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ background: group.color }}
                    />
                    <h2 className="font-display text-xl text-white">{group.label}</h2>
                  </div>
                  <p className={cn("font-mono text-sm", tone(group.avg1d))}>
                    Media 1D {formatPct(group.avg1d)}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {group.items.map((etf) => (
                    <EtfCard key={etf.ticker} etf={etf} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {filtered.map((etf) => (
              <EtfCard key={etf.ticker} etf={etf} />
            ))}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="panel mt-4 rounded-2xl p-10 text-center text-mute">
            No hay ETFs para esa combinación de filtros.
          </div>
        ) : null}
      </section>

      <footer className="border-t border-white/8 py-6 text-center text-xs text-mute">
        Meridian no constituye asesoramiento de inversión. Precios y variaciones
        se obtienen de Yahoo Finance a través de un proxy servidor (HTTPS, sin
        CORS en el cliente) con cacheo en PostgreSQL y lotes para respetar
        límites de consumo. Las fichas de mercado se abren en Finviz.
      </footer>
    </main>
  );
}
