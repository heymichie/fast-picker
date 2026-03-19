import { useEffect, useState, useCallback } from "react";
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
  departmentCounts: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────
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
  received:   { label: "Received",   bg: "rgba(100,140,255,0.15)", color: "#88aaff" },
  picking:    { label: "Picking",    bg: "rgba(255,180,60,0.15)",  color: "#ffb83c" },
  picked:     { label: "Picked",     bg: "rgba(160,90,255,0.15)",  color: "#c07eff" },
  dispatched: { label: "Dispatched", bg: "rgba(80,210,120,0.15)",  color: "#50d278" },
};

// Status the picker can advance to next
const NEXT_STATUS: Record<string, { label: string; next: string } | null> = {
  received:   { label: "Start Picking", next: "picking" },
  picking:    { label: "Mark Picked",   next: "picked" },
  picked:     { label: "Dispatch",      next: "dispatched" },
  dispatched: null,
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, bg: "#333", color: "#aaa" };
  return (
    <span style={{
      background: m.bg, color: m.color, padding: "0.22rem 0.65rem",
      borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap",
    }}>
      {m.label}
    </span>
  );
}

const thStyle: React.CSSProperties = {
  padding: "0.6rem 0.85rem", textAlign: "left", fontSize: "0.72rem", fontWeight: 700,
  color: "#777", textTransform: "uppercase", letterSpacing: "0.07em",
  borderBottom: "1px solid #222", whiteSpace: "nowrap", background: "#0d0d0d",
};
const tdBase: React.CSSProperties = {
  padding: "0.7rem 0.85rem", fontSize: "0.85rem", color: "#ddd",
  borderBottom: "1px solid #1a1a1a", verticalAlign: "middle",
};

const STATUSES = ["all", "received", "picking", "picked", "dispatched"];

// ── Component ─────────────────────────────────────────────────────────
export default function PickOrders() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  const isOrderPicker = user?.designation === "Order Picker";
  const isAdmin = user?.isAdmin === true;

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("ALL");
  const [advancing, setAdvancing] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Set up available branches for non-picker roles
  useEffect(() => {
    if (isOrderPicker) return; // pickers see their own orders regardless of branch
    if (isAdmin) {
      fetch("/api/orders/branches")
        .then((r) => r.json())
        .then((data: string[]) => setBranches(["ALL", ...data]))
        .catch(() => setBranches(["ALL"]));
    } else if (user?.branchCode) {
      setBranches([user.branchCode]);
      setSelectedBranch(user.branchCode);
    }
  }, []);

  const fetchOrders = useCallback(() => {
    const params = new URLSearchParams();
    if (isOrderPicker && user?.username) {
      // Order Pickers only see their own assigned orders
      params.set("pickerId", user.username);
    } else {
      if (selectedBranch && selectedBranch !== "ALL") params.set("branchCode", selectedBranch);
    }
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then((data: Order[]) => { setOrders(Array.isArray(data) ? data : []); setLastRefresh(new Date()); })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [isOrderPicker, user?.username, selectedBranch, statusFilter]);

  useEffect(() => {
    setLoading(true);
    fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const id = setInterval(fetchOrders, 30_000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  // Advance an order's status
  async function advanceStatus(orderNumber: string, nextStatus: string) {
    setAdvancing((prev) => new Set(prev).add(orderNumber));
    try {
      await fetch(`/api/orders/${orderNumber}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      fetchOrders();
    } catch {
      alert("Failed to update order status. Please try again.");
    } finally {
      setAdvancing((prev) => { const n = new Set(prev); n.delete(orderNumber); return n; });
    }
  }

  // Stats from current visible orders
  const allVisible = orders; // (filtered by API already)
  const stats = {
    total: allVisible.length,
    received: allVisible.filter((o) => o.status === "received").length,
    picking: allVisible.filter((o) => o.status === "picking").length,
    picked: allVisible.filter((o) => o.status === "picked").length,
    dispatched: allVisible.filter((o) => o.status === "dispatched").length,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.5rem", gap: "1rem", borderBottom: "1px solid #1a1a1a", flexShrink: 0 }}>
        <button onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center" }}>
          <img src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`} alt="Fast Picker" style={{ height: 52, objectFit: "contain" }} />
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", margin: 0, lineHeight: 1 }}>Pick Orders</h1>
          <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "#555" }}>
            {isOrderPicker ? `Showing orders assigned to ${user?.forenames} ${user?.surname}` : "All orders"}{" "}
            · Refreshed at {lastRefresh.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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
        {" / Pick Orders"}
      </div>

      <div style={{ flex: 1, padding: "1rem 1.5rem 2.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Filters — only shown to non-picker roles */}
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

        {/* Status filter for Order Pickers */}
        {isOrderPicker && (
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
                  {s === "all" ? "All" : STATUS_META[s]?.label ?? s}
                </button>
              );
            })}
          </div>
        )}

        {/* Stat cards */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { label: isOrderPicker ? "My Orders" : "Total", value: stats.total, color: "#fff" },
            { label: "Received",   value: stats.received,   color: "#88aaff" },
            { label: "Picking",    value: stats.picking,    color: "#ffb83c" },
            { label: "Picked",     value: stats.picked,     color: "#c07eff" },
            { label: "Dispatched", value: stats.dispatched, color: "#50d278" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{
              background: "#111", border: "1px solid #222", borderRadius: 12,
              padding: "1.1rem 1.4rem", minWidth: 110, display: "flex", flexDirection: "column", gap: "0.3rem",
            }}>
              <span style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
              <span style={{ fontSize: "0.78rem", color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Orders table */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#ccc" }}>
            {isOrderPicker ? "My Assigned Orders" : "All Orders"}
          </h2>
          <span style={{ fontSize: "0.78rem", color: "#444" }}>{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <p style={{ color: "#444", fontSize: "0.9rem" }}>Loading orders…</p>
        ) : orders.length === 0 ? (
          <div style={{ padding: "3rem 0", textAlign: "center", color: "#444", fontSize: "0.9rem" }}>
            {isOrderPicker ? "No orders assigned to you." : "No orders found for the selected filters."}
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #1a1a1a" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#0d0d0d", minWidth: isOrderPicker ? 700 : 900 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Order No</th>
                  {!isOrderPicker && <th style={thStyle}>Branch</th>}
                  <th style={thStyle}>Items</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Received</th>
                  {!isOrderPicker && <th style={thStyle}>Assigned Picker</th>}
                  <th style={thStyle}>Pick Started</th>
                  <th style={thStyle}>Pick Duration</th>
                  <th style={thStyle}>Dispatched</th>
                  {isOrderPicker && <th style={thStyle}>Action</th>}
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const pickDur = diffMins(o.pickingStartedAt, o.pickedAt);
                  const next = NEXT_STATUS[o.status];
                  const isAdvancing = advancing.has(o.orderNumber);
                  return (
                    <tr key={o.id} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      <td style={{ ...tdBase, fontFamily: "monospace", fontWeight: 700, fontSize: "0.8rem", color: "#ccc", whiteSpace: "nowrap" }}>
                        {o.orderNumber}
                      </td>
                      {!isOrderPicker && (
                        <td style={{ ...tdBase, fontFamily: "monospace", color: "#888", fontSize: "0.82rem" }}>{o.branchCode}</td>
                      )}
                      <td style={{ ...tdBase, textAlign: "center" }}>{o.itemCount}</td>
                      <td style={tdBase}><StatusBadge status={o.status} /></td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap" }}>{fmt(o.receivedAt)}</td>
                      {!isOrderPicker && (
                        <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                          {o.assignedPickerName
                            ? <span>{o.assignedPickerName}<br /><span style={{ fontSize: "0.74rem", color: "#555", fontFamily: "monospace" }}>{o.assignedPickerId}</span></span>
                            : <span style={{ color: "#3a3a3a" }}>Unassigned</span>}
                        </td>
                      )}
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.pickingStartedAt ? "#ddd" : "#3a3a3a" }}>{fmt(o.pickingStartedAt)}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.pickedAt ? "#c07eff" : "#3a3a3a", fontWeight: 600 }}>{pickDur}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.dispatchedAt ? "#50d278" : "#3a3a3a" }}>{fmt(o.dispatchedAt)}</td>
                      {isOrderPicker && (
                        <td style={tdBase}>
                          {next ? (
                            <button
                              type="button"
                              disabled={isAdvancing}
                              onClick={() => advanceStatus(o.orderNumber, next.next)}
                              style={{
                                background: "#1a4a1a", border: "1px solid #2a7a2a",
                                color: "#50d278", padding: "0.3rem 0.75rem", borderRadius: 6,
                                fontSize: "0.78rem", fontWeight: 700, cursor: isAdvancing ? "not-allowed" : "pointer",
                                opacity: isAdvancing ? 0.6 : 1, whiteSpace: "nowrap",
                              }}
                            >
                              {isAdvancing ? "…" : next.label}
                            </button>
                          ) : (
                            <span style={{ color: "#2a5a2a", fontSize: "0.78rem", fontWeight: 700 }}>✓ Done</span>
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
      </div>
    </div>
  );
}
