import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2, X } from "lucide-react";

// ── LED colour system ────────────────────────────────────────────────────
const LED_COLOURS = [
  "#FF4444", // Red
  "#FF8800", // Orange
  "#FFEE00", // Yellow
  "#44FF88", // Green
  "#00FFCC", // Teal
  "#4488FF", // Blue
  "#AA44FF", // Purple
  "#FF44BB", // Pink
  "#FF6644", // Coral
  "#44EEFF", // Cyan
];
const LED_NAMES = [
  "Red", "Orange", "Yellow", "Green", "Teal",
  "Blue", "Purple", "Pink", "Coral", "Cyan",
];

function pickerLedColour(pickerId: string | null): string {
  if (!pickerId) return LED_COLOURS[0];
  let hash = 0;
  for (let i = 0; i < pickerId.length; i++) {
    hash = (hash * 31 + pickerId.charCodeAt(i)) & 0xffff;
  }
  return LED_COLOURS[hash % LED_COLOURS.length];
}

function pickerLedName(pickerId: string | null): string {
  if (!pickerId) return LED_NAMES[0];
  let hash = 0;
  for (let i = 0; i < pickerId.length; i++) {
    hash = (hash * 31 + pickerId.charCodeAt(i)) & 0xffff;
  }
  return LED_NAMES[hash % LED_NAMES.length];
}

// ── Interfaces ───────────────────────────────────────────────────────────
interface ProductLine {
  railId: string;
  productCode: string;
  dept: string;
  category: string;
  colour: string;
  description: string;
  size: string;
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

interface LayoutRail {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  department?: string;
  category?: string;
  colour?: string;
}

interface LayoutData {
  floorPlanImage: string | null;
  railsData: LayoutRail[];
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

// ── LED canvas drawing ───────────────────────────────────────────────────
function drawLedCanvas(
  canvas: HTMLCanvasElement,
  rails: LayoutRail[],
  litRailIds: Set<string>,
  productsByRail: Record<string, ProductLine[]>,
  ledColour: string,
  floorImg: HTMLImageElement | null,
  tick: number,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  ctx.clearRect(0, 0, W, H);

  // Floor plan image or dark grid background
  if (floorImg) {
    ctx.drawImage(floorImg, 0, 0, W, H);
  } else {
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 40) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
  }

  const pulse = 0.55 + 0.45 * Math.sin(tick * 0.07);

  for (const rail of rails) {
    const rx = rail.x * W;
    const ry = rail.y * H;
    const rw = rail.w * W;
    const rh = rail.h * H;
    const isLit = litRailIds.has(rail.id);

    if (isLit) {
      // Glowing LED fill
      ctx.shadowColor = ledColour;
      ctx.shadowBlur = 18 * pulse;
      ctx.fillStyle = ledColour + "2a";
      ctx.fillRect(rx, ry, rw, rh);

      // Glowing stroke
      ctx.strokeStyle = ledColour;
      ctx.lineWidth = 2.5;
      ctx.setLineDash([]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.shadowBlur = 0;

      // LED dots along the top of the rail (hanger heads) — one per product, labelled with size
      const prods = productsByRail[rail.id] ?? [];
      const dotCount = Math.min(prods.length, 10);
      const spacing = rw / (dotCount + 1);
      ctx.font = "bold 7px monospace";
      for (let di = 0; di < dotCount; di++) {
        const dotX = rx + spacing * (di + 1);
        const dotY = ry + Math.max(rh * 0.22, 8);
        // Glowing dot
        ctx.beginPath();
        ctx.arc(dotX, dotY, 5.5, 0, Math.PI * 2);
        ctx.fillStyle = ledColour;
        ctx.shadowColor = ledColour;
        ctx.shadowBlur = 14 * pulse;
        ctx.fill();
        ctx.shadowBlur = 0;
        // Size label below the dot
        const sizeLabel = prods[di]?.size ?? "";
        if (sizeLabel && rh > 28) {
          const labelW = ctx.measureText(sizeLabel).width;
          ctx.fillStyle = "rgba(0,0,0,0.75)";
          ctx.fillRect(dotX - labelW / 2 - 2, dotY + 7, labelW + 4, 9);
          ctx.fillStyle = ledColour;
          ctx.fillText(sizeLabel, dotX - labelW / 2, dotY + 15);
        }
      }

      // Rail ID label
      const labelFontSize = 9;
      const labelPad = 4;
      ctx.font = `bold ${labelFontSize}px monospace`;
      const labelW = Math.min(ctx.measureText(rail.id).width + labelPad * 2, rw);
      ctx.fillStyle = ledColour + "cc";
      ctx.fillRect(rx, ry + rh - (labelFontSize + labelPad * 2), labelW, labelFontSize + labelPad * 2);
      ctx.fillStyle = "#000";
      ctx.fillText(rail.id, rx + labelPad, ry + rh - labelPad - 1);

    } else {
      // Dim unlit rail
      ctx.fillStyle = "rgba(74,158,218,0.07)";
      ctx.fillRect(rx, ry, rw, rh);
      ctx.strokeStyle = "rgba(74,158,218,0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);

      // Rail ID label (dim)
      const labelFontSize = 9;
      const labelPad = 4;
      ctx.font = `${labelFontSize}px monospace`;
      ctx.fillStyle = "rgba(74,158,218,0.4)";
      const lText = rail.id;
      const lW = Math.min(ctx.measureText(lText).width + labelPad * 2, rw);
      ctx.fillRect(rx, ry, lW, labelFontSize + labelPad * 2);
      ctx.fillStyle = "#1a2a3a";
      ctx.fillText(lText, rx + labelPad, ry + labelFontSize + labelPad - 2);
    }
  }
}

// ── Component ────────────────────────────────────────────────────────────
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

  // LED floor plan state
  const [layoutFloors, setLayoutFloors] = useState<string[]>([]);
  const [activeFloor, setActiveFloor] = useState<string>("");
  const [layoutData, setLayoutData] = useState<LayoutData | null>(null);
  const [layoutLoading, setLayoutLoading] = useState(false);
  const ledCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);
  const floorImgRef = useRef<HTMLImageElement | null>(null);
  const tickRef = useRef(0);

  // ── Load order ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!orderNumber) return;
    setLoading(true);
    setOrder(null);
    setReassignDone(false);
    setSelectedPicker("");
    setRfidPhase("idle");
    setRfidScanned(0);
    setRfidError(null);
    setLayoutFloors([]);
    setActiveFloor("");
    setLayoutData(null);
    fetch(`/api/orders/${orderNumber}`)
      .then((r) => r.json())
      .then((data: OrderDetail) => {
        setOrder(data);
        setLoading(false);
        if (canReassign && data.status === "received") {
          fetch(`/api/orders/pickers?branchCode=${data.branchCode}`)
            .then((r) => r.json())
            .then((ps: PickerOption[]) => setPickers(Array.isArray(ps) ? ps : []))
            .catch(() => setPickers([]));
        }
        // Load store layout floors for the branch
        fetch(`/api/store-layout/floors?branchCode=${data.branchCode}`)
          .then((r) => r.json())
          .then((floors: string[]) => {
            if (Array.isArray(floors) && floors.length > 0) {
              setLayoutFloors(floors);
              setActiveFloor(floors[0]);
            }
          })
          .catch(() => {});
      })
      .catch(() => setLoading(false));
  }, [orderNumber]);

  // ── Load floor plan when active floor changes ────────────────────────
  useEffect(() => {
    if (!order || !activeFloor) return;
    setLayoutLoading(true);
    setLayoutData(null);
    floorImgRef.current = null;
    fetch(`/api/store-layout?branchCode=${order.branchCode}&floorName=${encodeURIComponent(activeFloor)}`)
      .then((r) => r.json())
      .then((data: LayoutData) => {
        setLayoutData(data);
        setLayoutLoading(false);
        if (data.floorPlanImage) {
          const img = new Image();
          img.src = data.floorPlanImage;
          img.onload = () => { floorImgRef.current = img; };
        }
      })
      .catch(() => setLayoutLoading(false));
  }, [order?.branchCode, activeFloor]);

  // ── Animated LED canvas ──────────────────────────────────────────────
  const ledColour = pickerLedColour(order?.assignedPickerId ?? null);

  // Product rail IDs (for products table LED dots)
  const productRailIds = new Set((order?.products ?? []).map((p) => p.railId));
  // Dept codes from products (strip leading zeros for matching: "002" -> "2")
  const productDepts = new Set((order?.products ?? []).map((p) => p.dept.replace(/^0+/, "")));

  // Compute lit rail IDs against layout:
  // 1. Exact ID match, 2. dept-prefix match (first segment stripped of leading zeros)
  const litRailIds = new Set<string>();
  if (layoutData) {
    for (const rail of layoutData.railsData) {
      if (productRailIds.has(rail.id)) { litRailIds.add(rail.id); continue; }
      const railDept = rail.id.split("-")[0]?.replace(/^0+/, "");
      if (railDept && productDepts.has(railDept)) litRailIds.add(rail.id);
    }
  }
  // Fallback: if no layout data yet, use product rail IDs directly
  if (litRailIds.size === 0) {
    for (const r of productRailIds) litRailIds.add(r);
  }

  // Products grouped by rail (for LED dots on canvas)
  const productsByRail: Record<string, ProductLine[]> = {};
  for (const p of (order?.products ?? [])) {
    if (!productsByRail[p.railId]) productsByRail[p.railId] = [];
    productsByRail[p.railId].push(p);
  }
  // Lit dept codes (stripped of leading zeros) — for highlighting table rows
  const litDepts = new Set(Array.from(litRailIds).map((rid) => rid.split("-")[0]?.replace(/^0+/, "") ?? ""));

  // For lit rails from layout, group by layout rail ID
  const productsByLayoutRail: Record<string, ProductLine[]> = {};
  if (layoutData) {
    for (const rail of layoutData.railsData) {
      if (!litRailIds.has(rail.id)) continue;
      // Gather products that map to this rail (exact) or dept-match
      const railDept = rail.id.split("-")[0]?.replace(/^0+/, "");
      const matched = (order?.products ?? []).filter(
        (p) => p.railId === rail.id || p.dept.replace(/^0+/, "") === railDept
      );
      if (matched.length) productsByLayoutRail[rail.id] = matched;
    }
  }

  const animStateRef = useRef({ layoutData: null as LayoutData | null, litRailIds, productsByRail: productsByLayoutRail, ledColour });
  animStateRef.current = { layoutData, litRailIds, productsByRail: productsByLayoutRail, ledColour };

  const runAnimation = useCallback(() => {
    const canvas = ledCanvasRef.current;
    const { layoutData: ld, litRailIds: lri, productsByRail: pbr, ledColour: lc } = animStateRef.current;
    if (!canvas || !ld) return;
    tickRef.current++;
    drawLedCanvas(canvas, ld.railsData, lri, pbr, lc, floorImgRef.current, tickRef.current);
    animFrameRef.current = requestAnimationFrame(runAnimation);
  }, []); // stable — reads from ref each frame

  useEffect(() => {
    if (!layoutData) return;
    tickRef.current = 0;
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(runAnimation);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [layoutData, runAnimation]);

  // ── Reassign ─────────────────────────────────────────────────────────
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

  // ── RFID dispatch ────────────────────────────────────────────────────
  async function handleRfidDispatch() {
    if (!order) return;
    setRfidPhase("scanning");
    setRfidScanned(0);
    setRfidError(null);
    const total = Math.max(order.products.length, 1);
    await new Promise<void>((resolve) => {
      let count = 0;
      rfidTimer.current = setInterval(() => {
        count++;
        setRfidScanned(count);
        if (count >= total) { if (rfidTimer.current) clearInterval(rfidTimer.current); resolve(); }
      }, 280);
    });
    setRfidPhase("verified");
    await new Promise((res) => setTimeout(res, 700));
    setRfidPhase("dispatching");
    try {
      const now = new Date().toISOString();
      if (!order.pickedAt) {
        await fetch(`/api/orders/${order.orderNumber}/status`, {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "picked" }),
        });
      }
      await fetch(`/api/orders/${order.orderNumber}/status`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "dispatched" }),
      });
      setOrder((prev) => prev ? { ...prev, status: "dispatched", pickedAt: prev.pickedAt ?? now, dispatchedAt: now } : null);
      setRfidPhase("done");
      onDispatched?.();
    } catch {
      setRfidError("Dispatch failed. Please check connectivity and try again.");
      setRfidPhase("idle");
    }
  }

  // Cancel animation when modal closes
  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  if (!orderNumber) return null;

  const m = order ? (STATUS_META[order.status] ?? { label: order.status, color: "#aaa", bg: "#333" }) : null;
  const ledName = pickerLedName(order?.assignedPickerId ?? null);
  const hasLayout = layoutFloors.length > 0;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)",
        zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div style={{
        background: "#111", border: "1px solid #2a2a2a", borderRadius: 14,
        width: "100%", maxWidth: 920, maxHeight: "92vh",
        display: "flex", flexDirection: "column", overflow: "hidden",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
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
            {/* LED colour indicator in header */}
            {order?.assignedPickerId && (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: ledColour + "18", border: `1px solid ${ledColour}55`,
                borderRadius: 20, padding: "0.18rem 0.65rem",
              }}>
                <span style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: ledColour,
                  boxShadow: `0 0 6px 2px ${ledColour}88`,
                  display: "inline-block", flexShrink: 0,
                }} />
                <span style={{ fontSize: "0.74rem", fontWeight: 700, color: ledColour }}>
                  {ledName} LED
                </span>
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

                {/* LED Colour card */}
                {order.assignedPickerId && (
                  <div style={{ background: "#0d0d0d", border: `1px solid ${ledColour}44`, borderRadius: 8, padding: "0.7rem 0.9rem" }}>
                    <div style={{ fontSize: "0.7rem", color: "#555", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Picking LED Colour</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{
                        width: 18, height: 18, borderRadius: "50%",
                        background: ledColour,
                        boxShadow: `0 0 10px 3px ${ledColour}88`,
                        display: "inline-block", flexShrink: 0,
                      }} />
                      <span style={{ fontSize: "0.88rem", color: ledColour, fontWeight: 700 }}>{ledName}</span>
                    </div>
                  </div>
                )}
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

              {/* ── LED Floor Plan ── */}
              {(hasLayout || layoutLoading) && (
                <div style={{ marginBottom: "1.5rem", background: "#0a0a0a", border: `1px solid ${order.assignedPickerId ? ledColour + "44" : "#1e1e1e"}`, borderRadius: 10, overflow: "hidden" }}>
                  {/* Panel header */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.6rem 0.9rem", borderBottom: "1px solid #1a1a1a",
                    background: order.assignedPickerId ? ledColour + "10" : "transparent",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: order.assignedPickerId ? ledColour : "#555" }}>
                        💡 LED Rail Indicator — Floor Plan
                      </span>
                      {order.assignedPickerId && (
                        <span style={{ fontSize: "0.7rem", color: "#444" }}>
                          ({litRailIds.size} rail{litRailIds.size !== 1 ? "s" : ""} lit in {ledName})
                        </span>
                      )}
                    </div>
                    {/* Floor tabs */}
                    {layoutFloors.length > 1 && (
                      <div style={{ display: "flex", gap: 4 }}>
                        {layoutFloors.map((f) => (
                          <button key={f} type="button" onClick={() => setActiveFloor(f)}
                            style={{
                              padding: "0.2rem 0.6rem", borderRadius: 6, fontSize: "0.72rem", fontWeight: 700,
                              cursor: "pointer", border: "1px solid",
                              background: activeFloor === f ? (order.assignedPickerId ? ledColour + "22" : "#222") : "transparent",
                              borderColor: activeFloor === f ? (order.assignedPickerId ? ledColour : "#888") : "#333",
                              color: activeFloor === f ? (order.assignedPickerId ? ledColour : "#ddd") : "#555",
                            }}>{f}</button>
                        ))}
                      </div>
                    )}
                    {layoutFloors.length === 1 && (
                      <span style={{ fontSize: "0.72rem", color: "#444" }}>{activeFloor}</span>
                    )}
                  </div>

                  {/* Canvas */}
                  {layoutLoading ? (
                    <div style={{ display: "flex", justifyContent: "center", padding: "2.5rem 0" }}>
                      <Loader2 style={{ width: 20, height: 20, color: "#555", animation: "spin 1s linear infinite" }} />
                    </div>
                  ) : (
                    <div style={{ position: "relative" }}>
                      <canvas
                        ref={ledCanvasRef}
                        width={860}
                        height={300}
                        style={{ width: "100%", height: "auto", display: "block" }}
                      />
                      {/* Legend overlay (bottom-right) */}
                      {order.assignedPickerId && litRailIds.size > 0 && (
                        <div style={{
                          position: "absolute", bottom: 8, right: 8,
                          background: "rgba(0,0,0,0.8)", border: `1px solid ${ledColour}44`,
                          borderRadius: 6, padding: "0.4rem 0.6rem",
                          fontSize: "0.68rem", color: "#888",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: "50%", background: ledColour, boxShadow: `0 0 6px ${ledColour}`, display: "inline-block" }} />
                            <span style={{ color: ledColour, fontWeight: 700 }}>{ledName} = {order.assignedPickerName ?? order.assignedPickerId}</span>
                          </div>
                          <div style={{ color: "#444" }}>● = hanger head (item)</div>
                          <div style={{ color: "#2a3a4a" }}>── = unlit rail</div>
                        </div>
                      )}
                      {!order.assignedPickerId && (
                        <div style={{
                          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          background: "rgba(0,0,0,0.4)",
                        }}>
                          <span style={{ color: "#555", fontSize: "0.85rem" }}>Assign a picker to activate LED indicators</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Matched products legend below canvas */}
                  {!layoutLoading && order.assignedPickerId && litRailIds.size > 0 && (
                    <div style={{ padding: "0.6rem 0.9rem", borderTop: "1px solid #1a1a1a" }}>
                      <div style={{ fontSize: "0.68rem", color: "#444", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "0.4rem" }}>
                        Lit Rail — Items to Pick
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                        {Array.from(litRailIds).map((railId) => {
                          const prods = productsByLayoutRail[railId] ?? [];
                          return (
                            <div key={railId} style={{
                              background: ledColour + "15", border: `1px solid ${ledColour}33`,
                              borderRadius: 6, padding: "0.3rem 0.6rem",
                              display: "flex", alignItems: "center", gap: 6,
                            }}>
                              <span style={{ width: 7, height: 7, borderRadius: "50%", background: ledColour, boxShadow: `0 0 5px ${ledColour}`, display: "inline-block", flexShrink: 0 }} />
                              <span style={{ fontFamily: "monospace", fontSize: "0.72rem", color: ledColour, fontWeight: 700 }}>{railId}</span>
                              {prods.length > 0 && <span style={{ fontSize: "0.68rem", color: "#555" }}>× {prods.length} item{prods.length !== 1 ? "s" : ""}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

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
                        {["#", "Rail ID", "Product Code", "Dept", "Category", "Colour", "Size", "Description"].map((h) => (
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
                      {order.products.map((p, i) => {
                        const productDeptNum = p.dept.replace(/^0+/, "");
                        const isLit = !!order.assignedPickerId && (
                          litRailIds.has(p.railId) || litDepts.has(productDeptNum)
                        );
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)" }}>
                            <td style={{ padding: "0.55rem 0.75rem", color: "#444", fontSize: "0.75rem" }}>{i + 1}</td>
                            <td style={{ padding: "0.55rem 0.75rem", whiteSpace: "nowrap" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                                {isLit && (
                                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: ledColour, boxShadow: `0 0 5px ${ledColour}`, display: "inline-block", flexShrink: 0 }} />
                                )}
                                <span style={{ fontFamily: "monospace", fontWeight: 700, color: isLit ? ledColour : "#88aaff" }}>{p.railId}</span>
                              </span>
                            </td>
                            <td style={{ padding: "0.55rem 0.75rem", color: "#ccc", fontFamily: "monospace", whiteSpace: "nowrap" }}>{p.productCode}</td>
                            <td style={{ padding: "0.55rem 0.75rem", color: "#888" }}>{p.dept}</td>
                            <td style={{ padding: "0.55rem 0.75rem", color: "#ddd" }}>{p.category}</td>
                            <td style={{ padding: "0.55rem 0.75rem", color: "#ddd" }}>{p.colour}</td>
                            <td style={{ padding: "0.55rem 0.75rem" }}>
                              <span style={{
                                display: "inline-block",
                                background: isLit ? ledColour + "22" : "#1a1a1a",
                                border: `1px solid ${isLit ? ledColour + "66" : "#2a2a2a"}`,
                                borderRadius: 4,
                                padding: "0.1rem 0.45rem",
                                fontFamily: "monospace",
                                fontWeight: 700,
                                fontSize: "0.78rem",
                                color: isLit ? ledColour : "#aaa",
                              }}>
                                {p.size || "—"}
                              </span>
                            </td>
                            <td style={{ padding: "0.55rem 0.75rem", color: "#999" }}>{p.description}</td>
                          </tr>
                        );
                      })}
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
                            opacity: scanned || scanning ? 1 : 0.3, transition: "all 0.2s",
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
                  {rfidError && (
                    <div style={{ color: "#ff5a5a", fontSize: "0.82rem", marginBottom: "0.65rem" }}>⚠ {rfidError}</div>
                  )}
                  {rfidPhase === "idle" && (
                    <button type="button" onClick={handleRfidDispatch} style={{
                      background: "#1a4a1a", border: "1px solid #2a7a2a", color: "#50d278",
                      padding: "0.55rem 1.2rem", borderRadius: 8, fontSize: "0.88rem",
                      fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem",
                    }}>
                      <span>📡</span> Picked and left at Dispatch
                    </button>
                  )}
                </div>
              )}

              {/* ── Reassign section ── */}
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
