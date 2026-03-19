import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("fp_user");
    if (!raw) return null;
    return JSON.parse(raw) as { username: string; forenames: string; surname: string; designation: string };
  } catch {
    return null;
  }
}

const ROLES = ["Administrator", "Store Manager", "Store Supervisor", "Merchandiser", "Order Picker"];

const PERMISSIONS = [
  "Create New Accounts",
  "Manage Accounts",
  "Assign Account Rights",
  "Setup branch layout",
  "View branch layout",
  "Create Order picker accounts",
  "Manage Order Picker Accounts",
  "View Orders",
  "Pick Orders",
  "View Order Picker Performance",
  "Spool Reports",
];

type PermMatrix = Record<string, Record<string, boolean>>;

function buildMatrix(serverPerms: Record<string, string[]>): PermMatrix {
  const matrix: PermMatrix = {};
  for (const perm of PERMISSIONS) {
    matrix[perm] = {};
    for (const role of ROLES) {
      matrix[perm][role] = (serverPerms[role] ?? []).includes(perm);
    }
  }
  return matrix;
}

function matrixToServer(matrix: PermMatrix): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const role of ROLES) {
    result[role] = PERMISSIONS.filter((p) => matrix[p]?.[role]);
  }
  return result;
}

export default function UserRights() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  const [matrix, setMatrix] = useState<PermMatrix>(() => buildMatrix({}));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    fetch("/api/user-rights")
      .then((r) => r.json())
      .then((data) => {
        setMatrix(buildMatrix(data.permissions ?? {}));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const toggle = (perm: string, role: string) => {
    setMatrix((prev) => ({
      ...prev,
      [perm]: {
        ...prev[perm],
        [role]: !prev[perm]?.[role],
      },
    }));
  };

  const save = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/user-rights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: matrixToServer(matrix) }),
      });
      if (res.ok) setSavedMsg("Saved!");
    } catch {
      setSavedMsg("Error saving.");
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    await save();
  };

  const handleOk = async () => {
    await save();
    setLocation("/dashboard");
  };

  const cellStyle = (isHeader: boolean, isLabel: boolean, idx: number): React.CSSProperties => ({
    padding: isHeader ? "10px 8px" : "9px 8px",
    border: "1px solid #999",
    background: isHeader ? "#d0d0d0" : idx % 2 === 0 ? "#e8e8e8" : "#dcdcdc",
    textAlign: isLabel ? "left" : "center",
    fontWeight: isHeader ? 700 : 400,
    fontSize: isHeader ? "0.9rem" : "0.88rem",
    color: "#111",
    verticalAlign: "middle",
    whiteSpace: isLabel ? "normal" : "nowrap",
    lineHeight: 1.3,
  });

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.5rem", gap: "1rem" }}>
        <button
          onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
          title="Go to Dashboard"
        >
          <img
            src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
            alt="Fast Picker"
            style={{ height: 56, objectFit: "contain" }}
          />
        </button>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", margin: 0, flex: 1, lineHeight: 1 }}>
          Account: {user ? `${user.forenames} ${user.surname}` : "User"}
        </h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button
            type="button"
            onClick={() => { localStorage.removeItem("fp_user"); setLocation("/login"); }}
            style={{
              background: "none", border: "none", color: "#fff",
              fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
              letterSpacing: "0.08em", padding: 0, textTransform: "uppercase",
            }}
          >
            LOGOUT
          </button>
          <LiveClock color="#ccc" size="sm" />
        </div>
      </header>

      {/* Breadcrumb */}
      <div style={{ padding: "0.25rem 1.5rem 0.75rem", fontSize: "0.82rem", color: "#bbb" }}>
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 0, fontSize: "0.82rem" }}
        >
          Home
        </button>
        {" / User Rights"}
      </div>

      {/* Table area */}
      <div style={{ flex: 1, padding: "0 1.5rem 1.5rem", overflowX: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
            <Loader2 style={{ width: 32, height: 32, color: "#888", animation: "spin 1s linear infinite" }} />
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              maxWidth: 900,
              borderCollapse: "collapse",
              border: "1.5px solid #888",
              fontSize: "0.9rem",
            }}
          >
            {/* Column widths */}
            <colgroup>
              <col style={{ width: "22%" }} />
              {ROLES.map((r) => <col key={r} style={{ width: `${78 / ROLES.length}%` }} />)}
            </colgroup>

            <thead>
              <tr>
                {/* Empty top-left cell */}
                <th style={cellStyle(true, true, 0)}></th>
                {ROLES.map((role) => (
                  <th key={role} style={cellStyle(true, false, 0)}>{role}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {PERMISSIONS.map((perm, rowIdx) => (
                <tr key={perm}>
                  <td style={cellStyle(false, true, rowIdx)}>{perm}</td>
                  {ROLES.map((role) => (
                    <td key={role} style={cellStyle(false, false, rowIdx)}>
                      <input
                        type="checkbox"
                        checked={!!matrix[perm]?.[role]}
                        onChange={() => toggle(perm, role)}
                        style={{
                          width: 17,
                          height: 17,
                          cursor: "pointer",
                          accentColor: "#333",
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {savedMsg && (
          <p style={{ color: savedMsg === "Saved!" ? "#6f6" : "#f66", fontSize: "0.85rem", marginTop: 10 }}>
            {savedMsg}
          </p>
        )}
      </div>

      {/* Bottom buttons */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "3rem",
          padding: "1rem 1.5rem 2rem",
        }}
      >
        <button
          onClick={handleApply}
          disabled={saving}
          style={{
            background: "#fff",
            color: "#111",
            border: "1.5px solid #ccc",
            borderRadius: 8,
            padding: "0.6rem 4rem",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            minWidth: 180,
          }}
        >
          {saving ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite", display: "inline" }} /> : "Apply"}
        </button>

        <button
          onClick={handleOk}
          disabled={saving}
          style={{
            background: "#fff",
            color: "#111",
            border: "1.5px solid #ccc",
            borderRadius: 8,
            padding: "0.6rem 4rem",
            fontSize: "1rem",
            fontWeight: 500,
            cursor: saving ? "not-allowed" : "pointer",
            opacity: saving ? 0.7 : 1,
            minWidth: 180,
          }}
        >
          Ok
        </button>
      </div>
    </div>
  );
}
