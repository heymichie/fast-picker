import { Router, type IRouter } from "express";
import { db, usersTable, organisationsTable, administratorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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
    const { username, forenames, surname, employeeNumber, email, department, rights, branchCode, createdBy } = req.body;

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
        department: department || null,
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
    const users = await db.select().from(usersTable).where(eq(usersTable.isArchived, false));
    res.json(users);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/branches", async (_req, res) => {
  try {
    const users = await db.select({ branchCode: usersTable.branchCode }).from(usersTable).where(eq(usersTable.isArchived, false));
    const codes = [...new Set(users.map((u) => u.branchCode).filter((c) => c && c !== "ALL"))].sort();
    res.json(codes);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/all", async (_req, res) => {
  try {
    const users = await db.select().from(usersTable).where(eq(usersTable.isArchived, false));
    const admins = await db.select().from(administratorsTable);

    const combined = [
      ...admins.map((a) => ({
        username: a.username,
        fullName: `${a.forenames} ${a.surname}`,
        employeeNumber: null as string | null,
        department: null as string | null,
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
        department: u.department ?? null,
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

router.post("/update-department", async (req, res) => {
  try {
    const { username, department } = req.body;
    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }
    await db
      .update(usersTable)
      .set({ department: department || null })
      .where(eq(usersTable.username, username));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET single user details for edit form
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const [user] = await db
      .select()
      .from(usersTable)
      .where(and(eq(usersTable.username, username), eq(usersTable.isArchived, false)))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json({
      username: user.username,
      forenames: user.forenames,
      surname: user.surname,
      employeeNumber: user.employeeNumber ?? null,
      email: user.email ?? null,
      department: user.department ?? null,
      rights: user.rights,
      branchCode: user.branchCode,
      isActive: user.isActive,
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// PUT update user details
router.put("/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { forenames, surname, employeeNumber, email, department, rights, branchCode, isActive } = req.body;

    if (!forenames || !surname || !rights || !branchCode) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.username, username))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const isAdminRole = rights === "Administrator";
    await db
      .update(usersTable)
      .set({
        forenames: forenames.trim(),
        surname: surname.trim(),
        employeeNumber: employeeNumber?.trim() || null,
        email: email?.trim() || null,
        department: department?.trim() || null,
        rights,
        branchCode: isAdminRole ? "ALL" : branchCode,
        isActive: isActive !== undefined ? isActive : true,
      })
      .where(eq(usersTable.username, username));

    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE — archive a user account (soft-delete, sets isArchived = true)
router.delete("/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const [user] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.username, username), eq(usersTable.isArchived, false)))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    await db
      .update(usersTable)
      .set({ isArchived: true, isActive: false })
      .where(eq(usersTable.username, username));
    res.json({ ok: true, message: "Account archived successfully" });
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
