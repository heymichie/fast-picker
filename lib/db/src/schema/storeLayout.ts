import { pgTable, text, timestamp, uuid, uniqueIndex } from "drizzle-orm/pg-core";

export const storeLayoutsTable = pgTable(
  "store_layouts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    branchCode: text("branch_code").notNull(),
    floorName: text("floor_name").notNull().default("Ground Floor"),
    floorPlanImage: text("floor_plan_image"),
    railsData: text("rails_data"),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("store_layouts_branch_floor_unique").on(t.branchCode, t.floorName),
  ],
);

export type StoreLayout = typeof storeLayoutsTable.$inferSelect;
export type InsertStoreLayout = typeof storeLayoutsTable.$inferInsert;
