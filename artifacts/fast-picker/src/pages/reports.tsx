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

interface ReportSection {
  title: string;
  columns: string[];
  rows: string[][];
  note?: string;
}

interface ReportData {
  organisationName: string;
  branchCode: string;
  period: string;
  generatedAt: string;
  sections: ReportSection[];
}

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
  const [isDownloading, setIsDownloading] = useState(false);

  const isAdmin = user?.isAdmin === true;

  useEffect(() => {
    fetch("/api/accounts/branches")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (isAdmin) {
          setBranches(["ALL", ...data]);
        } else if (user?.branchCode && user.branchCode !== "ALL") {
          const myBranch = user.branchCode;
          setBranches(data.includes(myBranch) ? [myBranch] : [myBranch]);
          setSelectedBranch(myBranch);
        }
      })
      .catch(() => {
        if (!isAdmin && user?.branchCode && user.branchCode !== "ALL") {
          setBranches([user.branchCode]);
          setSelectedBranch(user.branchCode);
        }
      });
  }, []);

  function toggleCheck(key: string) {
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function handleDownload() {
    const selectedTypes = Object.entries(checked)
      .filter(([, v]) => v)
      .map(([k]) => k);

    if (!selectedBranch) { alert("Please select a branch code."); return; }
    if (!selectedYear) { alert("Please select a trading year."); return; }
    if (!selectedMonth) { alert("Please select a trading month."); return; }
    if (selectedTypes.length === 0) { alert("Please select at least one report type."); return; }

    setIsDownloading(true);

    try {
      // Build query params
      const params = new URLSearchParams({
        branchCode: selectedBranch,
        year: selectedYear,
        month: selectedMonth,
      });
      selectedTypes.forEach((t) => params.append("types", t));

      const resp = await fetch(`/api/reports?${params.toString()}`);
      if (!resp.ok) throw new Error("Failed to fetch report data");
      const data: ReportData = await resp.json();

      // Dynamically import jspdf to keep initial bundle small
      const { jsPDF } = await import("jspdf");
      const autoTable = (await import("jspdf-autotable")).default;

      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;

      // ── Cover header ──────────────────────────────────────────────
      doc.setFillColor(30, 30, 30);
      doc.rect(0, 0, pageW, 28, "F");

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("FAST PICKER", margin, 12);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Mishka Technologies", margin, 18);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("REPORTS", pageW - margin, 12, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(data.organisationName, pageW - margin, 18, { align: "right" });
      doc.text(`Generated: ${data.generatedAt}`, pageW - margin, 23, { align: "right" });

      // ── Report meta ───────────────────────────────────────────────
      let y = 36;
      doc.setTextColor(30, 30, 30);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text(`Branch: ${data.branchCode === "ALL" ? "All Branches" : data.branchCode}`, margin, y);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Period: ${data.period}`, margin, y + 7);
      doc.text(`Prepared by: ${user ? `${user.forenames} ${user.surname}` : "System"}`, margin, y + 13);

      y += 22;

      // ── Sections ──────────────────────────────────────────────────
      for (const section of data.sections) {
        // Section heading
        doc.setFillColor(70, 70, 70);
        doc.rect(margin, y, pageW - margin * 2, 7, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(section.title, margin + 3, y + 5);
        y += 10;

        if (section.note) {
          doc.setTextColor(100, 100, 100);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.text(section.note, margin, y + 4, { maxWidth: pageW - margin * 2 });
          y += 14;
          continue;
        }

        if (section.rows.length === 0) {
          doc.setTextColor(120, 120, 120);
          doc.setFont("helvetica", "italic");
          doc.setFontSize(8);
          doc.text("No records found for the selected period and branch.", margin, y + 4);
          y += 12;
          continue;
        }

        // Data table
        autoTable(doc, {
          startY: y,
          head: [section.columns],
          body: section.rows,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8, cellPadding: 2.5, textColor: [30, 30, 30] },
          headStyles: { fillColor: [100, 100, 100], textColor: 255, fontStyle: "bold" },
          alternateRowStyles: { fillColor: [240, 240, 240] },
          tableLineColor: [180, 180, 180],
          tableLineWidth: 0.2,
        });

        y = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

        // Add a new page if we're running low on space
        if (y > doc.internal.pageSize.getHeight() - 20) {
          doc.addPage();
          y = 20;
        }
      }

      // ── Footer on each page ───────────────────────────────────────
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFillColor(30, 30, 30);
        doc.rect(0, doc.internal.pageSize.getHeight() - 10, pageW, 10, "F");
        doc.setTextColor(180, 180, 180);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.text("Fast Picker — Mishka Technologies | Confidential", margin, doc.internal.pageSize.getHeight() - 4);
        doc.text(`Page ${i} of ${totalPages}`, pageW - margin, doc.internal.pageSize.getHeight() - 4, { align: "right" });
      }

      // ── Save ──────────────────────────────────────────────────────
      const safeMonth = selectedMonth.slice(0, 3).toUpperCase();
      const safeBranch = selectedBranch.replace(/\s+/g, "-");
      doc.save(`FastPicker_Report_${safeBranch}_${safeMonth}${selectedYear}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Failed to generate report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
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
          disabled={isDownloading}
          style={{
            background: isDownloading ? "#ccc" : "#fff",
            color: isDownloading ? "#888" : "#1a6bc4",
            border: "none",
            borderRadius: 8,
            padding: "0.7rem 3.5rem",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: isDownloading ? "not-allowed" : "pointer",
            minWidth: 220,
            transition: "all 0.2s",
          }}
        >
          {isDownloading ? "Generating PDF…" : "Download"}
        </button>
      </div>
    </div>
  );
}
