import { Router, type IRouter } from "express";
import { db, usersTable, organisationsTable, administratorsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const router: IRouter = Router();

const DEFAULT_PASSWORD = "Welcome1";

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password + "fast-picker-salt").digest("hex");
}

function generateUserId(): string {
  return "USR-" + crypto.randomBytes(4).toString("hex").toUpperCase();
}

async function findUniqueUsername(base: string): Promise<string> {
  const candidates = [base, ...Array.from({ length: 98 }, (_, i) => `${base}${i + 2}`)];
  for (const candidate of candidates) {
    const [existingUser] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, candidate))
      .limit(1);
    if (existingUser) continue;

    const [existingAdmin] = await db
      .select({ id: administratorsTable.id })
      .from(administratorsTable)
      .where(eq(administratorsTable.username, candidate))
      .limit(1);
    if (existingAdmin) continue;

    return candidate;
  }
  return `${base}-${Date.now()}`;
}

router.post("/", async (req, res) => {
  try {
    const { username, forenames, surname, employeeNumber, email, rights, branchCode, createdBy } = req.body;

    if (!username || !forenames || !surname || !rights || !branchCode) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const [org] = await db.select().from(organisationsTable).limit(1);
    if (!org) {
      res.status(500).json({ error: "Organisation not found" });
      return;
    }

    const resolvedUsername = await findUniqueUsername(username);
    const userId = generateUserId();
    const passwordHash = hashPassword(DEFAULT_PASSWORD);

    const [user] = await db
      .insert(usersTable)
      .values({
        userId,
        organisationId: org.id,
        username: resolvedUsername,
        forenames,
        surname,
        employeeNumber: employeeNumber || null,
        email: email || null,
        rights,
        branchCode,
        passwordHash,
        isFirstLogin: true,
        createdBy: createdBy || null,
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
      defaultPassword: DEFAULT_PASSWORD,
      message: "Account created successfully",
    });
  } catch (error: unknown) {
    console.error("Create account error:", error);
    res.status(500).json({ error: "Internal server error" });
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

router.get("/all", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable);
    const admins = await db.select().from(administratorsTable);

    const combined = [
      ...admins.map((a) => ({
        username: a.username,
        fullName: `${a.forenames} ${a.surname}`,
        employeeNumber: null as string | null,
        branchCode: "ALL",
        rights: a.designation,
        isActive: a.isActive,
        createdBy: "System",
        createdAt: a.createdAt.toISOString(),
        accountType: "admin" as const,
      })),
      ...users.map((u) => ({
        username: u.username,
        fullName: `${u.forenames} ${u.surname}`,
        employeeNumber: u.employeeNumber,
        branchCode: u.branchCode,
        rights: u.rights,
        isActive: u.isActive,
        createdBy: u.createdBy ?? "System",
        createdAt: u.createdAt.toISOString(),
        accountType: "user" as const,
      })),
    ];

    res.json(combined);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/set-password", async (req, res) => {
  try {
    const { username, newPassword } = req.body;

    if (!username || !newPassword) {
      res.status(400).json({ error: "Username and new password are required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const newHash = hashPassword(newPassword);
    await db
      .update(usersTable)
      .set({ passwordHash: newHash, isFirstLogin: false })
      .where(eq(usersTable.username, username));

    res.json({ success: true, message: "Password updated successfully" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
