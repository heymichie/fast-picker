import { useEffect, useState, useCallback, useRef } from "react";
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

const NEXT_STATUS: Record<string, { label: string; next: string } | null> = {
  received:   { label: "Start Picking", next: "picking" },
  picking:    { label: "Mark Picked",   next: "picked" },
  picked:     { label: "Dispatch",      next: "dispatched" },
  dispatched: null,
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? { label: status, bg: "#333", color: "#aaa" };
  return (
    <span style={{ background: m.bg, color: m.color, padding: "0.22rem 0.65rem", borderRadius: 20, fontSize: "0.78rem", fontWeight: 700, whiteSpace: "nowrap" }}>
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

const STATUSES = ["all", "received", "picking", "picked"];

export default function PickOrders() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  const isAdmin = user?.isAdmin === true;
  const canReassign = isAdmin
    || user?.designation === "Store Manager"
    || user?.designation === "Store Supervisor";

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [advancing, setAdvancing] = useState<Set<string>>(new Set());
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Modal state
  const [detailOrder, setDetailOrder] = useState<string | null>(null);

  // Focus order — passed via ?focus=ORD-XXX when arriving from "Pick Order" button
  const [focusOrder] = useState<string | null>(() => {
    try { return new URLSearchParams(window.location.search).get("focus"); }
    catch { return null; }
  });
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  // If arriving from "Pick Order", pre-filter to "picking"
  useEffect(() => {
    if (focusOrder) setStatusFilter("picking");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to and flash the focused row after orders load
  useEffect(() => {
    if (!focusOrder || orders.length === 0) return;
    const el = rowRefs.current[focusOrder];
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [orders, focusOrder]);

  const fetchOrders = useCallback(() => {
    const params = new URLSearchParams();
    if (user?.username) params.set("pickerId", user.username);
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/orders?${params}`)
      .then((r) => r.json())
      .then((data: Order[]) => {
        // Exclude dispatched orders — pick orders shows only active work
        const active = Array.isArray(data) ? data.filter((o) => o.status !== "dispatched") : [];
        setOrders(active);
        setLastRefresh(new Date());
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, [user?.username, statusFilter]);

  useEffect(() => { setLoading(true); fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    const id = setInterval(fetchOrders, 30_000);
    return () => clearInterval(id);
  }, [fetchOrders]);

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

  const stats = {
    total: orders.length,
    received: orders.filter((o) => o.status === "received").length,
    picking: orders.filter((o) => o.status === "picking").length,
    picked: orders.filter((o) => o.status === "picked").length,
  };

  // Performance summary from current orders list
  type PerfRow = { pickerName: string; excellent: number; good: number; couldImprove: number; poor: number; total: number };
  const perfByPicker: Record<string, PerfRow> = {};
  for (const o of orders) {
    if (!o.pickingStartedAt || !o.pickedAt || !o.assignedPickerId) continue;
    const mins = diffMinsRaw(o.pickingStartedAt, o.pickedAt);
    const r = pickRating(mins, o.itemCount);
    if (!r) continue;
    if (!perfByPicker[o.assignedPickerId]) {
      perfByPicker[o.assignedPickerId] = { pickerName: o.assignedPickerName ?? o.assignedPickerId, excellent: 0, good: 0, couldImprove: 0, poor: 0, total: 0 };
    }
    perfByPicker[o.assignedPickerId].total++;
    if (r.label === "Excellent")          perfByPicker[o.assignedPickerId].excellent++;
    else if (r.label === "Good")          perfByPicker[o.assignedPickerId].good++;
    else if (r.label === "Could Improve") perfByPicker[o.assignedPickerId].couldImprove++;
    else                                  perfByPicker[o.assignedPickerId].poor++;
  }
  const perfRows = Object.entries(perfByPicker).sort(([, a], [, b]) => b.total - a.total);

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
            Assigned to {user?.forenames} {user?.surname}
            {" · "}Refreshed at {lastRefresh.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
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

      {/* Focus banner — shown when arriving from "Pick Order" button */}
      {focusOrder && (
        <div style={{
          margin: "0.5rem 1.5rem 0",
          background: "rgba(80,210,120,0.08)", border: "1px solid rgba(80,210,120,0.28)",
          borderRadius: 10, padding: "0.7rem 1.1rem",
          display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap",
        }}>
          <span style={{ fontSize: "1.1rem" }}>🟢</span>
          <div>
            <div style={{ color: "#50d278", fontWeight: 700, fontSize: "0.9rem" }}>
              You are now picking order <span style={{ fontFamily: "monospace" }}>{focusOrder}</span>
            </div>
            <div style={{ color: "#557755", fontSize: "0.78rem", marginTop: 2 }}>
              The order is highlighted below. Use the action button on the row to advance it when ready.
            </div>
          </div>
        </div>
      )}

      <div style={{ flex: 1, padding: "1rem 1.5rem 2.5rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Status filter */}
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
                {s === "all" ? "All Active" : STATUS_META[s]?.label ?? s}
              </button>
            );
          })}
        </div>

        {/* Stat cards */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {[
            { label: "Active Orders", value: stats.total,    color: "#fff" },
            { label: "Received",      value: stats.received, color: "#88aaff" },
            { label: "Picking",       value: stats.picking,  color: "#ffb83c" },
            { label: "Picked",        value: stats.picked,   color: "#c07eff" },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ background: "#111", border: "1px solid #222", borderRadius: 12, padding: "1.1rem 1.4rem", minWidth: 110, display: "flex", flexDirection: "column", gap: "0.3rem" }}>
              <span style={{ fontSize: "2rem", fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
              <span style={{ fontSize: "0.78rem", color: "#666", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
            </div>
          ))}
        </div>

        {/* Orders table header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700, color: "#ccc" }}>My Assigned Orders</h2>
          <span style={{ fontSize: "0.78rem", color: "#444" }}>{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
        </div>

        {loading ? (
          <p style={{ color: "#444", fontSize: "0.9rem" }}>Loading orders…</p>
        ) : orders.length === 0 ? (
          <div style={{ padding: "3rem 0", textAlign: "center", color: "#444", fontSize: "0.9rem" }}>
            No active orders assigned to you.
          </div>
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #1a1a1a" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#0d0d0d", minWidth: 720 }}>
              <thead>
                <tr>
                  <th style={thStyle}>Order No</th>
                  <th style={thStyle}>Branch</th>
                  <th style={thStyle}>Items</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Received</th>
                  <th style={thStyle}>Pick Started</th>
                  <th style={thStyle}>Pick Duration</th>
                  <th style={thStyle}>Comment</th>
                  <th style={thStyle}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o, i) => {
                  const pickDur = diffMins(o.pickingStartedAt, o.pickedAt);
                  const pickMinsRaw = diffMinsRaw(o.pickingStartedAt, o.pickedAt);
                  const rating = pickRating(pickMinsRaw, o.itemCount);
                  const next = NEXT_STATUS[o.status];
                  const isAdvancing = advancing.has(o.orderNumber);
                  const isFocused = o.orderNumber === focusOrder;
                  return (
                    <tr
                      key={o.id}
                      ref={(el) => { rowRefs.current[o.orderNumber] = el; }}
                      style={{
                        background: isFocused
                          ? "rgba(80,210,120,0.09)"
                          : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                        outline: isFocused ? "1.5px solid rgba(80,210,120,0.4)" : "none",
                        outlineOffset: -1,
                      }}
                    >
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
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: o.pickingStartedAt ? "#ddd" : "#3a3a3a" }}>{fmt(o.pickingStartedAt)}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap", color: rating ? rating.color : (o.pickedAt ? "#c07eff" : "#3a3a3a"), fontWeight: 600 }}>{pickDur}</td>
                      <td style={{ ...tdBase, whiteSpace: "nowrap" }}>
                        {rating ? <RatingBadge rating={rating} /> : <span style={{ color: "#333" }}>—</span>}
                      </td>
                      <td style={tdBase}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          {next ? (
                            <button
                              type="button"
                              disabled={isAdvancing}
                              onClick={() => advanceStatus(o.orderNumber, next.next)}
                              style={{
                                background: isFocused ? "#1a4a2a" : "#1a4a1a",
                                border: `1px solid ${isFocused ? "#2a7a3a" : "#2a7a2a"}`,
                                color: "#50d278", padding: "0.3rem 0.75rem", borderRadius: 6,
                                fontSize: "0.78rem", fontWeight: 700,
                                cursor: isAdvancing ? "not-allowed" : "pointer",
                                opacity: isAdvancing ? 0.6 : 1, whiteSpace: "nowrap",
                              }}
                            >
                              {isAdvancing ? "…" : next.label}
                            </button>
                          ) : (
                            <span style={{ color: "#2a5a2a", fontSize: "0.78rem", fontWeight: 700 }}>✓ Done</span>
                          )}
                        </div>
                      </td>
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
              My Performance Summary
            </h2>
            <div style={{ overflowX: "auto", borderRadius: 10, border: "1px solid #1a1a1a" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: "#0d0d0d", minWidth: 480 }}>
                <thead>
                  <tr>
                    {["", "Orders Picked", "Excellent", "Good", "Could Improve", "Poor"].map((h) => (
                      <th key={h} style={{ ...thStyle, textAlign: h === "" ? "left" : "center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {perfRows.map(([pickerId, row], i) => (
                    <tr key={pickerId} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                      <td style={{ ...tdBase, fontWeight: 600, color: "#fff" }}>You</td>
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
              Excellent &lt;1 min/item · Good = 1 min/item · Could Improve 1–2 min/item · Poor &gt;2 min/item
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
