import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { LiveClock } from "@/components/LiveClock";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("fp_user");
    if (!raw) return null;
    return JSON.parse(raw) as {
      username: string; forenames: string; surname: string;
      designation: string; isAdmin?: boolean; branchCode?: string;
    };
  } catch { return null; }
}

interface Order {
  id: number;
  orderNumber: string;
  branchCode: string;
  status: string;
  receivedAt: string;
  pickingStartedAt: string | null;
  pickedAt: string | null;
  dispatchedAt: string | null;
  assignedPickerId: string | null;
  assignedPickerName: string | null;
  itemCount: number;
}

// ── Helpers ────────────────────────────────────────────────────────────
function fmt(ts: string | null): string {
  if (!ts) return "—";
  return new Date(ts).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });
}

function diffMins(from: string | null, to: string | null): string {
  if (!from || !to) return "—";
  const diff = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000);
  if (diff < 60) return `${diff}m`;
  return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  received: { label: "Received",   bg: "rgba(100,140,255,0.15)", color: "#88aaff" },
  picking:  { label: "Picking",    bg: "rgba(255,180,60,0.15)",  color: "#ffb83c" },
  picked:   { label: "Picked",     bg: "rgba(160,90,255,0.15)",  color: "#c07eff" },
  dispatched:{ label: "Dispatched", bg: "rgba(80,210,120,0.15)", color: "#50d278" },
};

const STATUSES = ["all", "received", "picking", "picked", "dispatched"];

// ── Styles ─────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "0.6rem 0.85rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700,
  color: "#777", textTransform: "uppercase", letterSpacing: "0.07em",
  borderBottom: "1px solid #222", whiteSpace: "nowrap", background: "#0d0d0d",
};
const tdBase: React.CSSProperties = {
  padding: "0.7rem 0.85rem", fontSize: "0.85rem", color: "#ddd",
  borderBottom: "1px solid #1a1a1a", verticalAlign: "middle",
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, bg: "#333", color: "#aaa" };
  return (
    <span style={{ background: m.bg, color: m.color, padding: "0.22rem 0.65rem", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
      {m.label}
    </span>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "1.1rem 1.4rem", minWidth: 120, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <span style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: "0.78rem", color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────
export default function ViewOrders() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Load available branches
  useEffect(() => {
    const isAdmin = user?.isAdmin === true;
    if (isAdmin) {
      fetch("/api/orders/branches")
        .then((r) => r.json())
        .then((data: string[]) => { setBranches(["ALL", ...data]); setSelectedBranch("ALL"); })
        .catch(() => { setBranches(["ALL"]); });
    } else if (user?.branchCode) {
      setBranches([user.branchCode]);
      setSelectedBranch(user.branchCode);
    }
  }, []);

  // Fetch orders
  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (selectedBranch && selectedBranch !== "ALL") params.set("branchCode", selectedBranch);
    if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then((data: Order[]) => { setOrders(Array.isArray(data) ? data : []); setLastRefresh(new Date()); })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [selectedBranch, statusFilter]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => {
      const params = new URLSearchParams();
      if (selectedBranch && selectedBranch !== "ALL") params.set("branchCode", selectedBranch);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      fetch(`/api/orders?${params}`)
        .then((r) => r.json())
        .then((data: Order[]) => { setOrders(Array.isArray(data) ? data : []); setLastRefresh(new Date()); })
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [selectedBranch, statusFilter]);

  // ── Stats (from ALL orders for selected branch, ignoring status filter) ──
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedBranch && selectedBranch !== "ALL") params.set("branchCode", selectedBranch);
    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then((data: Order[]) => setAllOrders(Array.isArray(data) ? data : []))
      .catch(() => setAllOrders([]));
  }, [selectedBranch]);

  const stats = {
    total: allOrders.length,
    received: allOrders.filter((o) => o.status === "received").length,
    picking: allOrders.filter((o) => o.status === "picking").length,
    picked: allOrders.filter((o) => o.status === "picked").length,
    dispatched: allOrders.filter((o) => o.status === "dispatched").length,
  };

  // ── Per-branch summary ─────────────────────────────────────────────
  const branchSummary: Record<string, { total: number; dispatched: number; picking: number; received: number; avgPickMins: number | null }> = {};
  for (const o of allOrders) {
    if (!branchSummary[o.branchCode]) branchSummary[o.branchCode] = { total: 0, dispatched: 0, picking: 0, received: 0, avgPickMins: null };
    branchSummary[o.branchCode].total++;
    if (o.status === "dispatched") branchSummary[o.branchCode].dispatched++;
    if (o.status === "picking") branchSummary[o.branchCode].picking++;
    if (o.status === "received") branchSummary[o.branchCode].received++;
  }
  // Average pick duration per branch (only for picked/dispatched with both timestamps)
  const pickTimes: Record<string, number[]> = {};
  for (const o of allOrders) {
    if (o.pickingStartedAt && o.pickedAt) {
      if (!pickTimes[o.branchCode]) pickTimes[o.branchCode] = [];
      pickTimes[o.branchCode].push((new Date(o.pickedAt).getTime() - new Date(o.pickingStartedAt).getTime()) / 60_000);
    }
  }
  for (const b of Object.keys(branchSummary)) {
    const times = pickTimes[b];
    if (times && times.length > 0) {
      branchSummary[b].avgPickMins = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    }
  }

  const showBranchSummary = selectedBranch === "ALL" && Object.keys(branchSummary).length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.5rem", gap: "1rem", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
        <button onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <img src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`} alt="Fast Picker" style={{ height: 52, objectFit: "contain" }} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>View Orders</h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#555" }}>
            Refreshed at {lastRefresh.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button type="button" onClick={() => { localStorage.removeItem("fp_user"); setLocation("/login"); }}
            style={{ background: "none", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer", letterSpacing: "0.08em", padding: 0, textTransform: "uppercase" }}>
            LOGOUT
          </button>
          <LiveClock color="#555" size="sm" />
        </div>
      </header>

      {/* Breadcrumb */}
      <div style={{ padding: "0.4rem 1.5rem 0", fontSize: "0.8rem", color: "#555" }}>
        <button type="button" onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", color: "#555", cursor: "pointer", padding: 0, fontSize: "0.8rem" }}>Home</button>
        {" / View Orders"}
      </div>

      <div style={{ flex: 1, padding: "1rem 1.5rem 2.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* ── Filters ────────────────────────────────────────────── */}
        <div style={{ display: "flex", gap: "1.25rem", flexWrap: "wrap", alignItems: "center" }}>
          {branches.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <label style={{ fontSize: "0.8rem", color: "#666", fontWeight: 600, whiteSpace: "nowrap" }}>Branch</label>
              <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
                style={{ background: "#111", border: "1px solid #333", color: "#fff", borderRadius: 8, padding: "0.4rem 0.85rem", fontSize: "0.88rem", cursor: "pointer", outline: "none" }}>
                {branches.map((b) => <option key={b} value={b}>{b === "ALL" ? "All Branches" : b}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            {STATUSES.map((s) => {
              const active = statusFilter === s;
              const meta = STATUS_META[s];
              return (
                <button key={s} type="button" onClick={() => setStatusFilter(s)}
                  style={{
                    padding: "0.3rem 0.85rem", borderRadius: 20, fontSize: "0.82rem", fontWeight: active ? 700 : 500, cursor: "pointer",
                    background: active ? (meta?.bg ?? "rgba(255,255,255,0.1)") : "transparent",
                    color: active ? (meta?.color ?? "#fff") : "#555",
                    border: active ? `1.5px solid ${meta?.color ?? "#fff"}` : "1px solid #2a2a2a",
                  }}>
                  {s === "all" ? "All Statuses" : STATUS_META[s]?.label ?? s}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Summary stat cards ─────────────────────────────────── */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <StatCard label="Total Today" value={stats.total} color="#fff" />
          <StatCard label="Received" value={stats.received} color="#88aaff" />
          <StatCard label="Picking" value={stats.picking} color="#ffb83c" />
          <StatCard label="Picked" value={stats.picked} color="#c07eff" />
          <StatCard label="Dispatched" value={stats.dispatched} color="#50d278" />
        </div>

        {/* ── Per-branch summary ─────────────────────────────────── */}
        {showBranchSummary && (
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #1a1a1a" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#0d0d0d" }}>
              <thead>
                <tr>
                  {["Branch", "Total Orders", "Dispatched", "Picking", "Awaiting Pick", "Avg Pick Time"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(branchSummary).sort(([a], [b]) => a.localeCompare(b)).map(([branch, s], i) => (
                  <tr key={branch} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                    <td style={{ ...tdBase, fontWeight: 700, color: "#fff", fontFamily: "monospace" }}>{branch}</td>
                    <td style={tdBase}>{s.total}</td>
                    <td style={{ ...tdBase, color: "#50d278" }}>{s.dispatched}</td>
                    <td style={{ ...tdBase, color: "#ffb83c" }}>{s.picking}</td>
                    <td style={{ ...tdBase, color: "#88aaff" }}>{s.received}</td>
                    <td style={tdBase}>{s.avgPickMins != null ? `${s.avgPickMins} min` : <span style={{ color: "#444" }}>—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Orders table ───────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.5rem" }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#ccc" }}>
            Order Details
          </h2>
          <span style={{ fontSize: "0.78rem", color: "#444" }}>{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <p style={{ color: "#444", fontSize: "0.9rem" }}>Loading orders…</p>
        ) : orders.length === 0 ? (
          <div style={{ padding: "3rem 0", textAlign: "center", color: "#444", fontSize: "0.9rem" }}>
            No orders found for the selected filters.
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #1a1a1a" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#0d0d0d", minWidth: 820 }}>
              <thead>
                <tr>
                  {["Order No", "Branch", "Items", "Status", "Received", "Picker", "Pick Started", "Pick Duration", "Dispatch Time", "Total Duration"].map((h) => (
                    <th key={h} style={thStyle}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const pickDur = diffMins(o.pickingStartedAt, o.pickedAt);
                  const totalDur = diffMins(o.receivedAt, o.dispatchedAt);
                  return (
                    <tr key={o.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      <td style={{ ...tdBase, fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem", color: "#ccc", whiteSpace: "nowrap" }}>
                        {o.orderNumber}
                      </td>
                      <td style={{ ...tdBase, fontFamily: "monospace", color: "#888", fontSize: "0.82rem" }}>{o.branchCode}</td>
                      <td style={{ ...tdBase, textAlign: "center" }}>{o.itemCount}</td>
                      <td style={tdBase}><StatusBadge status={o.status} /></td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap" }}>{fmt(o.receivedAt)}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                        {o.assignedPickerName
                          ? <span>{o.assignedPickerName}<br /><span style={{ fontSize: "0.74rem", color: "#555", fontFamily: "monospace" }}>{o.assignedPickerId}</span></span>
                          : <span style={{ color: "#3a3a3a" }}>Unassigned</span>}
                      </td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.pickingStartedAt ? "#ddd" : "#3a3a3a" }}>{fmt(o.pickingStartedAt)}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.pickedAt ? "#c07eff" : "#3a3a3a", fontWeight: 600 }}>{pickDur}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.dispatchedAt ? "#50d278" : "#3a3a3a" }}>{fmt(o.dispatchedAt)}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.dispatchedAt ? "#50d278" : "#3a3a3a", fontWeight: 600 }}>{totalDur}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
