import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type WorkingDays = {
  sat: boolean;
  sun: boolean;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
};

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    branch: text("branch").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("user"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("users_name_unique").on(table.name)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("sessions_token_hash_unique").on(table.tokenHash)],
);

export const monthSettings = pgTable(
  "month_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    yearMonth: text("year_month").notNull(),
    fullCommission: doublePrecision("full_commission").notNull().default(6000),
    allowCommissionOver100: boolean("allow_commission_over_100").notNull().default(false),
    workingDays: jsonb("working_days").$type<WorkingDays>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("month_settings_user_month").on(table.userId, table.yearMonth)],
);

export const kpiSettings = pgTable(
  "kpi_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monthSettingsId: uuid("month_settings_id")
      .notNull()
      .references(() => monthSettings.id, { onDelete: "cascade" }),
    kpiKey: text("kpi_key").notNull(),
    target: doublePrecision("target").notNull(),
    weight: doublePrecision("weight").notNull(),
    unitAr: text("unit_ar").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (table) => [uniqueIndex("kpi_settings_month_key").on(table.monthSettingsId, table.kpiKey)],
);

export const holidays = pgTable(
  "holidays",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    monthSettingsId: uuid("month_settings_id")
      .notNull()
      .references(() => monthSettings.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"),
  },
  (table) => [uniqueIndex("holidays_month_date").on(table.monthSettingsId, table.date)],
);

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kpiKey: text("kpi_key").notNull(),
    quantity: doublePrecision("quantity").notNull(),
    entryDate: date("entry_date", { mode: "string" }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // كل استعلامات اللوحة والسجل بتفلتر بالمستخدم + مدى التاريخ، فالـ index ده هو الأساسي.
  (table) => [index("entries_user_date_idx").on(table.userId, table.entryDate)],
);

export const articles = pgTable("articles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
