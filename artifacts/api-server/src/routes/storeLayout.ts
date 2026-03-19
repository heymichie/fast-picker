import { Router, type IRouter } from "express";
import { db, storeLayoutsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router: IRouter = Router();

router.get("/", async (req, res) => {
  try {
    const { branchCode } = req.query;
    if (!branchCode) {
      res.status(400).json({ error: "branchCode is required" });
      return;
    }
    const [layout] = await db
      .select()
      .from(storeLayoutsTable)
      .where(eq(storeLayoutsTable.branchCode, branchCode as string));

    res.json({
      floorPlanImage: layout?.floorPlanImage ?? null,
      railsData: layout?.railsData ? JSON.parse(layout.railsData) : [],
    });
  } catch (err) {
    console.error("Store layout GET error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { branchCode, floorPlanImage, railsData } = req.body;
    if (!branchCode) {
      res.status(400).json({ error: "branchCode is required" });
      return;
    }

    await db
      .insert(storeLayoutsTable)
      .values({
        branchCode,
        floorPlanImage: floorPlanImage ?? null,
        railsData: railsData !== undefined ? JSON.stringify(railsData) : null,
      })
      .onConflictDoUpdate({
        target: storeLayoutsTable.branchCode,
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
