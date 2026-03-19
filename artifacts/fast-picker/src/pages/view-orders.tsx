import { useEffect, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { LiveClock } from "@/components/LiveClock";
import { OrderDetailModal } from "@/components/OrderDetailModal";

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

function diffMinsRaw(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return (new Date(to).getTime() - new Date(from).getTime()) / 60_000;
}

interface Rating { label: string; color: string; bg: string }
function pickRating(durationMins: number | null, items: number): Rating | null {
  if (durationMins === null || !items) return null;
  const rate = durationMins / items;
  if (rate < 1)  return { label: "Excellent",     color: "#50d278", bg: "rgba(80,210,120,0.13)" };
  if (rate === 1) return { label: "Good",          color: "#88aaff", bg: "rgba(100,140,255,0.13)" };
  if (rate <= 2)  return { label: "Could Improve", color: "#ffb83c", bg: "rgba(255,180,60,0.13)" };
  return           { label: "Poor",          color: "#ff5a5a", bg: "rgba(255,80,80,0.13)" };
}

function RatingBadge({ rating }: { rating: Rating }) {
  return (
    <span style={{
      background: rating.bg, color: rating.color, padding: "0.2rem 0.6rem",
      borderRadius: 20, fontSize: "0.74rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {rating.label}
    </span>
  );
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  received:   { label: "Received",   bg: "rgba(100,140,255,0.15)", color: "#88aaff" },
  picking:    { label: "Picking",    bg: "rgba(255,180,60,0.15)",  color: "#ffb83c" },
  picked:     { label: "Picked",     bg: "rgba(160,90,255,0.15)",  color: "#c07eff" },
  dispatched: { label: "Dispatched", bg: "rgba(80,210,120,0.15)",  color: "#50d278" },
};

const STATUSES = ["all", "received", "picking", "picked", "dispatched"];

type SortCol = "items" | "status" | "received" | "picker" | "pickDuration" | "comment";
type SortDir = "asc" | "desc";

const STATUS_ORDER: Record<string, number> = { received: 0, picking: 1, picked: 2, dispatched: 3 };
const RATING_ORDER: Record<string, number> = { Excellent: 0, Good: 1, "Could Improve": 2, Poor: 3 };

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

function SortableHeader({
  label, col, active, dir, onSort,
}: {
  label: string; col: SortCol; active: boolean; dir: SortDir; onSort: (c: SortCol) => void;
}) {
  return (
    <th
      onClick={() => onSort(col)}
      style={{
        ...thStyle, cursor: "pointer", userSelect: "none",
        color: active ? "#fff" : "#777",
        background: active ? "#121212" : "#0d0d0d",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {label}
        <span style={{ fontSize: "0.65rem", opacity: active ? 1 : 0.3, lineHeight: 1 }}>
          {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
        </span>
      </span>
    </th>
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

export default function ViewOrders() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  const isOrderPicker = user?.designation === "Order Picker";
  const isAdmin = user?.isAdmin === true;
  const canReassign = isAdmin
    || user?.designation === "Store Manager"
    || user?.designation === "Store Supervisor";
  const canPickOrder = user?.designation === "Store Manager"
    || user?.designation === "Store Supervisor";

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("all");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Sort state
  const [sortCol, setSortCol] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(col: SortCol) {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  }

  // Modal state — supports ?order=ORD-xxx URL param to auto-open
  const [detailOrder, setDetailOrder] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("order");
  });

  // Pick Order (manager/supervisor self-assign + start picking)
  const [pickingOrder, setPickingOrder] = useState<string | null>(null);

  async function handlePickOrder(orderNumber: string) {
    if (!user) return;
    setPickingOrder(orderNumber);
    try {
      const pickerName = `${user.forenames} ${user.surname}`;
      await fetch(`/api/orders/${orderNumber}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickerId: user.username, pickerName }),
      });
      await fetch(`/api/orders/${orderNumber}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "picking" }),
      });
      setLocation(`/pick-orders?focus=${orderNumber}`);
    } catch {
      alert("Failed to start picking. Please try again.");
    } finally {
      setPickingOrder(null);
    }
  }

  function buildParams(statusOverride?: string) {
    const params = new URLSearchParams();
    if (isOrderPicker && user?.username) {
      params.set("pickerId", user.username);
    } else {
      if (selectedBranch && selectedBranch !== "ALL") params.set("branchCode", selectedBranch);
    }
    const s = statusOverride ?? statusFilter;
    if (s && s !== "all") params.set("status", s);
    return params;
  }

  // Load branches — Order Pickers don't need branch filter
  useEffect(() => {
    if (isOrderPicker) return;
    if (isAdmin || user?.branchCode === "ALL") {
      fetch("/api/orders/branches")
        .then((r) => r.json())
        .then((data: string[]) => { setBranches(["ALL", ...data]); setSelectedBranch("ALL"); })
        .catch(() => setBranches(["ALL"]));
    } else if (user?.branchCode) {
      setBranches([user.branchCode]);
      setSelectedBranch(user.branchCode);
    }
  }, []);

  const fetchOrders = useCallback(() => {
    fetch(`/api/orders?${buildParams()}`)
      .then((r) => r.json())
      .then((data: Order[]) => { setOrders(Array.isArray(data) ? data : []); setLastRefresh(new Date()); })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [selectedBranch, statusFilter]);

  useEffect(() => { setLoading(true); fetchOrders(); }, [fetchOrders]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(fetchOrders, 60_000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // Stats (all statuses, same branch/picker filter)
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  useEffect(() => {
    fetch(`/api/orders?${buildParams("all")}`)
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

  // Per-branch summary
  const branchSummary: Record<string, { total: number; dispatched: number; picking: number; received: number; avgPickMins: number | null }> = {};
  for (const o of allOrders) {
    if (!branchSummary[o.branchCode]) branchSummary[o.branchCode] = { total: 0, dispatched: 0, picking: 0, received: 0, avgPickMins: null };
    branchSummary[o.branchCode].total++;
    if (o.status === "dispatched") branchSummary[o.branchCode].dispatched++;
    if (o.status === "picking")    branchSummary[o.branchCode].picking++;
    if (o.status === "received")   branchSummary[o.branchCode].received++;
  }
  const pickTimes: Record<string, number[]> = {};
  for (const o of allOrders) {
    if (o.pickingStartedAt && o.pickedAt) {
      if (!pickTimes[o.branchCode]) pickTimes[o.branchCode] = [];
      pickTimes[o.branchCode].push((new Date(o.pickedAt).getTime() - new Date(o.pickingStartedAt).getTime()) / 60_000);
    }
  }
  for (const b of Object.keys(branchSummary)) {
    const times = pickTimes[b];
    if (times?.length) branchSummary[b].avgPickMins = Math.round(times.reduce((a, c) => a + c, 0) / times.length);
  }
  const showBranchSummary = selectedBranch === "ALL" && Object.keys(branchSummary).length > 0;

  // Performance summary — grouped by picker, from all orders with a completed pick
  type PerfRow = { pickerName: string; excellent: number; good: number; couldImprove: number; poor: number; total: number };
  const perfByPicker: Record<string, PerfRow> = {};
  for (const o of allOrders) {
    if (!o.pickingStartedAt || !o.pickedAt || !o.assignedPickerId) continue;
    const mins = diffMinsRaw(o.pickingStartedAt, o.pickedAt);
    const r = pickRating(mins, o.itemCount);
    if (!r) continue;
    if (!perfByPicker[o.assignedPickerId]) {
      perfByPicker[o.assignedPickerId] = { pickerName: o.assignedPickerName ?? o.assignedPickerId, excellent: 0, good: 0, couldImprove: 0, poor: 0, total: 0 };
    }
    perfByPicker[o.assignedPickerId].total++;
    if (r.label === "Excellent")     perfByPicker[o.assignedPickerId].excellent++;
    else if (r.label === "Good")     perfByPicker[o.assignedPickerId].good++;
    else if (r.label === "Could Improve") perfByPicker[o.assignedPickerId].couldImprove++;
    else                             perfByPicker[o.assignedPickerId].poor++;
  }
  const perfRows = Object.entries(perfByPicker).sort(([, a], [, b]) => b.total - a.total);

  // Sorted orders
  const sortedOrders = sortCol
    ? [...orders].sort((a, b) => {
        let cmp = 0;
        if (sortCol === "items") {
          cmp = a.itemCount - b.itemCount;
        } else if (sortCol === "status") {
          cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
        } else if (sortCol === "received") {
          cmp = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
        } else if (sortCol === "picker") {
          cmp = (a.assignedPickerName ?? "").localeCompare(b.assignedPickerName ?? "");
        } else if (sortCol === "pickDuration") {
          const ad = diffMinsRaw(a.pickingStartedAt, a.pickedAt);
          const bd = diffMinsRaw(b.pickingStartedAt, b.pickedAt);
          if (ad === null && bd === null) cmp = 0;
          else if (ad === null) cmp = 1;
          else if (bd === null) cmp = -1;
          else cmp = ad - bd;
        } else if (sortCol === "comment") {
          const ar = pickRating(diffMinsRaw(a.pickingStartedAt, a.pickedAt), a.itemCount);
          const br = pickRating(diffMinsRaw(b.pickingStartedAt, b.pickedAt), b.itemCount);
          const ao = ar ? (RATING_ORDER[ar.label] ?? 99) : 99;
          const bo = br ? (RATING_ORDER[br.label] ?? 99) : 99;
          cmp = ao - bo;
        }
        return sortDir === "asc" ? cmp : -cmp;
      })
    : orders;

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

        {/* Filters */}
        {!isOrderPicker && (
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
                      padding: "0.3rem 0.85rem", borderRadius: 20, fontSize: "0.82rem",
                      fontWeight: active ? 700 : 500, cursor: "pointer",
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
        )}

        {/* Stat cards */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <StatCard label="Total Today" value={stats.total}      color="#fff" />
          <StatCard label="Received"    value={stats.received}   color="#88aaff" />
          <StatCard label="Picking"     value={stats.picking}    color="#ffb83c" />
          <StatCard label="Picked"      value={stats.picked}     color="#c07eff" />
          <StatCard label="Dispatched"  value={stats.dispatched} color="#50d278" />
        </div>

        {/* Per-branch summary */}
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

        {/* Orders table */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#ccc" }}>Order Details</h2>
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
                  <th style={thStyle}>Order No</th>
                  <th style={thStyle}>Branch</th>
                  <SortableHeader label="Items"         col="items"        active={sortCol === "items"}        dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Status"        col="status"       active={sortCol === "status"}       dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Received"      col="received"     active={sortCol === "received"}     dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Picker"        col="picker"       active={sortCol === "picker"}       dir={sortDir} onSort={handleSort} />
                  <th style={thStyle}>Pick Started</th>
                  <SortableHeader label="Pick Duration" col="pickDuration" active={sortCol === "pickDuration"} dir={sortDir} onSort={handleSort} />
                  <SortableHeader label="Comment"       col="comment"      active={sortCol === "comment"}      dir={sortDir} onSort={handleSort} />
                  <th style={thStyle}>Dispatch Time</th>
                  <th style={thStyle}>Total Duration</th>
                  {canReassign && <th style={thStyle}></th>}
                </tr>
              </thead>
              <tbody>
                {sortedOrders.map((o, i) => {
                  const pickDur = diffMins(o.pickingStartedAt, o.pickedAt);
                  const pickMinsRaw = diffMinsRaw(o.pickingStartedAt, o.pickedAt);
                  const rating = pickRating(pickMinsRaw, o.itemCount);
                  const totalDur = diffMins(o.receivedAt, o.dispatchedAt);
                  return (
                    <tr key={o.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      {/* Clickable order number */}
                      <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                        <button
                          type="button"
                          onClick={() => setDetailOrder(o.orderNumber)}
                          style={{
                            background: "none", border: "none", padding: 0, cursor: "pointer",
                            fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem",
                            color: "#88aaff", textDecoration: "underline", textDecorationColor: "rgba(136,170,255,0.3)",
                            textUnderlineOffset: 3,
                          }}
                        >
                          {o.orderNumber}
                        </button>
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
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: rating ? rating.color : (o.pickedAt ? "#c07eff" : "#3a3a3a"), fontWeight: 600 }}>{pickDur}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                        {rating ? <RatingBadge rating={rating} /> : <span style={{ color: "#333" }}>—</span>}
                      </td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.dispatchedAt ? "#50d278" : "#3a3a3a" }}>{fmt(o.dispatchedAt)}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.dispatchedAt ? "#50d278" : "#3a3a3a", fontWeight: 600 }}>{totalDur}</td>
                      {canReassign && (
                        <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                          {o.status === "received" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                              <button
                                type="button"
                                onClick={() => setDetailOrder(o.orderNumber)}
                                style={{
                                  background: "#1a1a2a", border: "1px solid #3a3a6a",
                                  color: "#88aaff", padding: "0.28rem 0.7rem", borderRadius: 6,
                                  fontSize: "0.76rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                                }}
                              >
                                Reassign
                              </button>
                              {canPickOrder && (
                                <button
                                  type="button"
                                  disabled={pickingOrder === o.orderNumber}
                                  onClick={() => handlePickOrder(o.orderNumber)}
                                  style={{
                                    background: pickingOrder === o.orderNumber ? "#1a2a1a" : "#162a16",
                                    border: "1px solid #3a6a3a",
                                    color: pickingOrder === o.orderNumber ? "#557755" : "#50d278",
                                    padding: "0.28rem 0.7rem", borderRadius: 6,
                                    fontSize: "0.76rem", fontWeight: 700,
                                    cursor: pickingOrder === o.orderNumber ? "not-allowed" : "pointer",
                                    whiteSpace: "nowrap", opacity: pickingOrder === o.orderNumber ? 0.6 : 1,
                                  }}
                                >
                                  {pickingOrder === o.orderNumber ? "Starting…" : "Pick Order"}
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Performance Summary */}
        {perfRows.length > 0 && (
          <div>
            <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.95rem", fontWeight: 700, color: "#ccc" }}>
              Picker Performance Summary
            </h2>
            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #1a1a1a" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#0d0d0d", minWidth: 540 }}>
                <thead>
                  <tr>
                    {["Picker", "Orders Picked", "Excellent", "Good", "Could Improve", "Poor"].map((h) => (
                      <th key={h} style={{ ...thStyle, textAlign: h === "Picker" ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perfRows.map(([pickerId, row], i) => (
                    <tr key={pickerId} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      <td style={{ ...tdBase, fontWeight: 600, color: "#fff" }}>
                        {row.pickerName}
                        <span style={{ marginLeft: 8, fontSize: "0.73rem", color: "#444", fontFamily: "monospace" }}>{pickerId}</span>
                      </td>
                      <td style={{ ...tdBase, textAlign: "center", color: "#888" }}>{row.total}</td>
                      <td style={{ ...tdBase, textAlign: "center" }}>
                        {row.excellent > 0 ? <span style={{ color: "#50d278", fontWeight: 700 }}>{row.excellent}</span> : <span style={{ color: "#2a2a2a" }}>—</span>}
                      </td>
                      <td style={{ ...tdBase, textAlign: "center" }}>
                        {row.good > 0 ? <span style={{ color: "#88aaff", fontWeight: 700 }}>{row.good}</span> : <span style={{ color: "#2a2a2a" }}>—</span>}
                      </td>
                      <td style={{ ...tdBase, textAlign: "center" }}>
                        {row.couldImprove > 0 ? <span style={{ color: "#ffb83c", fontWeight: 700 }}>{row.couldImprove}</span> : <span style={{ color: "#2a2a2a" }}>—</span>}
                      </td>
                      <td style={{ ...tdBase, textAlign: "center" }}>
                        {row.poor > 0 ? <span style={{ color: "#ff5a5a", fontWeight: 700 }}>{row.poor}</span> : <span style={{ color: "#2a2a2a" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ margin: "0.5rem 0 0", fontSize: "0.72rem", color: "#444" }}>
              Ratings based on pick speed per item — Excellent &lt;1 min/item · Good = 1 min/item · Could Improve 1–2 min/item · Poor &gt;2 min/item
            </p>
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      <OrderDetailModal
        orderNumber={detailOrder}
        canReassign={canReassign}
        onClose={() => setDetailOrder(null)}
        onReassigned={() => { fetchOrders(); }}
        onDispatched={() => { fetchOrders(); }}
      />
    </div>
  );
}
