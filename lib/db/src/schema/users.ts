import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { organisationsTable } from "./adminSetup";

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull().unique(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisationsTable.id),
  username: text("username").notNull().unique(),
  forenames: text("forenames").notNull(),
  surname: text("surname").notNull(),
  employeeNumber: text("employee_number"),
  email: text("email"),
  rights: text("rights").notNull(),
  branchCode: text("branch_code").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
