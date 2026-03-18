import { Router, type IRouter } from "express";
import { db, usersTable, organisationsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

function generateUserId(): string {
  return "USR-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

router.post("/", async (req, res) => {
  try {
    const {
      username,
      forenames,
      surname,
      employeeNumber,
      email,
      rights,
      branchCode,
    } = req.body;

    if (!username || !forenames || !surname || !rights || !branchCode) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const [org] = await db.select().from(organisationsTable).limit(1);
    if (!org) {
      res.status(500).json({ error: "Organisation not found" });
      return;
    }

    const userId = generateUserId();

    const [user] = await db
      .insert(usersTable)
      .values({
        userId,
        organisationId: org.id,
        username,
        forenames,
        surname,
        employeeNumber: employeeNumber || null,
        email: email || null,
        rights,
        branchCode,
        isActive: true,
      })
      .returning();

    if (!user) {
      res.status(500).json({ error: "Failed to create user" });
      return;
    }

    res.status(201).json({
      id: user.id,
      userId: user.userId,
      username: user.username,
      forenames: user.forenames,
      surname: user.surname,
      rights: user.rights,
      branchCode: user.branchCode,
      isActive: user.isActive,
      message: "Account created successfully",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("unique")) {
      res.status(400).json({ error: "Username already exists" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.get("/", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable);
    res.json(users);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
