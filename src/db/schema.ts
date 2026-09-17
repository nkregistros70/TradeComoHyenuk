import {
  doublePrecision,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const etfs = pgTable("etfs", {
  ticker: varchar("ticker", { length: 16 }).primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  sector: varchar("sector", { length: 64 }).notNull(),
  sectorKey: varchar("sector_key", { length: 32 }).notNull(),
  macroProfile: varchar("macro_profile", { length: 32 }).notNull(),
  theme: text("theme").notNull(),
});

export const etfQuotes = pgTable("etf_quotes", {
  ticker: varchar("ticker", { length: 16 }).primaryKey(),
  price: doublePrecision("price"),
  change1d: doublePrecision("change_1d"),
  change1w: doublePrecision("change_1w"),
  change1m: doublePrecision("change_1m"),
  volume: doublePrecision("volume"),
  previousClose: doublePrecision("previous_close"),
  dayHigh: doublePrecision("day_high"),
  dayLow: doublePrecision("day_low"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  stale: doublePrecision("stale").notNull().default(0),
});
