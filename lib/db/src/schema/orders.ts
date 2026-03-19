import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(),
  branchCode: text("branch_code").notNull(),
  status: text("status").notNull().default("received"),
  receivedAt: timestamp("received_at").notNull().defaultNow(),
  pickingStartedAt: timestamp("picking_started_at"),
  pickedAt: timestamp("picked_at"),
  dispatchedAt: timestamp("dispatched_at"),
  assignedPickerId: text("assigned_picker_id"),
  assignedPickerName: text("assigned_picker_name"),
  itemCount: integer("item_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Order = typeof ordersTable.$inferSelect;
export type InsertOrder = typeof ordersTable.$inferInsert;
