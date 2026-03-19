import { Router, type IRouter } from "express";
import { db, ordersTable, usersTable } from "@workspace/db";
import { eq, desc, and, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Schema migration ──────────────────────────────────────────────────
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
      department_counts TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  // Add column if the table existed before this field was introduced
  await db.execute(sql`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS department_counts TEXT
  `);
}

// ── Auto-assignment ───────────────────────────────────────────────────
// Given a branch and dept-count map, find the best Order Picker to assign.
// Priority: exact branch + exact dept > exact branch + ALL dept
//           > ALL branch + exact dept > ALL branch + ALL dept
async function pickAssignee(
  orderBranch: string,
  deptCounts: Record<string, number>,
): Promise<{ pickerId: string | null; pickerName: string | null }> {
  // Find dominant department
  let topDept = "";
  let maxCount = 0;
  for (const [dept, count] of Object.entries(deptCounts)) {
    if (count > maxCount) { maxCount = count; topDept = dept; }
  }
  if (!topDept) return { pickerId: null, pickerName: null };

  // Fetch all active Order Pickers
  const pickers = await db
    .select({
      username: usersTable.username,
      forenames: usersTable.forenames,
      surname: usersTable.surname,
      branchCode: usersTable.branchCode,
      department: usersTable.department,
    })
    .from(usersTable)
    .where(and(eq(usersTable.rights, "Order Picker"), eq(usersTable.isActive, true)));

  // Filter to candidates that can handle this branch + dept
  const candidates = pickers.filter(
    (p) =>
      (p.branchCode === orderBranch || p.branchCode === "ALL") &&
      (p.department === topDept || p.department === "ALL"),
  );
  if (candidates.length === 0) return { pickerId: null, pickerName: null };

  // Apply priority tiers
  const tiers = [
    (p: typeof candidates[0]) => p.branchCode === orderBranch && p.department === topDept,
    (p: typeof candidates[0]) => p.branchCode === orderBranch && p.department === "ALL",
    (p: typeof candidates[0]) => p.branchCode === "ALL" && p.department === topDept,
    (p: typeof candidates[0]) => p.branchCode === "ALL" && p.department === "ALL",
  ];
  for (const match of tiers) {
    const found = candidates.find(match);
    if (found) {
      return {
        pickerId: found.username,
        pickerName: `${found.forenames} ${found.surname}`,
      };
    }
  }
  return { pickerId: null, pickerName: null };
}

// ── Seed data ─────────────────────────────────────────────────────────
const SEED_DEPT_COUNTS: Record<string, Record<string, number>> = {
  // JHB001
  "ORD-20260319-001": { "02": 10, "12": 4 },
  "ORD-20260319-002": { "12": 6,  "02": 2 },
  "ORD-20260319-003": { "02": 15, "12": 7 },
  "ORD-20260319-004": { "12": 8,  "02": 3 },
  "ORD-20260319-005": { "02": 12, "12": 5 },
  "ORD-20260319-006": { "12": 4,  "02": 2 },
  "ORD-20260319-007": { "02": 7,  "12": 2 },
  // CPT002
  "ORD-20260319-008": { "12": 12, "02": 7 },
  "ORD-20260319-009": { "02": 5,  "12": 2 },
  "ORD-20260319-010": { "12": 9,  "02": 4 },
  "ORD-20260319-011": { "02": 3,  "12": 1 },
  "ORD-20260319-012": { "12": 15, "02": 6 },
  // DUR003
  "ORD-20260319-013": { "02": 10, "12": 5 },
  "ORD-20260319-014": { "12": 7,  "02": 3 },
  "ORD-20260319-015": { "02": 12, "12": 4 },
  "ORD-20260319-016": { "12": 4,  "02": 1 },
  // PTA004
  "ORD-20260319-017": { "12": 8,  "02": 4 },
  "ORD-20260319-018": { "02": 7,  "12": 2 },
  "ORD-20260319-019": { "12": 14, "02": 6 },
  "ORD-20260319-020": { "02": 2,  "12": 1 },
  // Branch 501 — XavierB (dept 02) + PaulN (dept 12, ALL branches)
  "ORD-20260319-021": { "02": 9,  "12": 3 },
  "ORD-20260319-022": { "12": 11, "02": 4 },
  "ORD-20260319-023": { "02": 14, "12": 5 },
  "ORD-20260319-024": { "12": 6,  "02": 2 },
  "ORD-20260319-025": { "02": 8,  "12": 1 },
};

async function seedIfEmpty() {
  const existing = await db.select({ id: ordersTable.id }).from(ordersTable).limit(1);
  if (existing.length > 0) return;

  const now = new Date();
  const ago = (mins: number) => new Date(now.getTime() - mins * 60_000);

  const seeds = [
    // JHB001
    { no: "ORD-20260319-001", branch: "JHB001", status: "dispatched", recv: 480, pStart: 472, pEnd: 450, disp: 440, items: 14 },
    { no: "ORD-20260319-002", branch: "JHB001", status: "dispatched", recv: 460, pStart: 452, pEnd: 432, disp: 425, items: 8 },
    { no: "ORD-20260319-003", branch: "JHB001", status: "dispatched", recv: 420, pStart: 414, pEnd: 394, disp: 385, items: 22 },
    { no: "ORD-20260319-004", branch: "JHB001", status: "picked",     recv: 210, pStart: 203, pEnd: 183, disp: null, items: 11 },
    { no: "ORD-20260319-005", branch: "JHB001", status: "picking",    recv: 95,  pStart: 88,  pEnd: null, disp: null, items: 17 },
    { no: "ORD-20260319-006", branch: "JHB001", status: "received",   recv: 22,  pStart: null, pEnd: null, disp: null, items: 6 },
    { no: "ORD-20260319-007", branch: "JHB001", status: "received",   recv: 8,   pStart: null, pEnd: null, disp: null, items: 9 },
    // CPT002
    { no: "ORD-20260319-008", branch: "CPT002", status: "dispatched", recv: 500, pStart: 491, pEnd: 466, disp: 455, items: 19 },
    { no: "ORD-20260319-009", branch: "CPT002", status: "dispatched", recv: 390, pStart: 382, pEnd: 360, disp: 351, items: 7 },
    { no: "ORD-20260319-010", branch: "CPT002", status: "picking",    recv: 140, pStart: 133, pEnd: null, disp: null, items: 13 },
    { no: "ORD-20260319-011", branch: "CPT002", status: "received",   recv: 35,  pStart: null, pEnd: null, disp: null, items: 4 },
    { no: "ORD-20260319-012", branch: "CPT002", status: "received",   recv: 12,  pStart: null, pEnd: null, disp: null, items: 21 },
    // DUR003
    { no: "ORD-20260319-013", branch: "DUR003", status: "dispatched", recv: 520, pStart: 511, pEnd: 488, disp: 478, items: 15 },
    { no: "ORD-20260319-014", branch: "DUR003", status: "picked",     recv: 310, pStart: 302, pEnd: 279, disp: null, items: 10 },
    { no: "ORD-20260319-015", branch: "DUR003", status: "picking",    recv: 75,  pStart: 68,  pEnd: null, disp: null, items: 16 },
    { no: "ORD-20260319-016", branch: "DUR003", status: "received",   recv: 18,  pStart: null, pEnd: null, disp: null, items: 5 },
    // PTA004
    { no: "ORD-20260319-017", branch: "PTA004", status: "dispatched", recv: 440, pStart: 432, pEnd: 410, disp: 401, items: 12 },
    { no: "ORD-20260319-018", branch: "PTA004", status: "picked",     recv: 250, pStart: 243, pEnd: 221, disp: null, items: 9 },
    { no: "ORD-20260319-019", branch: "PTA004", status: "picking",    recv: 110, pStart: 103, pEnd: null, disp: null, items: 20 },
    { no: "ORD-20260319-020", branch: "PTA004", status: "received",   recv: 45,  pStart: null, pEnd: null, disp: null, items: 3 },
    // Branch 501 — for XavierB (dept 02) and PaulN (dept 12, ALL branches)
    { no: "ORD-20260319-021", branch: "501",    status: "dispatched", recv: 360, pStart: 352, pEnd: 330, disp: 320, items: 12 },
    { no: "ORD-20260319-022", branch: "501",    status: "dispatched", recv: 300, pStart: 291, pEnd: 270, disp: 260, items: 15 },
    { no: "ORD-20260319-023", branch: "501",    status: "picked",     recv: 180, pStart: 172, pEnd: 150, disp: null, items: 19 },
    { no: "ORD-20260319-024", branch: "501",    status: "picking",    recv: 60,  pStart: 52,  pEnd: null, disp: null, items: 8 },
    { no: "ORD-20260319-025", branch: "501",    status: "received",   recv: 15,  pStart: null, pEnd: null, disp: null, items: 9 },
  ];

  for (const s of seeds) {
    const deptCounts = SEED_DEPT_COUNTS[s.no] ?? {};
    await db.insert(ordersTable).values({
      orderNumber: s.no,
      branchCode: s.branch,
      status: s.status,
      receivedAt: ago(s.recv),
      pickingStartedAt: s.pStart != null ? ago(s.pStart) : null,
      pickedAt: s.pEnd != null ? ago(s.pEnd) : null,
      dispatchedAt: s.disp != null ? ago(s.disp) : null,
      itemCount: s.items,
      departmentCounts: JSON.stringify(deptCounts),
    }).onConflictDoNothing();
  }
}

// Patch existing orders that have no department_counts (e.g. from old seed)
async function migrateExistingDeptCounts() {
  const rows = await db
    .select({ id: ordersTable.id, orderNumber: ordersTable.orderNumber })
    .from(ordersTable)
    .where(isNull(ordersTable.departmentCounts));

  for (const row of rows) {
    const counts = SEED_DEPT_COUNTS[row.orderNumber] ?? { "02": 1 };
    await db
      .update(ordersTable)
      .set({ departmentCounts: JSON.stringify(counts) })
      .where(eq(ordersTable.id, row.id));
  }
}

// Re-assign all orders (or only unassigned ones) based on department_counts
async function runAutoAssign(onlyUnassigned = false) {
  const rows = await db
    .select({
      id: ordersTable.id,
      branchCode: ordersTable.branchCode,
      departmentCounts: ordersTable.departmentCounts,
      assignedPickerId: ordersTable.assignedPickerId,
    })
    .from(ordersTable);

  for (const row of rows) {
    if (onlyUnassigned && row.assignedPickerId) continue;
    if (!row.departmentCounts) continue;
    let counts: Record<string, number> = {};
    try { counts = JSON.parse(row.departmentCounts); } catch { continue; }
    const { pickerId, pickerName } = await pickAssignee(row.branchCode, counts);
    if (pickerId) {
      await db
        .update(ordersTable)
        .set({ assignedPickerId: pickerId, assignedPickerName: pickerName })
        .where(eq(ordersTable.id, row.id));
    }
  }
}

// ── Init ──────────────────────────────────────────────────────────────
let initialised = false;
async function init() {
  if (initialised) return;
  initialised = true;
  await ensureTable();
  await seedIfEmpty();
  await migrateExistingDeptCounts();
  await runAutoAssign(true); // only assign orders that don't yet have a picker
}

// ── Routes ────────────────────────────────────────────────────────────

// GET /api/orders — filterable by branchCode, status, pickerId
router.get("/", async (req, res) => {
  try {
    await init();
    const { branchCode, status, pickerId } = req.query;

    const conditions = [];
    if (branchCode && branchCode !== "ALL") {
      conditions.push(eq(ordersTable.branchCode, branchCode as string));
    }
    if (status) {
      conditions.push(eq(ordersTable.status, status as string));
    }
    if (pickerId) {
      conditions.push(eq(ordersTable.assignedPickerId, pickerId as string));
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

// GET /api/orders/branches — distinct branch codes
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

// POST /api/orders/assign — re-run assignment for all unassigned orders
router.post("/assign", async (req, res) => {
  try {
    await init();
    await runAutoAssign(true);
    res.json({ ok: true });
  } catch (err) {
    console.error("Orders assign error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/orders/:orderNumber/status — advance order status
router.patch("/:orderNumber/status", async (req, res) => {
  try {
    await init();
    const { orderNumber } = req.params;
    const { status } = req.body as { status: string };

    const validStatuses = ["received", "picking", "picked", "dispatched"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const now = new Date();
    type OrderPatch = {
      status: string;
      pickingStartedAt?: Date;
      pickedAt?: Date;
      dispatchedAt?: Date;
    };
    const patch: OrderPatch = { status };
    if (status === "picking")   patch.pickingStartedAt = now;
    if (status === "picked")    patch.pickedAt = now;
    if (status === "dispatched") patch.dispatchedAt = now;

    await db
      .update(ordersTable)
      .set(patch)
      .where(eq(ordersTable.orderNumber, orderNumber));

    res.json({ ok: true });
  } catch (err) {
    console.error("Orders status patch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
