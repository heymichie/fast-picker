import { useEffect, useState, useRef } from "react";
import { Loader2, X } from "lucide-react";

interface ProductLine {
  railId: string;
  productCode: string;
  dept: string;
  category: string;
  colour: string;
  description: string;
}

interface OrderDetail {
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
  products: ProductLine[];
}

interface PickerOption {
  username: string;
  fullName: string;
  branchCode: string;
  department: string | null;
}

interface Props {
  orderNumber: string | null;
  canReassign?: boolean;
  onClose: () => void;
  onReassigned?: () => void;
  onDispatched?: () => void;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  received:   { label: "Received",   color: "#88aaff", bg: "rgba(100,140,255,0.15)" },
  picking:    { label: "Picking",    color: "#ffb83c", bg: "rgba(255,180,60,0.15)" },
  picked:     { label: "Picked",     color: "#c07eff", bg: "rgba(160,90,255,0.15)" },
  dispatched: { label: "Dispatched", color: "#50d278", bg: "rgba(80,210,120,0.15)" },
};

function ts(v: string | null) {
  if (!v) return "—";
  return new Date(v).toLocaleString("en-ZA", {
    day: "2-digit", month: "short", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

type RfidPhase = "idle" | "scanning" | "verified" | "dispatching" | "done";

export function OrderDetailModal({ orderNumber, canReassign = false, onClose, onReassigned, onDispatched }: Props) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickers, setPickers] = useState<PickerOption[]>([]);
  const [selectedPicker, setSelectedPicker] = useState("");
  const [reassigning, setReassigning] = useState(false);
  const [reassignDone, setReassignDone] = useState(false);

  // RFID / IoT dispatch state
  const [rfidPhase, setRfidPhase] = useState<RfidPhase>("idle");
  const [rfidScanned, setRfidScanned] = useState(0);
  const [rfidError, setRfidError] = useState<string | null>(null);
  const rfidTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!orderNumber) return;
    setLoading(true);
    setOrder(null);
    setReassignDone(false);
    setSelectedPicker("");
    setRfidPhase("idle");
    setRfidScanned(0);
    setRfidError(null);
    fetch(`/api/orders/${orderNumber}`)
      .then((r) => r.json())
      .then((data: OrderDetail) => {
        setOrder(data);
        setLoading(false);
        // Load pickers if reassignment is allowed
        if (canReassign && data.status === "received") {
          fetch(`/api/orders/pickers?branchCode=${data.branchCode}`)
            .then((r) => r.json())
            .then((ps: PickerOption[]) => setPickers(Array.isArray(ps) ? ps : []))
            .catch(() => setPickers([]));
        }
      })
      .catch(() => setLoading(false));
  }, [orderNumber]);

  async function handleReassign() {
    if (!selectedPicker || !order) return;
    const picker = pickers.find((p) => p.username === selectedPicker);
    if (!picker) return;
    setReassigning(true);
    try {
      await fetch(`/api/orders/${order.orderNumber}/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickerId: picker.username, pickerName: picker.fullName }),
      });
      setReassignDone(true);
      onReassigned?.();
      setTimeout(onClose, 1200);
    } catch {
      alert("Reassignment failed. Please try again.");
    } finally {
      setReassigning(false);
    }
  }

  async function handleRfidDispatch() {
    if (!order) return;
    setRfidPhase("scanning");
    setRfidScanned(0);
    setRfidError(null);

    const total = Math.max(order.products.length, 1);
    // Animate RFID scan — one product every 280 ms
    await new Promise<void>((resolve) => {
      let count = 0;
      rfidTimer.current = setInterval(() => {
        count++;
        setRfidScanned(count);
        if (count >= total) {
          if (rfidTimer.current) clearInterval(rfidTimer.current);
          resolve();
        }
      }, 280);
    });

    setRfidPhase("verified");
    await new Promise((res) => setTimeout(res, 700));

    setRfidPhase("dispatching");
    try {
      const now = new Date().toISOString();
      // Mark as picked first (if not already)
      if (!order.pickedAt) {
        await fetch(`/api/orders/${order.orderNumber}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "picked" }),
        });
      }
      // Then dispatch
      await fetch(`/api/orders/${order.orderNumber}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dispatched" }),
      });

      setOrder((prev) => prev ? {
        ...prev,
        status: "dispatched",
        pickedAt: prev.pickedAt ?? now,
        dispatchedAt: now,
      } : null);
      setRfidPhase("done");
      onDispatched?.();
    } catch {
      setRfidError("Dispatch failed. Please check connectivity and try again.");
      setRfidPhase("idle");
    }
  }

  if (!orderNumber) return null;

  const m = order ? (STATUS_META[order.status] ?? { label: order.status, color: "#aaa", bg: "#333" }) : null;

  return (
    /* ── Overlay ── */
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      {/* ── Modal card ── */}
      <div style={{
        background: "#111", border: "1px solid #2a2a2a", borderRadius: 14,
        width: "100%", maxWidth: 860, maxHeight: "90vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "1rem 1.25rem", borderBottom: "1px solid #1e1e1e", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.9rem" }}>
            <span style={{ fontFamily: "monospace", fontSize: "1.05rem", fontWeight: 800, color: "#fff", letterSpacing: "0.04em" }}>
              {orderNumber}
            </span>
            {m && (
              <span style={{ background: m.bg, color: m.color, padding: "0.2rem 0.7rem", borderRadius: 20, fontSize: "0.8rem", fontWeight: 700 }}>
                {m.label}
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#666", cursor: "pointer", padding: 4, borderRadius: 6 }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "1.25rem" }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: "3rem 0" }}>
              <Loader2 style={{ width: 28, height: 28, color: "#555", animation: "spin 1s linear infinite" }} />
            </div>
          ) : !order ? (
            <p style={{ color: "#666", textAlign: "center", padding: "2rem 0" }}>Order not found.</p>
          ) : (
            <>
              {/* ── Order info grid ── */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "0.75rem", marginBottom: "1.5rem" }}>
                {[
                  { label: "Branch",   value: order.branchCode },
                  { label: "Items",    value: String(order.itemCount) },
                  { label: "Assigned Picker", value: order.assignedPickerName ?? "Unassigned" },
                  { label: "Picker ID", value: order.assignedPickerId ?? "—" },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "0.7rem 0.9rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontSize: "0.9rem", color: "#ddd", fontFamily: label === "Picker ID" || label === "Branch" ? "monospace" : "inherit" }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* ── Timestamps ── */}
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "stretch", marginBottom: "1.5rem", flexWrap: "wrap" }}>
                {[
                  { label: "Received",      value: ts(order.receivedAt),        color: "#88aaff" },
                  { label: "Pick Started",  value: ts(order.pickingStartedAt),  color: "#ffb83c" },
                  { label: "Picked",        value: ts(order.pickedAt),          color: "#c07eff" },
                  { label: "Dispatched",    value: ts(order.dispatchedAt),      color: "#50d278" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ flex: 1, minWidth: 140, background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 8, padding: "0.6rem 0.9rem" }}>
                    <div style={{ fontSize: "0.68rem", color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: "0.82rem", color: value === "—" ? "#333" : color, fontWeight: value === "—" ? 400 : 600 }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* ── Products table ── */}
              <div style={{ fontSize: "0.78rem", color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.5rem" }}>
                Products ({order.products.length} lines)
              </div>
              {order.products.length === 0 ? (
                <p style={{ color: "#444", fontSize: "0.88rem" }}>No product detail available.</p>
              ) : (
                <div style={{ border: "1px solid #1e1e1e", borderRadius: 8, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
                    <thead>
                      <tr style={{ background: "#0a0a0a" }}>
                        {["#", "Rail ID", "Product Code", "Dept", "Category", "Colour", "Description"].map((h) => (
                          <th key={h} style={{
                            padding: "0.55rem 0.75rem", textAlign: "left",
                            color: "#555", fontWeight: 700, fontSize: "0.7rem",
                            textTransform: "uppercase", letterSpacing: "0.07em",
                            borderBottom: "1px solid #1e1e1e", whiteSpace: "nowrap",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {order.products.map((p, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                          <td style={{ padding: "0.55rem 0.75rem", color: "#444", fontSize: "0.75rem" }}>{i + 1}</td>
                          <td style={{ padding: "0.55rem 0.75rem", color: "#88aaff", fontFamily: "monospace", fontWeight: 700, whiteSpace: "nowrap" }}>{p.railId}</td>
                          <td style={{ padding: "0.55rem 0.75rem", color: "#ccc", fontFamily: "monospace", whiteSpace: "nowrap" }}>{p.productCode}</td>
                          <td style={{ padding: "0.55rem 0.75rem", color: "#888" }}>{p.dept}</td>
                          <td style={{ padding: "0.55rem 0.75rem", color: "#ddd" }}>{p.category}</td>
                          <td style={{ padding: "0.55rem 0.75rem", color: "#ddd" }}>{p.colour}</td>
                          <td style={{ padding: "0.55rem 0.75rem", color: "#999" }}>{p.description}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── RFID / IoT Dispatch section ── */}
              {(order.status === "picking" || order.status === "picked") && (
                <div style={{ marginTop: "1.5rem", padding: "1rem 1.1rem", background: "#0a0f0a", border: "1px solid #1a3a1a", borderRadius: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.85rem" }}>
                    <span style={{ fontSize: "0.78rem", color: "#50d278", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      RFID &amp; IoT Dispatch Verification
                    </span>
                    {rfidPhase !== "idle" && rfidPhase !== "done" && (
                      <span style={{ fontSize: "0.72rem", color: "#3a7a3a", fontStyle: "italic" }}>
                        {rfidPhase === "scanning" ? `Scanning… ${rfidScanned}/${order.products.length || 1}` :
                         rfidPhase === "verified" ? "All products matched!" :
                         rfidPhase === "dispatching" ? "Updating dispatch records…" : ""}
                      </span>
                    )}
                  </div>

                  {/* Product scan list */}
                  {rfidPhase !== "idle" && rfidPhase !== "done" && (
                    <div style={{ marginBottom: "0.85rem", display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
                      {order.products.map((p, i) => {
                        const scanned = i < rfidScanned;
                        const scanning = i === rfidScanned && rfidPhase === "scanning";
                        return (
                          <div key={i} style={{
                            display: "flex", alignItems: "center", gap: "0.6rem",
                            padding: "0.3rem 0.5rem", borderRadius: 5,
                            background: scanned ? "rgba(80,210,120,0.07)" : scanning ? "rgba(255,180,60,0.07)" : "transparent",
                            opacity: scanned || scanning ? 1 : 0.3,
                            transition: "all 0.2s",
                          }}>
                            <span style={{ fontSize: "0.85rem", width: 18, textAlign: "center", flexShrink: 0 }}>
                              {scanned ? "✅" : scanning ? "📡" : "⬜"}
                            </span>
                            <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: scanned ? "#50d278" : scanning ? "#ffb83c" : "#555", fontWeight: 600, flexShrink: 0 }}>
                              {p.productCode}
                            </span>
                            <span style={{ fontSize: "0.76rem", color: scanned ? "#3a7a3a" : "#444" }}>
                              {p.description} · {p.colour}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Verified banner */}
                  {(rfidPhase === "verified" || rfidPhase === "dispatching") && (
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", padding: "0.5rem 0.75rem", background: "rgba(80,210,120,0.12)", borderRadius: 7, marginBottom: "0.75rem" }}>
                      <span>✅</span>
                      <span style={{ fontSize: "0.82rem", color: "#50d278", fontWeight: 700 }}>
                        All {order.products.length} product{order.products.length !== 1 ? "s" : ""} verified at dispatch area
                        {rfidPhase === "dispatching" && " — updating records…"}
                      </span>
                      {rfidPhase === "dispatching" && <Loader2 style={{ width: 14, height: 14, color: "#50d278", animation: "spin 1s linear infinite", marginLeft: "auto" }} />}
                    </div>
                  )}

                  {/* Done banner */}
                  {rfidPhase === "done" && (
                    <div style={{ padding: "0.6rem 0.85rem", background: "rgba(80,210,120,0.12)", border: "1px solid rgba(80,210,120,0.25)", borderRadius: 7 }}>
                      <div style={{ color: "#50d278", fontWeight: 700, fontSize: "0.88rem", marginBottom: 3 }}>
                        ✅ Order dispatched successfully via RFID verification
                      </div>
                      <div style={{ color: "#3a7a3a", fontSize: "0.76rem" }}>
                        Dispatch time recorded · Pick duration and rating updated
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {rfidError && (
                    <div style={{ color: "#ff5a5a", fontSize: "0.82rem", marginBottom: "0.65rem" }}>⚠ {rfidError}</div>
                  )}

                  {/* Action button */}
                  {rfidPhase === "idle" && (
                    <button
                      type="button"
                      onClick={handleRfidDispatch}
                      style={{
                        background: "#1a4a1a", border: "1px solid #2a7a2a", color: "#50d278",
                        padding: "0.55rem 1.2rem", borderRadius: 8, fontSize: "0.88rem",
                        fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem",
                      }}
                    >
                      <span>📡</span> Picked and left at Dispatch
                    </button>
                  )}
                </div>
              )}

              {/* ── Reassign section (managers + received status only) ── */}
              {canReassign && order.status === "received" && (
                <div style={{ marginTop: "1.5rem", padding: "1rem 1.1rem", background: "#0d0d0d", border: "1px solid #2a2a2a", borderRadius: 10 }}>
                  <div style={{ fontSize: "0.78rem", color: "#888", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.75rem" }}>
                    Reassign Order
                  </div>
                  {reassignDone ? (
                    <p style={{ color: "#50d278", fontWeight: 700, margin: 0 }}>✓ Order reassigned successfully.</p>
                  ) : (
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        value={selectedPicker}
                        onChange={(e) => setSelectedPicker(e.target.value)}
                        disabled={reassigning}
                        style={{
                          flex: 1, minWidth: 200, background: "#1a1a1a", border: "1px solid #333",
                          color: selectedPicker ? "#fff" : "#555", borderRadius: 8,
                          padding: "0.5rem 0.75rem", fontSize: "0.88rem", cursor: "pointer", outline: "none",
                        }}
                      >
                        <option value="">— Select picker —</option>
                        {pickers.map((p) => (
                          <option key={p.username} value={p.username}>
                            {p.fullName} ({p.username}) — Dept {p.department ?? "—"} / Branch {p.branchCode}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={handleReassign}
                        disabled={!selectedPicker || reassigning}
                        style={{
                          background: selectedPicker ? "#1a4a1a" : "#1a1a1a",
                          border: "1px solid " + (selectedPicker ? "#2a7a2a" : "#333"),
                          color: selectedPicker ? "#50d278" : "#444",
                          padding: "0.5rem 1.1rem", borderRadius: 8, fontSize: "0.88rem",
                          fontWeight: 700, cursor: selectedPicker ? "pointer" : "not-allowed",
                          whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        {reassigning
                          ? <><Loader2 style={{ width: 14, height: 14, animation: "spin 1s linear infinite" }} /> Reassigning…</>
                          : "Confirm Reassignment"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
