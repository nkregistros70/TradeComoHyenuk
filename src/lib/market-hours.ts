import type { MarketStatus } from "./types";

function partValue(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
) {
  return parts.find((part) => part.type === type)?.value ?? "";
}

export function getMarketStatus(date = new Date()): MarketStatus {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const weekday = partValue(parts, "weekday");
  const hour = Number(partValue(parts, "hour"));
  const minute = Number(partValue(parts, "minute"));
  const minutes = hour * 60 + minute;
  const weekend = weekday === "Sat" || weekday === "Sun";
  const openMinutes = 9 * 60 + 30;
  const closeMinutes = 16 * 60;
  const open = !weekend && minutes >= openMinutes && minutes < closeMinutes;

  let session = "Cerrada";
  if (!weekend && minutes >= 4 * 60 && minutes < openMinutes) session = "Pre-market";
  else if (open) session = "Regular";
  else if (!weekend && minutes >= closeMinutes && minutes < 20 * 60) {
    session = "After-hours";
  }

  const nyTime = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/New_York",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);

  return {
    open,
    label: open ? "Mercado abierto" : "Mercado cerrado",
    timezone: "America/New_York",
    session,
    nyTime: `${nyTime} ET`,
  };
}

export function quoteTtlMs(open: boolean) {
  return open ? 20_000 : 120_000;
}
