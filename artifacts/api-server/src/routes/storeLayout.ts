import { Router, type IRouter } from "express";
import { db, storeLayoutsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router: IRouter = Router();

// List all floor plan names for a given branch
router.get("/floors", async (req, res) => {
  try {
    const { branchCode } = req.query;
    if (!branchCode) {
      res.status(400).json({ error: "branchCode is required" });
      return;
    }
    const rows = await db
      .select({ floorName: storeLayoutsTable.floorName })
      .from(storeLayoutsTable)
      .where(eq(storeLayoutsTable.branchCode, branchCode as string));

    res.json(rows.map((r) => r.floorName));
  } catch (err) {
    console.error("Store layout /floors error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fetch a specific floor plan
router.get("/", async (req, res) => {
  try {
    const { branchCode, floorName } = req.query;
    if (!branchCode || !floorName) {
      res.status(400).json({ error: "branchCode and floorName are required" });
      return;
    }
    const [layout] = await db
      .select()
      .from(storeLayoutsTable)
      .where(
        and(
          eq(storeLayoutsTable.branchCode, branchCode as string),
          eq(storeLayoutsTable.floorName, floorName as string),
        ),
      );

    res.json({
      floorPlanImage: layout?.floorPlanImage ?? null,
      railsData: layout?.railsData ? JSON.parse(layout.railsData) : [],
    });
  } catch (err) {
    console.error("Store layout GET error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Return all unique department names found across all saved rail data
router.get("/departments", async (_req, res) => {
  try {
    const layouts = await db
      .select({ railsData: storeLayoutsTable.railsData })
      .from(storeLayoutsTable);

    const depts = new Set<string>();

    for (const layout of layouts) {
      if (!layout.railsData) continue;
      const rails = JSON.parse(layout.railsData) as Array<{
        department?: string;
        products?: Array<{ dept?: string }>;
      }>;
      for (const rail of rails) {
        if (rail.products && rail.products.length > 0) {
          for (const p of rail.products) {
            if (p.dept) {
              p.dept.split(" / ").forEach((d) => { const t = d.trim(); if (t) depts.add(t); });
            }
          }
        } else if (rail.department) {
          rail.department.split(" / ").forEach((d) => { const t = d.trim(); if (t) depts.add(t); });
        }
      }
    }

    res.json([...depts].sort());
  } catch (err) {
    console.error("Store layout /departments error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Save / update a floor plan
router.post("/", async (req, res) => {
  try {
    const { branchCode, floorName, floorPlanImage, railsData } = req.body;
    if (!branchCode || !floorName) {
      res.status(400).json({ error: "branchCode and floorName are required" });
      return;
    }

    await db
      .insert(storeLayoutsTable)
      .values({
        branchCode,
        floorName,
        floorPlanImage: floorPlanImage ?? null,
        railsData: railsData !== undefined ? JSON.stringify(railsData) : null,
      })
      .onConflictDoUpdate({
        target: [storeLayoutsTable.branchCode, storeLayoutsTable.floorName],
        set: {
          floorPlanImage: floorPlanImage ?? null,
          railsData: railsData !== undefined ? JSON.stringify(railsData) : null,
          updatedAt: new Date(),
        },
      });

    res.json({ ok: true });
  } catch (err) {
    console.error("Store layout POST error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
