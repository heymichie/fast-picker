import { useEffect, useState } from "react";
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

interface ProductEntry {
  productCode: string;
  dept: string;
  category: string;
  colour: string;
  description: string;
}

interface Rail {
  id: string;
  department: string;
  category: string;
  colour: string;
  description: string;
  products?: ProductEntry[];
}

const thStyle: React.CSSProperties = {
  padding: "0.6rem 1rem",
  textAlign: "left",
  fontSize: "0.75rem",
  fontWeight: 700,
  color: "#888",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  borderBottom: "1px solid #2a2a2a",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "0.65rem 1rem",
  fontSize: "0.88rem",
  color: "#ddd",
  borderBottom: "1px solid #1e1e1e",
  verticalAlign: "top",
};

const railIdStyle: React.CSSProperties = {
  display: "inline-block",
  background: "#daeeff",
  color: "#1a2a3a",
  fontWeight: 700,
  fontSize: "0.8rem",
  padding: "0.2rem 0.55rem",
  borderRadius: 5,
  border: "1px solid #4a9eda",
  fontFamily: "monospace",
  whiteSpace: "nowrap",
};

const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.3rem 0.85rem",
  borderRadius: 20,
  border: active ? "1.5px solid #4a9eda" : "1px solid #444",
  background: active ? "rgba(74,158,218,0.15)" : "transparent",
  color: active ? "#4a9eda" : "#aaa",
  fontSize: "0.85rem",
  fontWeight: active ? 700 : 400,
  cursor: "pointer",
});

export default function ManageStoreLayout() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const isAdmin = user?.isAdmin === true;

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [floors, setFloors] = useState<string[]>([]);
  const [selectedFloor, setSelectedFloor] = useState("");
  const [rails, setRails] = useState<Rail[]>([]);
  const [loading, setLoading] = useState(false);

  // ── Load branches ──────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/accounts/branches")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (isAdmin) {
          setBranches(data);
          if (data.length > 0) setSelectedBranch(data[0]);
        } else if (user?.branchCode && user.branchCode !== "ALL") {
          setBranches([user.branchCode]);
          setSelectedBranch(user.branchCode);
        }
      })
      .catch(() => {
        if (!isAdmin && user?.branchCode && user.branchCode !== "ALL") {
          setBranches([user.branchCode]);
          setSelectedBranch(user.branchCode);
        }
      });
  }, []);

  // ── Load floors when branch changes ───────────────────────────────
  useEffect(() => {
    if (!selectedBranch) { setFloors([]); setSelectedFloor(""); setRails([]); return; }
    fetch(`/api/store-layout/floors?branchCode=${encodeURIComponent(selectedBranch)}`)
      .then((r) => r.json())
      .then((names: string[]) => {
        setFloors(names);
        setSelectedFloor(names[0] ?? "");
      })
      .catch(() => { setFloors([]); setSelectedFloor(""); });
  }, [selectedBranch]);

  // ── Load rails when floor changes ─────────────────────────────────
  useEffect(() => {
    if (!selectedBranch || !selectedFloor) { setRails([]); return; }
    setLoading(true);
    fetch(`/api/store-layout?branchCode=${encodeURIComponent(selectedBranch)}&floorName=${encodeURIComponent(selectedFloor)}`)
      .then((r) => r.json())
      .then((d) => {
        setRails(Array.isArray(d.railsData) ? d.railsData : []);
      })
      .catch(() => setRails([]))
      .finally(() => setLoading(false));
  }, [selectedBranch, selectedFloor]);

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

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

      <div style={{ padding: "0.25rem 1.5rem 0.75rem", fontSize: "0.82rem", color: "#bbb" }}>
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 0, fontSize: "0.82rem" }}
        >
          Home
        </button>
        {" / Manage Store Layout"}
      </div>

      <div style={{ flex: 1, padding: "1rem 1.5rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Branch selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.85rem", color: "#aaa", fontWeight: 600, whiteSpace: "nowrap" }}>Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={{
              background: "#1a1a1a",
              border: "1px solid #444",
              color: "#fff",
              borderRadius: 8,
              padding: "0.45rem 1rem",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            {branches.length === 0 && <option value="">No branches</option>}
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Floor chips */}
        {floors.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "#666", marginRight: "0.25rem" }}>Floor:</span>
            {floors.map((f) => (
              <button key={f} type="button" onClick={() => setSelectedFloor(f)} style={chipStyle(f === selectedFloor)}>
                {f}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {!selectedBranch && (
          <p style={{ color: "#555", fontSize: "0.9rem" }}>Select a branch to view its store layout.</p>
        )}

        {selectedBranch && floors.length === 0 && !loading && (
          <p style={{ color: "#555", fontSize: "0.9rem" }}>No floor plans saved for {selectedBranch} yet.</p>
        )}

        {selectedBranch && selectedFloor && (
          <>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.75rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                {selectedBranch} — {selectedFloor}
              </h2>
              {!loading && (
                <span style={{ fontSize: "0.82rem", color: "#555" }}>
                  {rails.length} rail{rails.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {loading && <p style={{ color: "#555", fontSize: "0.9rem" }}>Loading...</p>}

            {!loading && rails.length === 0 && (
              <p style={{ color: "#555", fontSize: "0.9rem" }}>No rails marked on this floor plan yet.</p>
            )}

            {!loading && rails.length > 0 && (
              <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #222" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", background: "#111" }}>
                  <thead>
                    <tr>
                      <th style={thStyle}>Rail ID</th>
                      <th style={thStyle}>Product Code</th>
                      <th style={thStyle}>Department</th>
                      <th style={thStyle}>Category</th>
                      <th style={thStyle}>Colour</th>
                      <th style={thStyle}>Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rails.map((rail) => {
                      const products = rail.products && rail.products.length > 0
                        ? rail.products
                        : [{
                            productCode: "",
                            dept: rail.department,
                            category: rail.category,
                            colour: rail.colour,
                            description: rail.description,
                          }];

                      return products.map((p, pi) => (
                        <tr key={`${rail.id}-${pi}`} style={{ background: pi % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                          {pi === 0 && (
                            <td style={{ ...tdStyle, verticalAlign: "middle" }} rowSpan={products.length}>
                              <span style={railIdStyle}>{rail.id}</span>
                            </td>
                          )}
                          <td style={tdStyle}>
                            {p.productCode
                              ? <span style={{ fontFamily: "monospace", color: "#ccc", fontSize: "0.82rem" }}>{p.productCode}</span>
                              : <span style={{ color: "#444" }}>—</span>}
                          </td>
                          <td style={tdStyle}>{p.dept || <span style={{ color: "#444" }}>—</span>}</td>
                          <td style={tdStyle}>{p.category || <span style={{ color: "#444" }}>—</span>}</td>
                          <td style={tdStyle}>{p.colour || <span style={{ color: "#444" }}>—</span>}</td>
                          <td style={tdStyle}>{p.description || <span style={{ color: "#444" }}>—</span>}</td>
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
