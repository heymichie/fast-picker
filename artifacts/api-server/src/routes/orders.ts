import { Router, type IRouter } from "express";
import { db, ordersTable } from "@workspace/db";
import { eq, desc, and, gte, lte } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// Ensure orders table exists
async function ensureTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      branch_code TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'received',
      received_at TIMESTAMP NOT NULL DEFAULT NOW(),
      picking_started_at TIMESTAMP,
      picked_at TIMESTAMP,
      dispatched_at TIMESTAMP,
      assigned_picker_id TEXT,
      assigned_picker_name TEXT,
      item_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
}

// Seed realistic sample data if table is empty
async function seedIfEmpty() {
  const existing = await db.select({ id: ordersTable.id }).from(ordersTable).limit(1);
  if (existing.length > 0) return;

  const now = new Date();
  const today = (offsetMins: number) => new Date(now.getTime() - offsetMins * 60_000);

  const branches = ["JHB001", "CPT002", "DUR003", "PTA004"];
  const pickers = [
    { id: "jpatel", name: "Jay Patel" },
    { id: "smolefe", name: "Sipho Molefe" },
    { id: "avanwyk", name: "Anna van Wyk" },
    { id: "tndlovu", name: "Thabo Ndlovu" },
    { id: "lgomes", name: "Luis Gomes" },
    { id: "nkhumalo", name: "Nomsa Khumalo" },
  ];

  const seeds = [
    // JHB001 — mix of all statuses
    { no: "ORD-20260319-001", branch: "JHB001", status: "dispatched", recv: 480, pStart: 472, pEnd: 450, disp: 440, picker: pickers[0], items: 14 },
    { no: "ORD-20260319-002", branch: "JHB001", status: "dispatched", recv: 460, pStart: 452, pEnd: 432, disp: 425, picker: pickers[1], items: 8 },
    { no: "ORD-20260319-003", branch: "JHB001", status: "dispatched", recv: 420, pStart: 414, pEnd: 394, disp: 385, picker: pickers[0], items: 22 },
    { no: "ORD-20260319-004", branch: "JHB001", status: "picked",     recv: 210, pStart: 203, pEnd: 183, disp: null, picker: pickers[2], items: 11 },
    { no: "ORD-20260319-005", branch: "JHB001", status: "picking",    recv: 95,  pStart: 88,  pEnd: null, disp: null, picker: pickers[1], items: 17 },
    { no: "ORD-20260319-006", branch: "JHB001", status: "received",   recv: 22,  pStart: null, pEnd: null, disp: null, picker: null, items: 6 },
    { no: "ORD-20260319-007", branch: "JHB001", status: "received",   recv: 8,   pStart: null, pEnd: null, disp: null, picker: null, items: 9 },
    // CPT002
    { no: "ORD-20260319-008", branch: "CPT002", status: "dispatched", recv: 500, pStart: 491, pEnd: 466, disp: 455, picker: pickers[3], items: 19 },
    { no: "ORD-20260319-009", branch: "CPT002", status: "dispatched", recv: 390, pStart: 382, pEnd: 360, disp: 351, picker: pickers[4], items: 7 },
    { no: "ORD-20260319-010", branch: "CPT002", status: "picking",    recv: 140, pStart: 133, pEnd: null, disp: null, picker: pickers[3], items: 13 },
    { no: "ORD-20260319-011", branch: "CPT002", status: "received",   recv: 35,  pStart: null, pEnd: null, disp: null, picker: null, items: 4 },
    { no: "ORD-20260319-012", branch: "CPT002", status: "received",   recv: 12,  pStart: null, pEnd: null, disp: null, picker: null, items: 21 },
    // DUR003
    { no: "ORD-20260319-013", branch: "DUR003", status: "dispatched", recv: 520, pStart: 511, pEnd: 488, disp: 478, picker: pickers[5], items: 15 },
    { no: "ORD-20260319-014", branch: "DUR003", status: "picked",     recv: 310, pStart: 302, pEnd: 279, disp: null, picker: pickers[5], items: 10 },
    { no: "ORD-20260319-015", branch: "DUR003", status: "picking",    recv: 75,  pStart: 68,  pEnd: null, disp: null, picker: pickers[2], items: 16 },
    { no: "ORD-20260319-016", branch: "DUR003", status: "received",   recv: 18,  pStart: null, pEnd: null, disp: null, picker: null, items: 5 },
    // PTA004
    { no: "ORD-20260319-017", branch: "PTA004", status: "dispatched", recv: 440, pStart: 432, pEnd: 410, disp: 401, picker: pickers[4], items: 12 },
    { no: "ORD-20260319-018", branch: "PTA004", status: "picked",     recv: 250, pStart: 243, pEnd: 221, disp: null, picker: pickers[0], items: 9 },
    { no: "ORD-20260319-019", branch: "PTA004", status: "picking",    recv: 110, pStart: 103, pEnd: null, disp: null, picker: pickers[1], items: 20 },
    { no: "ORD-20260319-020", branch: "PTA004", status: "received",   recv: 45,  pStart: null, pEnd: null, disp: null, picker: null, items: 3 },
  ];

  for (const s of seeds) {
    await db.insert(ordersTable).values({
      orderNumber: s.no,
      branchCode: s.branch,
      status: s.status,
      receivedAt: today(s.recv),
      pickingStartedAt: s.pStart != null ? today(s.pStart) : null,
      pickedAt: s.pEnd != null ? today(s.pEnd) : null,
      dispatchedAt: s.disp != null ? today(s.disp) : null,
      assignedPickerId: s.picker?.id ?? null,
      assignedPickerName: s.picker?.name ?? null,
      itemCount: s.items,
    }).onConflictDoNothing();
  }
}

let initialised = false;
async function init() {
  if (initialised) return;
  initialised = true;
  await ensureTable();
  await seedIfEmpty();
}

// GET /api/orders — returns orders, optionally filtered by branchCode and/or status
router.get("/", async (req, res) => {
  try {
    await init();
    const { branchCode, status } = req.query;

    const conditions = [];
    if (branchCode && branchCode !== "ALL") {
      conditions.push(eq(ordersTable.branchCode, branchCode as string));
    }
    if (status) {
      conditions.push(eq(ordersTable.status, status as string));
    }

    const rows = await db
      .select()
      .from(ordersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ordersTable.receivedAt));

    res.json(rows);
  } catch (err) {
    console.error("Orders GET error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/orders/branches — distinct branch codes that have orders
router.get("/branches", async (req, res) => {
  try {
    await init();
    const rows = await db
      .selectDistinct({ branchCode: ordersTable.branchCode })
      .from(ordersTable)
      .orderBy(ordersTable.branchCode);
    res.json(rows.map((r) => r.branchCode));
  } catch (err) {
    console.error("Orders branches error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
