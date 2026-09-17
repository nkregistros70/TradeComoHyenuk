import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPct, formatPrice, formatVolume } from "@/lib/format";
import type { EtfCardData } from "@/lib/types";

const MACRO_STYLES: Record<string, string> = {
  ciclico: "text-amber-200 bg-amber-400/10 border-amber-300/20",
  defensivo: "text-emerald-200 bg-emerald-400/10 border-emerald-300/20",
  sensible: "text-sky-200 bg-sky-400/10 border-sky-300/20",
};

function tone(value: number | null) {
  if (value == null) return "text-mute";
  if (value > 0) return "ticker-up";
  if (value < 0) return "ticker-down";
  return "text-mute";
}

function ChangeChip({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/20 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-[0.16em] text-mute">{label}</p>
      <p className={cn("mt-1 font-mono text-sm font-medium", tone(value))}>
        {formatPct(value)}
      </p>
    </div>
  );
}

export function EtfCard({ etf }: { etf: EtfCardData }) {
  const href = `https://finviz.com/quote.ashx?t=${encodeURIComponent(etf.ticker)}`;
  const glow =
    etf.anomalous && (etf.change1d ?? 0) >= 0
      ? "glow-up"
      : etf.anomalous
        ? "glow-down"
        : "";

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Abrir ficha Finviz de ${etf.ticker}`}
      className={cn(
        "group panel relative block overflow-hidden rounded-2xl p-4 transition duration-300 hover:-translate-y-0.5 hover:border-sky-300/30",
        glow,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-xl font-semibold tracking-wide text-white">
              {etf.ticker}
            </h3>
            {etf.anomalous ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]",
                  (etf.change1d ?? 0) >= 0
                    ? "bg-emerald-400/15 text-emerald-300"
                    : "bg-rose-400/15 text-rose-300",
                )}
              >
                Atípico
              </span>
            ) : null}
          </div>
          <p className="mt-1 max-w-[16rem] text-sm text-mute">{etf.shortName}</p>
        </div>
        <ExternalLink className="mt-1 h-4 w-4 text-white/25 transition group-hover:text-sky-300" />
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.16em] text-mute">
            Precio
          </p>
          <p className="mt-1 font-mono text-2xl font-medium tracking-tight text-white">
            {formatPrice(etf.price)}
          </p>
        </div>
        <p className={cn("font-mono text-lg font-semibold", tone(etf.change1d))}>
          {formatPct(etf.change1d)}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <ChangeChip label="1D" value={etf.change1d} />
        <ChangeChip label="1S" value={etf.change1w} />
        <ChangeChip label="1M" value={etf.change1m} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-mute">
          {etf.sector}
        </span>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1",
            MACRO_STYLES[etf.macroProfile],
          )}
        >
          {etf.theme}
        </span>
        <span className="ml-auto font-mono text-mute">
          Vol {formatVolume(etf.volume)}
        </span>
      </div>
    </a>
  );
}
