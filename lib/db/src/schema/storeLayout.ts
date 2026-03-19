import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const storeLayoutsTable = pgTable("store_layouts", {
  id: uuid("id").primaryKey().defaultRandom(),
  branchCode: text("branch_code").notNull().unique(),
  floorPlanImage: text("floor_plan_image"),
  railsData: text("rails_data"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type StoreLayout = typeof storeLayoutsTable.$inferSelect;
export type InsertStoreLayout = typeof storeLayoutsTable.$inferInsert;
