import { pgTable, jsonb, timestamp, uuid } from "drizzle-orm/pg-core";

export const userRightsTable = pgTable("user_rights", {
  id: uuid("id").primaryKey().defaultRandom(),
  permissions: jsonb("permissions").notNull().$type<Record<string, string[]>>(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type UserRights = typeof userRightsTable.$inferSelect;
