import { Router, type IRouter } from "express";
import { db, ordersTable, usersTable } from "@workspace/db";
import { eq, desc, and, isNull, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

// ── Product templates ─────────────────────────────────────────────────
interface ProductLine {
  railId: string;
  productCode: string;
  dept: string;
  category: string;
  colour: string;
  description: string;
  size: string;
}

// Size sets keyed by category code
const SIZE_SETS: Record<string, string[]> = {
  // Ladies garments
  TOP: ["XS", "S", "M", "L", "XL", "XXL"],
  JNS: ["26", "28", "30", "32", "34", "36"],
  DRS: ["6", "8", "10", "12", "14", "16"],
  SKT: ["6", "8", "10", "12", "14", "16"],
  JCK: ["XS", "S", "M", "L", "XL", "XXL"],
  // Mens garments
  SHT: ["S", "M", "L", "XL", "XXL", "3XL"],
  TRS: ["28", "30", "32", "34", "36", "38"],
  SUB: ["36", "38", "40", "42", "44", "46"],
  CAS: ["XS", "S", "M", "L", "XL", "XXL"],
  // Default
  GEN: ["S", "M", "L", "XL"],
};

const DEPT_CFG: Record<string, {
  categories: { code: string; name: string }[];
  colours: { code: string; name: string }[];
  descriptions: string[];
}> = {
  "02": {
    categories: [
      { code: "TOP", name: "Tops" },
      { code: "JNS", name: "Jeans" },
      { code: "DRS", name: "Dresses" },
      { code: "SKT", name: "Skirts" },
      { code: "JCK", name: "Jackets" },
    ],
    colours: [
      { code: "BLK", name: "Black" }, { code: "WHT", name: "White" },
      { code: "RED", name: "Red" },   { code: "BLU", name: "Blue" },
      { code: "GRN", name: "Green" }, { code: "PNK", name: "Pink" },
    ],
    descriptions: [
      "Ladies Printed Crop Top", "Ladies High-Waist Skinny Jeans",
      "Floral Wrap Dress", "Pleated Mini Skirt", "Oversized Blazer",
    ],
  },
  "12": {
    categories: [
      { code: "SHT", name: "Shirts" },
      { code: "TRS", name: "Trousers" },
      { code: "JCK", name: "Jackets" },
      { code: "SUB", name: "Suits" },
      { code: "CAS", name: "Casual" },
    ],
    colours: [
      { code: "NVY", name: "Navy" }, { code: "GRY", name: "Grey" },
      { code: "BLK", name: "Black" }, { code: "BRN", name: "Brown" },
      { code: "WHT", name: "White" },
    ],
    descriptions: [
      "Formal Oxford Shirt", "Slim Fit Chino Trousers",
      "Winter Quilted Jacket", "3-Piece Business Suit", "Casual Polo Shirt",
    ],
  },
};
const DEFAULT_CFG = {
  categories: [{ code: "GEN", name: "General" }],
  colours: [{ code: "AST", name: "Assorted" }],
  descriptions: ["General Merchandise"],
};

function generateProducts(deptCounts: Record<string, number>): ProductLine[] {
  const lines: ProductLine[] = [];
  for (const [dept, count] of Object.entries(deptCounts)) {
    const cfg = DEPT_CFG[dept] ?? DEFAULT_CFG;
    const deptPad = dept.padStart(3, "0");
    for (let i = 0; i < count; i++) {
      const cat = cfg.categories[i % cfg.categories.length];
      const col = cfg.colours[Math.floor(i / cfg.categories.length) % cfg.colours.length];
      const seq = String(i + 1).padStart(3, "0");
      const railId = `${deptPad}-${cat.code}-${col.code}-${seq}`;
      const sizeSet = SIZE_SETS[cat.code] ?? SIZE_SETS["GEN"];
      const size = sizeSet[i % sizeSet.length];
      lines.push({
        railId,
        productCode: `${dept.toUpperCase()}${cat.code}${seq}`,
        dept: deptPad,
        category: cat.name,
        colour: col.name,
        description: cfg.descriptions[i % cfg.descriptions.length],
        size,
      });
    }
  }
  return lines;
}

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
      products TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )
  `);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS department_counts TEXT`);
  await db.execute(sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS products TEXT`);
}

// ── Auto-assignment ───────────────────────────────────────────────────
// Returns all active Order Pickers eligible for a given branch+dept.
async function getEligiblePickers(orderBranch: string, topDept: string) {
  return db
    .select({
      username: usersTable.username,
      forenames: usersTable.forenames,
      surname: usersTable.surname,
      branchCode: usersTable.branchCode,
      department: usersTable.department,
    })
    .from(usersTable)
    .where(and(eq(usersTable.rights, "Order Picker"), eq(usersTable.isActive, true)));
}

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

  const allPickers = await getEligiblePickers(orderBranch, topDept);

  // Filter to branch+dept qualified candidates
  const candidates = allPickers.filter(
    (p) =>
      (p.branchCode === orderBranch || p.branchCode === "ALL") &&
      (p.department === topDept || p.department === "ALL"),
  );
  if (candidates.length === 0) return { pickerId: null, pickerName: null };

  // Priority tiers (best match first)
  const tiers = [
    (p: typeof candidates[0]) => p.branchCode === orderBranch && p.department === topDept,
    (p: typeof candidates[0]) => p.branchCode === orderBranch && p.department === "ALL",
    (p: typeof candidates[0]) => p.branchCode === "ALL" && p.department === topDept,
    (p: typeof candidates[0]) => p.branchCode === "ALL" && p.department === "ALL",
  ];

  let primary: typeof candidates[0] | undefined;
  for (const tier of tiers) {
    primary = candidates.find(tier);
    if (primary) break;
  }
  if (!primary) return { pickerId: null, pickerName: null };

  // ── Auto-rebalance: if primary already has >2 active orders, ────────
  // ── prefer an unoccupied picker who also qualifies            ────────
  const activeRows = await db
    .select({ pickerId: ordersTable.assignedPickerId, cnt: sql<number>`count(*)::int` })
    .from(ordersTable)
    .where(
      and(
        inArray(ordersTable.status, ["received", "picking"]),
        sql`assigned_picker_id IS NOT NULL`,
      ),
    )
    .groupBy(ordersTable.assignedPickerId);
  const activeCounts = new Map(activeRows.map((r) => [r.pickerId, Number(r.cnt)]));

  const primaryActive = activeCounts.get(primary.username) ?? 0;
  if (primaryActive > 2) {
    // Find any qualified candidate with zero active orders
    const unoccupied = candidates.find(
      (c) => c.username !== primary!.username && (activeCounts.get(c.username) ?? 0) === 0,
    );
    if (unoccupied) {
      return { pickerId: unoccupied.username, pickerName: `${unoccupied.forenames} ${unoccupied.surname}` };
    }
  }

  return { pickerId: primary.username, pickerName: `${primary.forenames} ${primary.surname}` };
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
    // Branch 501
    { no: "ORD-20260319-021", branch: "501",    status: "dispatched", recv: 360, pStart: 352, pEnd: 330, disp: 320, items: 12 },
    { no: "ORD-20260319-022", branch: "501",    status: "dispatched", recv: 300, pStart: 291, pEnd: 270, disp: 260, items: 15 },
    { no: "ORD-20260319-023", branch: "501",    status: "picked",     recv: 180, pStart: 172, pEnd: 150, disp: null, items: 19 },
    { no: "ORD-20260319-024", branch: "501",    status: "picking",    recv: 60,  pStart: 52,  pEnd: null, disp: null, items: 8 },
    { no: "ORD-20260319-025", branch: "501",    status: "received",   recv: 15,  pStart: null, pEnd: null, disp: null, items: 9 },
  ];

  for (const s of seeds) {
    const deptCounts = SEED_DEPT_COUNTS[s.no] ?? {};
    const products = generateProducts(deptCounts);
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
      products: JSON.stringify(products),
    }).onConflictDoNothing();
  }
}

// Backfill dept_counts + products for old rows
async function migrateExisting() {
  const rows = await db
    .select({ id: ordersTable.id, orderNumber: ordersTable.orderNumber, departmentCounts: ordersTable.departmentCounts })
    .from(ordersTable);

  for (const row of rows) {
    const counts = row.departmentCounts
      ? JSON.parse(row.departmentCounts) as Record<string, number>
      : (SEED_DEPT_COUNTS[row.orderNumber] ?? { "02": 1 });

    const patch: Record<string, string> = {};
    if (!row.departmentCounts) patch.department_counts = JSON.stringify(counts);
    patch.products = JSON.stringify(generateProducts(counts));

    await db.execute(
      sql`UPDATE orders SET
        department_counts = COALESCE(department_counts, ${JSON.stringify(counts)}),
        products = ${patch.products}
        WHERE id = ${row.id}`
    );
  }
}

// Re-assign unassigned orders (or all if onlyUnassigned=false)
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
  await migrateExisting();
  await runAutoAssign(true);
}

// ── Routes (literal paths before param routes) ────────────────────────

// GET /api/orders/branches
router.get("/branches", async (_req, res) => {
  try {
    await init();
    const rows = await db.selectDistinct({ branchCode: ordersTable.branchCode }).from(ordersTable).orderBy(ordersTable.branchCode);
    res.json(rows.map((r) => r.branchCode));
  } catch (err) {
    console.error("Orders branches error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/orders/pickers?branchCode=X — active Order Pickers for a branch
router.get("/pickers", async (req, res) => {
  try {
    await init();
    const { branchCode } = req.query;
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

    const filtered = branchCode && branchCode !== "ALL"
      ? pickers.filter((p) => p.branchCode === branchCode || p.branchCode === "ALL")
      : pickers;

    res.json(filtered.map((p) => ({
      username: p.username,
      fullName: `${p.forenames} ${p.surname}`,
      branchCode: p.branchCode,
      department: p.department,
    })));
  } catch (err) {
    console.error("Orders pickers error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/orders — filterable by branchCode, status, pickerId
router.get("/", async (req, res) => {
  try {
    await init();
    const { branchCode, status, pickerId } = req.query;
    const conditions = [];
    if (branchCode && branchCode !== "ALL") conditions.push(eq(ordersTable.branchCode, branchCode as string));
    if (status) conditions.push(eq(ordersTable.status, status as string));
    if (pickerId) conditions.push(eq(ordersTable.assignedPickerId, pickerId as string));
    const rows = await db.select().from(ordersTable)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(ordersTable.receivedAt));
    res.json(rows);
  } catch (err) {
    console.error("Orders GET error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/orders/:orderNumber — full detail including parsed products
router.get("/:orderNumber", async (req, res) => {
  try {
    await init();
    const { orderNumber } = req.params;
    const rows = await db.select().from(ordersTable).where(eq(ordersTable.orderNumber, orderNumber)).limit(1);
    if (rows.length === 0) return res.status(404).json({ error: "Not found" });
    const row = rows[0];
    let products: ProductLine[] = [];
    try { if (row.products) products = JSON.parse(row.products); } catch {}
    res.json({ ...row, products });
  } catch (err) {
    console.error("Orders detail error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/orders/assign — re-run auto-assignment for unassigned orders
router.post("/assign", async (_req, res) => {
  try {
    await init();
    await runAutoAssign(true);
    res.json({ ok: true });
  } catch (err) {
    console.error("Orders assign error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/orders/:orderNumber/reassign — manual reassignment by manager
router.post("/:orderNumber/reassign", async (req, res) => {
  try {
    await init();
    const { orderNumber } = req.params;
    const { pickerId, pickerName } = req.body as { pickerId: string; pickerName: string };
    if (!pickerId || !pickerName) return res.status(400).json({ error: "pickerId and pickerName required" });
    await db.update(ordersTable)
      .set({ assignedPickerId: pickerId, assignedPickerName: pickerName })
      .where(eq(ordersTable.orderNumber, orderNumber));
    res.json({ ok: true });
  } catch (err) {
    console.error("Orders reassign error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// PATCH /api/orders/:orderNumber/status
router.patch("/:orderNumber/status", async (req, res) => {
  try {
    await init();
    const { orderNumber } = req.params;
    const { status } = req.body as { status: string };
    const validStatuses = ["received", "picking", "picked", "dispatched"];
    if (!validStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });
    const now = new Date();
    type OrderPatch = { status: string; pickingStartedAt?: Date; pickedAt?: Date; dispatchedAt?: Date };
    const patch: OrderPatch = { status };
    if (status === "picking")    patch.pickingStartedAt = now;
    if (status === "picked")     patch.pickedAt = now;
    if (status === "dispatched") patch.dispatchedAt = now;
    await db.update(ordersTable).set(patch).where(eq(ordersTable.orderNumber, orderNumber));
    res.json({ ok: true });
  } catch (err) {
    console.error("Orders status patch error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
