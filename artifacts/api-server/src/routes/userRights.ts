import { Router, type IRouter } from "express";
import { db, userRightsTable } from "@workspace/db";

const router: IRouter = Router();

const ROLES = ["Administrator", "Store Manager", "Store Supervisor", "Merchandiser", "Order Picker"] as const;
const PERMISSIONS = [
  "Create New Accounts",
  "Manage Accounts",
  "Assign Account Rights",
  "Setup branch layout",
  "Create Order picker accounts",
  "Manage Order Picker Accounts",
  "View Orders",
  "Pick Orders",
  "View Order Picker Performance",
  "Spool Reports",
] as const;

const defaultPermissions: Record<string, string[]> = {
  Administrator: [...PERMISSIONS],
  "Store Manager": [],
  "Store Supervisor": [],
  Merchandiser: [],
  "Order Picker": [],
};

router.get("/", async (_req, res) => {
  try {
    const [row] = await db.select().from(userRightsTable).limit(1);
    if (row) {
      res.json({ permissions: row.permissions, roles: ROLES, permissionsList: PERMISSIONS });
    } else {
      res.json({ permissions: defaultPermissions, roles: ROLES, permissionsList: PERMISSIONS });
    }
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { permissions } = req.body as { permissions: Record<string, string[]> };
    if (!permissions || typeof permissions !== "object") {
      res.status(400).json({ error: "Invalid permissions data" });
      return;
    }

    const [existing] = await db.select().from(userRightsTable).limit(1);
    if (existing) {
      await db
        .update(userRightsTable)
        .set({ permissions, updatedAt: new Date() })
        .execute();
    } else {
      await db.insert(userRightsTable).values({ permissions });
    }

    res.json({ success: true, message: "User rights saved" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
