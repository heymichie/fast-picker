import { Router, type IRouter } from "express";
import { db, usersTable, organisationsTable } from "@workspace/db";
import { eq, and, gte, lte, isNull } from "drizzle-orm";

const router: IRouter = Router();

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

router.get("/", async (req, res) => {
  try {
    const { branchCode, year, month, types } = req.query;

    if (!branchCode || !year || !month) {
      res.status(400).json({ error: "branchCode, year, and month are required" });
      return;
    }

    const yearNum = parseInt(year as string, 10);
    const monthIndex = MONTH_NAMES.indexOf(month as string);

    if (isNaN(yearNum) || monthIndex === -1) {
      res.status(400).json({ error: "Invalid year or month" });
      return;
    }

    const startDate = new Date(yearNum, monthIndex, 1);
    const endDate = new Date(yearNum, monthIndex + 1, 0, 23, 59, 59, 999);

    const typesList: string[] = Array.isArray(types)
      ? (types as string[])
      : types
        ? [(types as string)]
        : [];

    const allBranches = (branchCode as string) === "ALL";

    const [org] = await db.select().from(organisationsTable).limit(1);
    const orgName = org?.organisationTradingName ?? "Fast Picker";

    const sections: Array<{
      title: string;
      columns: string[];
      rows: string[][];
      note?: string;
    }> = [];

    for (const type of typesList) {
      // ── Store Stats ──────────────────────────────────────────────
      if (type === "Store Stats::Order Picking Duration") {
        sections.push({
          title: "Store Stats — Order Picking Duration",
          columns: ["Branch", "Status"],
          rows: [],
          note: "Order picking data is not yet available. This section will populate once order picking is active.",
        });
      }

      if (type === "Store Stats::Frequency of order picking") {
        sections.push({
          title: "Store Stats — Frequency of Order Picking",
          columns: ["Branch", "Status"],
          rows: [],
          note: "Order picking data is not yet available. This section will populate once order picking is active.",
        });
      }

      // ── Accounts Management — Created ────────────────────────────
      if (type === "Accounts Management::Created") {
        const branchFilter = allBranches
          ? undefined
          : eq(usersTable.branchCode, branchCode as string);

        const users = await db
          .select()
          .from(usersTable)
          .where(
            and(
              branchFilter,
              gte(usersTable.createdAt, startDate),
              lte(usersTable.createdAt, endDate),
            ),
          );

        sections.push({
          title: "Accounts Management — Created",
          columns: ["Username", "Full Name", "Role", "Branch", "Employee No.", "Created By", "Created Date"],
          rows: users.map((u) => [
            u.username,
            `${u.forenames} ${u.surname}`,
            u.rights,
            u.branchCode,
            u.employeeNumber ?? "—",
            u.createdBy ?? "System",
            u.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
          ]),
        });
      }

      // ── Accounts Management — Modified (first login completed) ───
      if (type === "Accounts Management::Modified") {
        const branchFilter = allBranches
          ? undefined
          : eq(usersTable.branchCode, branchCode as string);

        // Accounts that have completed first-login (password changed = modified)
        const users = await db
          .select()
          .from(usersTable)
          .where(
            and(
              branchFilter,
              eq(usersTable.isFirstLogin, false),
            ),
          );

        sections.push({
          title: "Accounts Management — Modified",
          columns: ["Username", "Full Name", "Role", "Branch", "Status"],
          rows: users.map((u) => [
            u.username,
            `${u.forenames} ${u.surname}`,
            u.rights,
            u.branchCode,
            "Password changed",
          ]),
        });
      }

      // ── Accounts Management — Inactive ───────────────────────────
      if (type === "Accounts Management::Inactive") {
        const branchFilter = allBranches
          ? undefined
          : eq(usersTable.branchCode, branchCode as string);

        const users = await db
          .select()
          .from(usersTable)
          .where(
            and(
              branchFilter,
              eq(usersTable.isActive, false),
            ),
          );

        sections.push({
          title: "Accounts Management — Inactive",
          columns: ["Username", "Full Name", "Role", "Branch", "Employee No."],
          rows: users.map((u) => [
            u.username,
            `${u.forenames} ${u.surname}`,
            u.rights,
            u.branchCode,
            u.employeeNumber ?? "—",
          ]),
        });
      }

      // ── Accounts Management — Deleted ─────────────────────────────
      if (type === "Accounts Management::Deleted") {
        sections.push({
          title: "Accounts Management — Deleted",
          columns: ["Status"],
          rows: [],
          note: "Account deletion tracking is not yet enabled. Deleted records are not retained in this version.",
        });
      }
    }

    res.json({
      organisationName: orgName,
      branchCode: branchCode as string,
      period: `${month} ${year}`,
      generatedAt: new Date().toLocaleString("en-GB"),
      sections,
    });
  } catch (error) {
    console.error("Reports error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
