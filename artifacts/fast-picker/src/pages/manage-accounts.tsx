import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("fp_user");
    if (!raw) return null;
    return JSON.parse(raw) as {
      username: string; forenames: string; surname: string;
      designation: string; isAdmin: boolean;
    };
  } catch { return null; }
}

interface AccountRow {
  username: string;
  fullName: string;
  employeeNumber: string | null;
  department: string | null;
  branchCode: string;
  rights: string;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
  accountType: "admin" | "user";
}

function formatCreated(createdBy: string, createdAt: string) {
  const dt = new Date(createdAt);
  const date = dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });
  const time = dt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${createdBy}, ${date} ${time}`;
}

// ── Small action button ────────────────────────────────────────────────
function ActionBtn({
  label, onClick, variant = "default", disabled = false,
}: { label: string; onClick: () => void; variant?: "default" | "apply" | "save" | "cancel"; disabled?: boolean }) {
  const colors: Record<string, React.CSSProperties> = {
    default: { background: "#555", color: "#fff", border: "1px solid #777" },
    apply:   { background: "#2a6ad4", color: "#fff", border: "1px solid #2a6ad4" },
    save:    { background: "#2a2a2a", color: "#fff", border: "1px solid #555" },
    cancel:  { background: "transparent", color: "#555", border: "1px solid #bbb" },
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...colors[variant],
        padding: "3px 10px",
        borderRadius: 4,
        fontSize: "0.78rem",
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        whiteSpace: "nowrap",
        lineHeight: 1.4,
      }}
    >
      {label}
    </button>
  );
}

// ── Component ──────────────────────────────────────────────────────────
export default function ManageAccounts() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Department options from store layout
  const [departments, setDepartments] = useState<string[]>([]);

  // Per-row edit state
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  const [pendingDepts, setPendingDepts] = useState<Record<string, string>>({});

  // Per-row save feedback
  const [savingRows, setSavingRows] = useState<Set<string>>(new Set());
  const [savedRows, setSavedRows] = useState<Set<string>>(new Set());
  const savedTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const isAdministrator = !!(user?.isAdmin || user?.designation === "Administrator");

  // Fetch departments from store layout rails
  useEffect(() => {
    fetch("/api/store-layout/departments")
      .then((r) => r.json())
      .then((data: string[]) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  // Fetch accounts
  useEffect(() => {
    fetch("/api/accounts/all")
      .then((r) => r.json())
      .then((data: AccountRow[]) => {
        if (isAdministrator) {
          setAccounts(data);
        } else if (user?.designation === "Store Manager") {
          setAccounts(data.filter((a) =>
            ["Store Supervisor", "Merchandiser", "Order Picker"].includes(a.rights)
          ));
        } else {
          setAccounts(data.filter((a) => a.rights === "Order Picker"));
        }
      })
      .catch(() => setError("Failed to load accounts."))
      .finally(() => setLoading(false));
  }, [isAdministrator]);

  // ── Row edit helpers ───────────────────────────────────────────────
  function startEdit(username: string, currentDept: string | null) {
    setEditingRows((prev) => new Set(prev).add(username));
    setPendingDepts((prev) => ({ ...prev, [username]: currentDept ?? "" }));
  }

  function cancelEdit(username: string) {
    setEditingRows((prev) => { const next = new Set(prev); next.delete(username); return next; });
    setPendingDepts((prev) => { const next = { ...prev }; delete next[username]; return next; });
  }

  async function commitSave(username: string) {
    const dept = pendingDepts[username] ?? "";
    setSavingRows((prev) => new Set(prev).add(username));
    try {
      await fetch("/api/accounts/update-department", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, department: dept || null }),
      });
      // Update the account row
      setAccounts((prev) => prev.map((a) => a.username === username ? { ...a, department: dept || null } : a));
      // Exit edit mode
      cancelEdit(username);
      // Show ✓ Saved flash
      setSavedRows((prev) => new Set(prev).add(username));
      if (savedTimers.current[username]) clearTimeout(savedTimers.current[username]);
      savedTimers.current[username] = setTimeout(() => {
        setSavedRows((prev) => { const next = new Set(prev); next.delete(username); return next; });
      }, 2000);
    } catch {
      alert("Failed to save. Please try again.");
    } finally {
      setSavingRows((prev) => { const next = new Set(prev); next.delete(username); return next; });
    }
  }

  // Apply = lock in the selection locally, exit edit mode (does NOT hit the DB yet)
  function applySelection(username: string) {
    const dept = pendingDepts[username] ?? "";
    setAccounts((prev) => prev.map((a) => a.username === username ? { ...a, department: dept || null } : a));
    cancelEdit(username);
  }

  // ── Styles ─────────────────────────────────────────────────────────
  const headerCellStyle: React.CSSProperties = {
    padding: "10px 12px", border: "1px solid #888", background: "#2a2a2a",
    color: "#fff", fontWeight: 700, fontSize: "0.88rem", textAlign: "left", whiteSpace: "nowrap",
  };

  const cellStyle = (rowIdx: number): React.CSSProperties => ({
    padding: "10px 12px", border: "1px solid #999",
    background: rowIdx % 2 === 0 ? "#e8e8e8" : "#dcdcdc",
    color: "#111", fontSize: "0.88rem", verticalAlign: "middle",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.5rem", gap: "1rem" }}>
        <button onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`} alt="Fast Picker" style={{ height: 56, objectFit: "contain" }} />
        </button>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", margin: 0, flex: 1, lineHeight: 1 }}>
          Account: {user ? `${user.forenames} ${user.surname}` : "User"}
        </h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button type="button" onClick={() => { localStorage.removeItem("fp_user"); setLocation("/login"); }}
            style={{ background: "none", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", letterSpacing: "0.08em", padding: 0, textTransform: "uppercase" }}>
            LOGOUT
          </button>
          <LiveClock color="#ccc" size="sm" />
        </div>
      </header>

      {/* Breadcrumb */}
      <div style={{ padding: "0.25rem 1.5rem 0.75rem", fontSize: "0.82rem", color: "#bbb" }}>
        <button type="button" onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 0, fontSize: "0.82rem" }}>
          Home
        </button>
        {" / Manage Account"}
      </div>

      {/* Table */}
      <div style={{ flex: 1, padding: "0 1.5rem 2rem", overflowX: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
            <Loader2 style={{ width: 32, height: 32, color: "#888", animation: "spin 1s linear infinite" }} />
          </div>
        ) : error ? (
          <p style={{ color: "#f66", padding: "2rem 0" }}>{error}</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", border: "1.5px solid #888", fontSize: "0.88rem" }}>
            <colgroup>
              <col style={{ width: "11%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "22%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={headerCellStyle}>Username</th>
                <th style={headerCellStyle}>Full Name</th>
                <th style={headerCellStyle}>Employee<br />Number</th>
                <th style={headerCellStyle}>Department</th>
                <th style={headerCellStyle}>Branch Code</th>
                <th style={headerCellStyle}>User Rights</th>
                <th style={headerCellStyle}>Account Status</th>
                <th style={headerCellStyle}>Created</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...cellStyle(0), textAlign: "center", padding: "2rem", color: "#666" }}>
                    No accounts found.
                  </td>
                </tr>
              ) : (
                accounts.map((row, idx) => {
                  const isEditing = editingRows.has(row.username);
                  const isSaving = savingRows.has(row.username);
                  const justSaved = savedRows.has(row.username);
                  const pendingVal = pendingDepts[row.username] ?? row.department ?? "";

                  // Build the dept options list, always including the current value if not in list
                  const extraOpt = row.department && !departments.includes(row.department) ? row.department : null;

                  return (
                    <tr key={row.username}>
                      <td style={cellStyle(idx)}>{row.username}</td>
                      <td style={cellStyle(idx)}>{row.fullName}</td>
                      <td style={cellStyle(idx)}>{row.employeeNumber ?? "—"}</td>

                      {/* ── Department cell ──────────────────────────── */}
                      <td style={{ ...cellStyle(idx), padding: "6px 8px" }}>
                        {row.accountType === "admin" ? (
                          <span style={{ color: "#888" }}>—</span>
                        ) : isEditing ? (
                          /* Edit mode: dropdown + Apply + Save + Cancel */
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            <select
                              value={pendingVal}
                              onChange={(e) => setPendingDepts((prev) => ({ ...prev, [row.username]: e.target.value }))}
                              disabled={isSaving}
                              autoFocus
                              style={{
                                width: "100%", background: "#fff", border: "1.5px solid #2a6ad4",
                                borderRadius: 4, padding: "4px 6px", fontSize: "0.85rem",
                                color: pendingVal ? "#111" : "#888", cursor: "pointer", outline: "none",
                              }}
                            >
                              <option value="">— None —</option>
                              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                              {extraOpt && <option value={extraOpt}>{extraOpt}</option>}
                            </select>
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                              <ActionBtn label="Save" variant="save" onClick={() => commitSave(row.username)} disabled={isSaving} />
                              <ActionBtn label="Cancel" variant="cancel" onClick={() => cancelEdit(row.username)} disabled={isSaving} />
                              {isSaving && <Loader2 style={{ width: 14, height: 14, color: "#888", animation: "spin 1s linear infinite", alignSelf: "center" }} />}
                            </div>
                          </div>
                        ) : (
                          /* View mode: dept text + Edit button */
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ flex: 1, color: row.department ? "#111" : "#aaa", fontStyle: row.department ? "normal" : "italic" }}>
                              {row.department ?? "—"}
                            </span>
                            {justSaved && (
                              <span style={{ fontSize: "0.72rem", color: "#1a7a1a", fontWeight: 700, whiteSpace: "nowrap" }}>✓ Saved</span>
                            )}
                            <ActionBtn label="Edit" variant="default" onClick={() => startEdit(row.username, row.department)} />
                          </div>
                        )}
                      </td>

                      <td style={cellStyle(idx)}>{row.branchCode}</td>
                      <td style={cellStyle(idx)}>{row.rights}</td>
                      <td style={{ ...cellStyle(idx), color: row.isActive ? "#111" : "#cc0000", fontWeight: row.isActive ? 400 : 600 }}>
                        {row.isActive ? "Active" : "Inactive"}
                      </td>
                      <td style={{ ...cellStyle(idx), fontStyle: "italic" }}>
                        {formatCreated(row.createdBy, row.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
