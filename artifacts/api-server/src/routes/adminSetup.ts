import { Router, type IRouter } from "express";
import { db, organisationsTable, administratorsTable, usersTable } from "@workspace/db";
import { CreateAdminSetupBody, GetAdminSetupResponse } from "@workspace/api-zod";
import { count, eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "fast-picker-salt").digest("hex");
}

router.get("/setup", async (_req, res) => {
  try {
    const [adminCount] = await db.select({ count: count() }).from(administratorsTable);
    const isSetup = (adminCount?.count ?? 0) > 0;

    let organisationName: string | null = null;
    if (isSetup) {
      const [org] = await db.select().from(organisationsTable).limit(1);
      organisationName = org?.organisationTradingName ?? null;
    }

    const data = GetAdminSetupResponse.parse({ isSetup, organisationName });
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/setup", async (req, res) => {
  try {
    const [adminCount] = await db.select({ count: count() }).from(administratorsTable);
    if ((adminCount?.count ?? 0) > 0) {
      res.status(409).json({ error: "Administrator has already been set up" });
      return;
    }

    const parsed = CreateAdminSetupBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Validation error", details: parsed.error.message });
      return;
    }

    const {
      organisationTradingName,
      administratorForenames,
      surname,
      designation,
      username,
      password,
      retypePassword,
      productCode,
    } = parsed.data;

    if (password !== retypePassword) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }

    const [org] = await db
      .insert(organisationsTable)
      .values({ organisationTradingName })
      .returning();

    if (!org) {
      res.status(500).json({ error: "Failed to create organisation" });
      return;
    }

    const passwordHash = hashPassword(password);

    const [admin] = await db
      .insert(administratorsTable)
      .values({
        organisationId: org.id,
        forenames: administratorForenames,
        surname,
        designation,
        username,
        passwordHash,
        productCode,
        isActive: true,
      })
      .returning();

    if (!admin) {
      res.status(500).json({ error: "Failed to create administrator" });
      return;
    }

    res.status(201).json({
      organisationalId: org.id,
      organisationTradingName: org.organisationTradingName,
      username: admin.username,
      message: "Administrator setup completed successfully",
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    if (msg.includes("unique")) {
      res.status(400).json({ error: "Username already taken" });
    } else {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "Username and password are required" });
      return;
    }

    const passwordHash = hashPassword(password);

    // Check administrators table first
    const [admin] = await db
      .select()
      .from(administratorsTable)
      .where(eq(administratorsTable.username, username))
      .limit(1);

    if (admin) {
      if (admin.passwordHash !== passwordHash) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }
      if (!admin.isActive) {
        res.status(403).json({ error: "Account is inactive" });
        return;
      }
      res.json({
        success: true,
        isAdmin: true,
        username: admin.username,
        forenames: admin.forenames,
        surname: admin.surname,
        designation: admin.designation,
        message: "Login successful",
      });
      return;
    }

    // Check regular users table
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    if (user.passwordHash !== passwordHash) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: "Account is inactive" });
      return;
    }

    // First-login: prompt password change
    if (user.isFirstLogin) {
      res.json({
        requiresPasswordChange: true,
        username: user.username,
        message: "Password change required",
      });
      return;
    }

    res.json({
      success: true,
      isAdmin: false,
      username: user.username,
      forenames: user.forenames,
      surname: user.surname,
      designation: user.rights,
      branchCode: user.branchCode,
      message: "Login successful",
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
