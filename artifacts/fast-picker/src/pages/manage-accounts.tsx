import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("fp_user");
    if (!raw) return null;
    return JSON.parse(raw) as {
      username: string;
      forenames: string;
      surname: string;
      designation: string;
      isAdmin: boolean;
    };
  } catch {
    return null;
  }
}

interface AccountRow {
  username: string;
  fullName: string;
  employeeNumber: string | null;
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

export default function ManageAccounts() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdministrator = !!(user?.isAdmin || user?.designation === "Administrator");

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

  const headerCellStyle: React.CSSProperties = {
    padding: "10px 12px",
    border: "1px solid #888",
    background: "#2a2a2a",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.88rem",
    textAlign: "left",
    whiteSpace: "nowrap",
  };

  const cellStyle = (rowIdx: number): React.CSSProperties => ({
    padding: "10px 12px",
    border: "1px solid #999",
    background: rowIdx % 2 === 0 ? "#e8e8e8" : "#dcdcdc",
    color: "#111",
    fontSize: "0.88rem",
    verticalAlign: "top",
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
          Account: {user ? `${user.forenames} ${user.surname}` : "(username)"}
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
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1.5px solid #888",
              fontSize: "0.88rem",
            }}
          >
            <colgroup>
              <col style={{ width: "13%" }} />
              <col style={{ width: "13%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "29%" }} />
            </colgroup>
            <thead>
              <tr>
                <th style={headerCellStyle}>Username</th>
                <th style={headerCellStyle}>Full Name</th>
                <th style={headerCellStyle}>Employee<br />Number</th>
                <th style={headerCellStyle}>Branch Code</th>
                <th style={headerCellStyle}>User Rights</th>
                <th style={headerCellStyle}>Account Status</th>
                <th style={headerCellStyle}>Created</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...cellStyle(0), textAlign: "center", padding: "2rem", color: "#666" }}>
                    No accounts found.
                  </td>
                </tr>
              ) : (
                accounts.map((row, idx) => (
                  <tr key={row.username}>
                    <td style={cellStyle(idx)}>{row.username}</td>
                    <td style={cellStyle(idx)}>{row.fullName}</td>
                    <td style={cellStyle(idx)}>{row.employeeNumber ?? "—"}</td>
                    <td style={cellStyle(idx)}>{row.branchCode}</td>
                    <td style={cellStyle(idx)}>{row.rights}</td>
                    <td style={{ ...cellStyle(idx), color: row.isActive ? "#111" : "#cc0000", fontWeight: row.isActive ? 400 : 600 }}>
                      {row.isActive ? "Active" : "Inactive"}
                    </td>
                    <td style={{ ...cellStyle(idx), fontStyle: "italic" }}>
                      {formatCreated(row.createdBy, row.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
