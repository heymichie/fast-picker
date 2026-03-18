import { pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const organisationsTable = pgTable("organisations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationTradingName: text("organisation_trading_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const administratorsTable = pgTable("administrators", {
  id: uuid("id").primaryKey().defaultRandom(),
  organisationId: uuid("organisation_id")
    .notNull()
    .references(() => organisationsTable.id),
  forenames: text("forenames").notNull(),
  surname: text("surname").notNull(),
  designation: text("designation").notNull(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  productCode: text("product_code").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertOrganisationSchema = createInsertSchema(organisationsTable).omit({ id: true, createdAt: true });
export type InsertOrganisation = z.infer<typeof insertOrganisationSchema>;
export type Organisation = typeof organisationsTable.$inferSelect;

export const insertAdministratorSchema = createInsertSchema(administratorsTable).omit({ id: true, createdAt: true });
export type InsertAdministrator = z.infer<typeof insertAdministratorSchema>;
export type Administrator = typeof administratorsTable.$inferSelect;
