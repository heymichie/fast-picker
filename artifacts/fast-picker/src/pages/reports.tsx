import { useState, useEffect } from "react";
import { useLocation } from "wouter";
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
      isAdmin?: boolean;
      branchCode?: string;
    };
  } catch {
    return null;
  }
}

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => String(CURRENT_YEAR - i));
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const REPORT_TYPES = [
  {
    category: "Store Stats",
    options: ["Order Picking Duration", "Frequency of order picking"],
  },
  {
    category: "Accounts Management",
    options: ["Created", "Modified", "Inactive", "Deleted"],
  },
];

const selectStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  background: "#d4d4d4 url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23333' strokeWidth='2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E\") no-repeat right 12px center",
  backgroundSize: "12px",
  border: "none",
  padding: "0.45rem 2rem 0.45rem 0.75rem",
  fontSize: "0.95rem",
  color: "#222",
  cursor: "pointer",
  outline: "none",
  borderRadius: 0,
};

export default function Reports() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const isAdmin = user?.isAdmin === true;

  useEffect(() => {
    // Always fetch live from the database so new branches appear automatically
    fetch("/api/accounts/branches")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (isAdmin) {
          // Administrators see all branches plus an "ALL" option
          setBranches(["ALL", ...data]);
        } else if (user?.branchCode && user.branchCode !== "ALL") {
          // Non-admins are limited to their own assigned branch
          const myBranch = user.branchCode;
          setBranches(data.includes(myBranch) ? [myBranch] : [myBranch]);
          setSelectedBranch(myBranch);
        }
      })
      .catch(() => {
        // Fallback to localStorage value if API is unavailable
        if (!isAdmin && user?.branchCode && user.branchCode !== "ALL") {
          setBranches([user.branchCode]);
          setSelectedBranch(user.branchCode);
        }
      });
  }, []);

  function toggleCheck(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleDownload() {
    const selectedReports = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (!selectedBranch) { alert("Please select a branch code."); return; }
    if (!selectedYear) { alert("Please select a trading year."); return; }
    if (!selectedMonth) { alert("Please select a trading month."); return; }
    if (selectedReports.length === 0) { alert("Please select at least one report type."); return; }
    alert(`Download requested:\nBranch: ${selectedBranch}\nPeriod: ${selectedMonth} ${selectedYear}\nReports: ${selectedReports.join(", ")}`);
  }

  const cellLabel: React.CSSProperties = {
    background: "#555",
    color: "#fff",
    fontWeight: 700,
    fontSize: "0.95rem",
    padding: "0.5rem 1rem",
    whiteSpace: "nowrap",
    minWidth: 130,
  };

  const cellInput: React.CSSProperties = {
    background: "#d4d4d4",
    flex: 1,
    display: "flex",
    alignItems: "center",
    padding: "0.15rem 0",
  };

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
        {"/Reports"}
      </div>

      {/* Form area */}
      <div style={{ padding: "0 1.5rem", display: "flex", flexDirection: "column", gap: "0.6rem", maxWidth: 860 }}>

        {/* Branch Code row */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={cellLabel}>Branch Code</div>
          <div style={{ ...cellInput, padding: 0 }}>
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              style={{ ...selectStyle, flex: 1, width: "100%", background: "#d4d4d4 url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23333' strokeWidth='2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E\") no-repeat right 14px center" }}
              disabled={!isAdmin && branches.length <= 1}
            >
              <option value="">Select branch code</option>
              {branches.map((b) => (
                <option key={b} value={b}>{b === "ALL" ? "ALL (All Branches)" : b}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Period row */}
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={cellLabel}>Period</div>
          <div style={{ background: "#d4d4d4", display: "flex", alignItems: "center", flex: 1, gap: 0 }}>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              style={{ ...selectStyle, flex: 1, borderRight: "1px solid #aaa" }}
            >
              <option value="">Trading Year</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{ ...selectStyle, flex: 1 }}
            >
              <option value="">Trading Month</option>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* Report Type table */}
      <div style={{ padding: "1.2rem 1.5rem 0", maxWidth: 860 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{
                background: "#555", color: "#fff", fontWeight: 700, fontSize: "0.95rem",
                padding: "0.55rem 1rem", textAlign: "left", width: "40%",
              }}>
                Report Type
              </th>
              <th style={{ background: "#555", padding: "0.55rem 1rem" }}></th>
            </tr>
          </thead>
          <tbody>
            {REPORT_TYPES.map((row, ri) => (
              <tr key={row.category} style={{ background: ri % 2 === 0 ? "#e8e8e8" : "#d4d4d4" }}>
                <td style={{ padding: "0.65rem 1rem", color: "#111", fontWeight: 400, fontSize: "0.95rem", verticalAlign: "top" }}>
                  {row.category}
                </td>
                <td style={{ padding: "0.5rem 1rem", verticalAlign: "top" }}>
                  {row.options.map((opt) => (
                    <label key={opt} style={{ display: "flex", alignItems: "center", gap: "0.5rem", color: "#111", fontSize: "0.93rem", marginBottom: "0.25rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={!!checked[`${row.category}::${opt}`]}
                        onChange={() => toggleCheck(`${row.category}::${opt}`)}
                        style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#333" }}
                      />
                      {opt}
                    </label>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Download button */}
      <div style={{ display: "flex", justifyContent: "center", padding: "2rem 1.5rem 2.5rem" }}>
        <button
          type="button"
          onClick={handleDownload}
          style={{
            background: "#fff",
            color: "#1a6bc4",
            border: "none",
            borderRadius: 8,
            padding: "0.7rem 3.5rem",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: "pointer",
            minWidth: 220,
          }}
        >
          Download
        </button>
      </div>
    </div>
  );
}
