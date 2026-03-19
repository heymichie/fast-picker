import { useEffect, useRef, useState } from "react";
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

interface ProductEntry {
  productCode: string; dept: string; category: string;
  colour: string; description: string;
}

interface Rail {
  id: string; x: number; y: number; w: number; h: number;
  department: string; category: string; colour: string; description: string;
  products?: ProductEntry[];
}

// ── Canvas drawing helpers ─────────────────────────────────────────────
function drawLabel(ctx: CanvasRenderingContext2D, rx: number, ry: number, rw: number, railId: string) {
  const boldPart = "Rail ID: ", idPart = railId, fontSize = 11, padding = 6;
  const labelH = fontSize + padding * 2;
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const boldW = ctx.measureText(boldPart).width;
  ctx.font = `italic ${fontSize}px Arial, sans-serif`;
  const idW = ctx.measureText(idPart).width;
  const labelW = Math.min(boldW + idW + padding * 2, Math.max(rw, 60));
  ctx.fillStyle = "#daeeff";
  ctx.fillRect(rx, ry, labelW, labelH);
  ctx.strokeStyle = "#4a9eda"; ctx.lineWidth = 1.5;
  ctx.strokeRect(rx, ry, labelW, labelH);
  const textY = ry + padding + fontSize - 2;
  ctx.fillStyle = "#1a2a3a";
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillText(boldPart, rx + padding, textY);
  ctx.font = `italic ${fontSize}px Arial, sans-serif`;
  ctx.fillText(idPart, rx + padding + boldW, textY);
}

function redrawCanvas(canvas: HTMLCanvasElement, rails: Rail[], floorImg: HTMLImageElement | null) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (floorImg) ctx.drawImage(floorImg, 0, 0, canvas.width, canvas.height);
  const W = canvas.width, H = canvas.height;
  for (const rail of rails) {
    const rx = rail.x * W, ry = rail.y * H, rw = rail.w * W, rh = rail.h * H;
    ctx.fillStyle = "rgba(74,158,218,0.15)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#4a9eda"; ctx.lineWidth = 2; ctx.setLineDash([]);
    ctx.strokeRect(rx, ry, rw, rh);
    drawLabel(ctx, rx, ry, rw, rail.id);
  }
}

// ── Shared styles ──────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "0.6rem 1rem", textAlign: "left", fontSize: "0.75rem", fontWeight: 700,
  color: "#888", textTransform: "uppercase", letterSpacing: "0.06em",
  borderBottom: "1px solid #2a2a2a", whiteSpace: "nowrap",
};
const tdStyle: React.CSSProperties = {
  padding: "0.65rem 1rem", fontSize: "0.88rem", color: "#ddd",
  borderBottom: "1px solid #1e1e1e", verticalAlign: "top",
};
const labelStyle: React.CSSProperties = {
  display: "block", fontSize: "0.8rem", color: "#aaa", fontWeight: 600, marginBottom: "0.3rem",
};
const inputStyle: React.CSSProperties = {
  width: "100%", background: "#222", border: "1px solid #444", borderRadius: 8,
  color: "#fff", padding: "0.55rem 0.75rem", fontSize: "0.9rem", outline: "none", boxSizing: "border-box",
};
const chipStyle = (active: boolean): React.CSSProperties => ({
  padding: "0.3rem 0.85rem", borderRadius: 20,
  border: active ? "1.5px solid #4a9eda" : "1px solid #444",
  background: active ? "rgba(74,158,218,0.15)" : "transparent",
  color: active ? "#4a9eda" : "#aaa", fontSize: "0.85rem",
  fontWeight: active ? 700 : 400, cursor: "pointer",
});
const sectionHeaderStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  background: "#111", borderRadius: 8, padding: "0.6rem 1rem",
  border: "1px solid #222", cursor: "pointer", userSelect: "none",
};

// ── Component ──────────────────────────────────────────────────────────
const BLANK_PRODUCT: ProductEntry = { productCode: "", dept: "", category: "", colour: "", description: "" };

export default function ManageStoreLayout() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const isAdmin = user?.isAdmin === true;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const floorImgRef = useRef<HTMLImageElement | null>(null);

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [floors, setFloors] = useState<string[]>([]);
  const [selectedFloor, setSelectedFloor] = useState("");
  const [rails, setRails] = useState<Rail[]>([]);
  const [floorPlanSrc, setFloorPlanSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Collapse state
  const [planOpen, setPlanOpen] = useState(true);
  const [tableOpen, setTableOpen] = useState(true);

  // Edit form state
  const [editingRail, setEditingRail] = useState<Rail | null>(null);
  const [formProducts, setFormProducts] = useState<ProductEntry[]>([{ ...BLANK_PRODUCT }]);

  // ── Branches ──────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/accounts/branches")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (isAdmin) { setBranches(data); if (data.length > 0) setSelectedBranch(data[0]); }
        else if (user?.branchCode && user.branchCode !== "ALL") {
          setBranches([user.branchCode]); setSelectedBranch(user.branchCode);
        }
      })
      .catch(() => {
        if (!isAdmin && user?.branchCode && user.branchCode !== "ALL") {
          setBranches([user.branchCode]); setSelectedBranch(user.branchCode);
        }
      });
  }, []);

  // ── Floors ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedBranch) { setFloors([]); setSelectedFloor(""); setRails([]); setFloorPlanSrc(null); return; }
    fetch(`/api/store-layout/floors?branchCode=${encodeURIComponent(selectedBranch)}`)
      .then((r) => r.json())
      .then((names: string[]) => { setFloors(names); setSelectedFloor(names[0] ?? ""); })
      .catch(() => { setFloors([]); setSelectedFloor(""); });
  }, [selectedBranch]);

  // ── Floor plan + rails ────────────────────────────────────────────
  useEffect(() => {
    if (!selectedBranch || !selectedFloor) { setRails([]); setFloorPlanSrc(null); return; }
    setLoading(true);
    fetch(`/api/store-layout?branchCode=${encodeURIComponent(selectedBranch)}&floorName=${encodeURIComponent(selectedFloor)}`)
      .then((r) => r.json())
      .then((d) => { setRails(Array.isArray(d.railsData) ? d.railsData : []); setFloorPlanSrc(d.floorPlanImage ?? null); })
      .catch(() => { setRails([]); setFloorPlanSrc(null); })
      .finally(() => setLoading(false));
  }, [selectedBranch, selectedFloor]);

  // ── Canvas sync ───────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current, canvas = canvasRef.current;
    if (!container || !canvas) return;
    function syncSize() {
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      redrawCanvas(canvas, rails, floorImgRef.current);
    }
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, [rails]);

  // ── Load floor image → redraw ─────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!floorPlanSrc) { floorImgRef.current = null; redrawCanvas(canvas, rails, null); return; }
    const img = new Image();
    img.onload = () => { floorImgRef.current = img; redrawCanvas(canvas, rails, img); };
    img.src = floorPlanSrc;
  }, [floorPlanSrc, rails]);

  // ── Edit helpers ──────────────────────────────────────────────────
  function openEdit(rail: Rail) {
    setEditingRail(rail);
    setFormProducts(
      rail.products && rail.products.length > 0
        ? rail.products.map((p) => ({ productCode: p.productCode ?? "", dept: p.dept ?? "", category: p.category ?? "", colour: p.colour ?? "", description: p.description ?? "" }))
        : [{ productCode: "", dept: rail.department ?? "", category: rail.category ?? "", colour: rail.colour ?? "", description: rail.description ?? "" }]
    );
  }

  function updateProduct(i: number, field: keyof ProductEntry, value: string) {
    setFormProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  function addProduct() { setFormProducts((prev) => [...prev, { ...BLANK_PRODUCT }]); }
  function removeProduct(i: number) { setFormProducts((prev) => prev.filter((_, idx) => idx !== i)); }

  async function handleSaveEdit() {
    if (!editingRail) return;
    for (let i = 0; i < formProducts.length; i++) {
      const p = formProducts[i];
      const label = formProducts.length > 1 ? ` (Product ${i + 1})` : "";
      if (!p.productCode.trim()) { alert(`Please enter a product code${label}.`); return; }
      if (!p.dept.trim()) { alert(`Please enter a department${label}.`); return; }
      if (!p.category.trim()) { alert(`Please enter a category${label}.`); return; }
      if (!p.colour.trim()) { alert(`Please enter a colour${label}.`); return; }
    }

    const updatedRail: Rail = {
      ...editingRail,
      department: formProducts.map((p) => p.dept.trim()).join(" / "),
      category: formProducts.map((p) => p.category.trim()).join(" / "),
      colour: formProducts.map((p) => p.colour.trim()).join(" / "),
      description: formProducts.map((p) => p.description.trim()).filter(Boolean).join(" / "),
      products: formProducts.map((p) => ({ productCode: p.productCode.trim(), dept: p.dept.trim(), category: p.category.trim(), colour: p.colour.trim(), description: p.description.trim() })),
    };

    const updatedRails = rails.map((r) => r.id === editingRail.id ? updatedRail : r);

    try {
      const res = await fetch("/api/store-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchCode: selectedBranch, floorName: selectedFloor, floorPlanImage: floorPlanSrc, railsData: updatedRails }),
      });
      if (!res.ok) throw new Error();
      setRails(updatedRails);
      setEditingRail(null);
      setSaveMsg("Rail updated successfully.");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch {
      alert("Failed to save. Please try again.");
    }
  }

  const hasFloorContent = !loading && (floorPlanSrc || rails.length > 0);

  // ── Print helpers ─────────────────────────────────────────────────
  function printFloorPlan() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL("image/png");
    const win = window.open("", "_blank");
    if (!win) return;
    const title = `Floor Plan — ${selectedBranch} / ${selectedFloor}`;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{margin:0;padding:20px;background:#fff;font-family:Arial,sans-serif;}
      h2{font-size:15px;color:#333;margin:0 0 10px;}
      p{font-size:11px;color:#888;margin:0 0 12px;}
      img{max-width:100%;border:1px solid #ddd;border-radius:6px;}
      @media print{@page{margin:1.5cm;}body{padding:0;}}
    </style></head><body>
      <h2>${title}</h2>
      <p>Printed ${new Date().toLocaleDateString("en-ZA", { day:"2-digit", month:"long", year:"numeric" })}</p>
      <img src="${dataUrl}" />
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }

  function buildRailTableHtml(extraStyle = "") {
    const rowsHtml = rails.map((rail) => {
      const products = rail.products?.length
        ? rail.products
        : [{ productCode: "", dept: rail.department, category: rail.category, colour: rail.colour, description: rail.description }];
      return products.map((p, pi) => `<tr>
        ${pi === 0 ? `<td rowspan="${products.length}" style="vertical-align:middle;font-weight:700;font-family:monospace;font-size:11px;color:#1a2a3a;">${rail.id}</td>` : ""}
        <td style="font-family:monospace;font-size:11px;">${p.productCode || "—"}</td>
        <td>${p.dept || "—"}</td>
        <td>${p.category || "—"}</td>
        <td>${p.colour || "—"}</td>
        <td>${p.description || "—"}</td>
      </tr>`).join("");
    }).join("");
    return `<table style="width:100%;border-collapse:collapse;font-size:12px;${extraStyle}">
      <thead><tr>
        <th style="text-align:left;padding:7px 10px;background:#4a9eda;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;">Rail ID</th>
        <th style="text-align:left;padding:7px 10px;background:#4a9eda;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;">Product Code</th>
        <th style="text-align:left;padding:7px 10px;background:#4a9eda;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;">Department</th>
        <th style="text-align:left;padding:7px 10px;background:#4a9eda;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;">Category</th>
        <th style="text-align:left;padding:7px 10px;background:#4a9eda;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;">Colour</th>
        <th style="text-align:left;padding:7px 10px;background:#4a9eda;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;">Description</th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>`;
  }

  function printRailInfo() {
    const win = window.open("", "_blank");
    if (!win) return;
    const title = `Rail Information — ${selectedBranch} / ${selectedFloor}`;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{margin:0;padding:20px;font-family:Arial,sans-serif;background:#fff;color:#222;}
      h2{font-size:15px;color:#333;margin:0 0 6px;}
      p{font-size:11px;color:#888;margin:0 0 14px;}
      td,th{padding:7px 10px;border-bottom:1px solid #e8e8e8;vertical-align:top;}
      tr:nth-child(even) td{background:#f6faff;}
      @media print{@page{margin:1.5cm;size:landscape;}body{padding:0;}}
    </style></head><body>
      <h2>${title}</h2>
      <p>${rails.length} rail${rails.length !== 1 ? "s" : ""} · Printed ${new Date().toLocaleDateString("en-ZA", { day:"2-digit", month:"long", year:"numeric" })}</p>
      ${buildRailTableHtml()}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }

  function printBoth() {
    const canvas = canvasRef.current;
    const dataUrl = canvas ? canvas.toDataURL("image/png") : null;
    const win = window.open("", "_blank");
    if (!win) return;
    const title = `Store Layout — ${selectedBranch} / ${selectedFloor}`;
    const imgSection = dataUrl
      ? `<h3 style="font-size:13px;color:#333;margin:0 0 8px;">Floor Plan</h3><img src="${dataUrl}" style="max-width:100%;border:1px solid #ddd;border-radius:6px;" />`
      : "";
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{margin:0;padding:20px;font-family:Arial,sans-serif;background:#fff;color:#222;}
      h2{font-size:15px;color:#333;margin:0 0 6px;}
      h3{font-size:13px;color:#333;margin:22px 0 8px;}
      p{font-size:11px;color:#888;margin:0 0 14px;}
      td,th{padding:7px 10px;border-bottom:1px solid #e8e8e8;vertical-align:top;}
      tr:nth-child(even) td{background:#f6faff;}
      @media print{@page{margin:1.5cm;}body{padding:0;}.page-break{page-break-before:always;}}
    </style></head><body>
      <h2>${title}</h2>
      <p>Printed ${new Date().toLocaleDateString("en-ZA", { day:"2-digit", month:"long", year:"numeric" })}</p>
      ${imgSection}
      ${rails.length > 0 ? `<div class="page-break"><h3>Rail Information</h3><p>${rails.length} rail${rails.length !== 1 ? "s" : ""}</p>${buildRailTableHtml()}</div>` : ""}
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.5rem", gap: "1rem" }}>
        <button onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`} alt="Fast Picker" style={{ height: 56, objectFit: "contain" }} />
        </button>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", margin: 0, flex: 1, lineHeight: 1 }}>
          Account: {user ? `${user.forenames} ${user.surname}` : "User"}
        </h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button type="button" onClick={() => { localStorage.removeItem("fp_user"); setLocation("/login"); }}
            style={{ background: "none", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", letterSpacing: "0.08em", padding: 0, textTransform: "uppercase" }}>
            LOGOUT
          </button>
          <LiveClock color="#ccc" size="sm" />
        </div>
      </header>

      {/* Breadcrumb */}
      <div style={{ padding: "0.25rem 1.5rem 0.75rem", fontSize: "0.82rem", color: "#bbb" }}>
        <button type="button" onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 0, fontSize: "0.82rem" }}>Home</button>
        {" / Manage Store Layout"}
      </div>

      <div style={{ flex: 1, padding: "1rem 1.5rem 2rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>

        {/* Branch selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ fontSize: "0.85rem", color: "#aaa", fontWeight: 600, whiteSpace: "nowrap" }}>Branch</label>
          <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)}
            style={{ background: "#1a1a1a", border: "1px solid #444", color: "#fff", borderRadius: 8, padding: "0.45rem 1rem", fontSize: "0.9rem", cursor: "pointer" }}>
            {branches.length === 0 && <option value="">No branches</option>}
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Floor chips */}
        {floors.length > 0 && (
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: "0.82rem", color: "#666", marginRight: "0.25rem" }}>Floor:</span>
            {floors.map((f) => (
              <button key={f} type="button" onClick={() => setSelectedFloor(f)} style={chipStyle(f === selectedFloor)}>{f}</button>
            ))}
          </div>
        )}

        {/* Empty states */}
        {!selectedBranch && <p style={{ color: "#555", fontSize: "0.9rem" }}>Select a branch to view its store layout.</p>}
        {selectedBranch && floors.length === 0 && !loading && <p style={{ color: "#555", fontSize: "0.9rem" }}>No floor plans saved for {selectedBranch} yet.</p>}
        {loading && <p style={{ color: "#555", fontSize: "0.9rem" }}>Loading...</p>}
        {saveMsg && <p style={{ color: "#6ddd6d", fontSize: "0.88rem", margin: 0 }}>{saveMsg}</p>}

        {selectedBranch && selectedFloor && !loading && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>{selectedBranch} — {selectedFloor}</h2>
              <span style={{ fontSize: "0.82rem", color: "#555", flex: 1 }}>{rails.length} rail{rails.length !== 1 ? "s" : ""}</span>
              {hasFloorContent && (
                <button
                  type="button"
                  onClick={printBoth}
                  title="Print floor plan and rail information"
                  style={{
                    display: "flex", alignItems: "center", gap: "0.4rem",
                    background: "#4a9eda", border: "none", color: "#fff",
                    padding: "0.42rem 1rem", borderRadius: 8,
                    fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                  }}
                >
                  🖨 Print Both
                </button>
              )}
            </div>

            {/* ── Floor Plan section ──────────────────────────────── */}
            {hasFloorContent && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={sectionHeaderStyle} onClick={() => setPlanOpen((v) => !v)}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#ccc" }}>Floor Plan</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    {floorPlanSrc && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); printFloorPlan(); }}
                        style={{
                          background: "rgba(74,158,218,0.15)", border: "1px solid #4a9eda",
                          color: "#4a9eda", padding: "0.22rem 0.65rem", borderRadius: 6,
                          fontSize: "0.76rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                        }}
                      >
                        🖨 Print
                      </button>
                    )}
                    <span style={{ fontSize: "0.8rem", color: "#555" }}>{planOpen ? "▲ Collapse" : "▼ Expand"}</span>
                  </div>
                </div>
                {planOpen && (
                  <div ref={containerRef} style={{ position: "relative", width: "100%", aspectRatio: "16/9", background: "#111", borderRadius: 10, border: "1px solid #2a2a2a", overflow: "hidden" }}>
                    {!floorPlanSrc && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: "0.85rem", pointerEvents: "none" }}>
                        No floor plan image uploaded
                      </div>
                    )}
                    <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
                  </div>
                )}
              </div>
            )}

            {/* ── Rail Information table ──────────────────────────── */}
            {rails.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={sectionHeaderStyle} onClick={() => setTableOpen((v) => !v)}>
                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#ccc" }}>Rail Information</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); printRailInfo(); }}
                      style={{
                        background: "rgba(74,158,218,0.15)", border: "1px solid #4a9eda",
                        color: "#4a9eda", padding: "0.22rem 0.65rem", borderRadius: 6,
                        fontSize: "0.76rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      🖨 Print
                    </button>
                    <span style={{ fontSize: "0.8rem", color: "#555" }}>{tableOpen ? "▲ Collapse" : "▼ Expand"}</span>
                  </div>
                </div>
                {tableOpen && (
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
                            : [{ productCode: "", dept: rail.department, category: rail.category, colour: rail.colour, description: rail.description }];
                          return products.map((p, pi) => (
                            <tr key={`${rail.id}-${pi}`} style={{ background: pi % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
                              {pi === 0 && (
                                <td style={{ ...tdStyle, verticalAlign: "middle" }} rowSpan={products.length}>
                                  <button
                                    type="button"
                                    onClick={() => openEdit(rail)}
                                    title="Click to edit this rail"
                                    style={{
                                      display: "inline-block", background: "#daeeff", color: "#1a2a3a",
                                      fontWeight: 700, fontSize: "0.8rem", padding: "0.2rem 0.55rem",
                                      borderRadius: 5, border: "1px solid #4a9eda", fontFamily: "monospace",
                                      whiteSpace: "nowrap", cursor: "pointer",
                                    }}
                                  >
                                    {rail.id}
                                  </button>
                                </td>
                              )}
                              <td style={tdStyle}>{p.productCode ? <span style={{ fontFamily: "monospace", color: "#ccc", fontSize: "0.82rem" }}>{p.productCode}</span> : <span style={{ color: "#444" }}>—</span>}</td>
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
              </div>
            )}

            {rails.length === 0 && <p style={{ color: "#555", fontSize: "0.9rem" }}>No rails marked on this floor plan yet.</p>}
          </>
        )}
      </div>

      {/* ── Edit Rail Modal ──────────────────────────────────────────── */}
      {editingRail && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #444", borderRadius: 12, padding: "2rem", width: "min(440px, 92vw)", display: "flex", flexDirection: "column", gap: "1.1rem" }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #333", paddingBottom: "0.75rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>
                Edit Rail — {editingRail.id}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#999" }}>
              Update the product details below. The Rail ID will remain unchanged.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "55vh", overflowY: "auto", paddingRight: "0.25rem" }}>
              {formProducts.map((p, i) => (
                <div key={i} style={{ background: "#111", border: "1px solid #333", borderRadius: 10, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {formProducts.length > 1 ? `Product ${i + 1}` : "Product"}
                    </span>
                    {formProducts.length > 1 && (
                      <button type="button" onClick={() => removeProduct(i)}
                        style={{ background: "#3a1a1a", border: "1px solid #662222", color: "#ff7070", borderRadius: 6, padding: "0.2rem 0.55rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}>
                        Remove
                      </button>
                    )}
                  </div>

                  {([
                    ["productCode", "Product Code *", "e.g. MSW-SHT-001"],
                    ["dept", "Department *", "e.g. Menswear"],
                    ["category", "Category *", "e.g. Shirts"],
                    ["colour", "Colour *", "e.g. Navy Blue"],
                    ["description", "Short Description", "e.g. Formal long-sleeve shirts"],
                  ] as [keyof ProductEntry, string, string][]).map(([field, label, ph]) => (
                    <div key={field}>
                      <label style={labelStyle}>{label}</label>
                      <input type="text" value={p[field]} onChange={(e) => updateProduct(i, field, e.target.value)}
                        placeholder={ph} style={inputStyle} autoFocus={field === "productCode" && i === 0} />
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <button type="button" onClick={addProduct}
              style={{ background: "transparent", border: "1px dashed #555", color: "#ccc", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", textAlign: "center" }}>
              + Add another product
            </button>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button type="button" onClick={() => setEditingRail(null)}
                style={{ flex: 1, background: "#333", color: "#fff", border: "none", borderRadius: 8, padding: "0.7rem", fontSize: "0.97rem", fontWeight: 600, cursor: "pointer" }}>
                Cancel
              </button>
              <button type="button" onClick={handleSaveEdit}
                style={{ flex: 1, background: "#fff", color: "#111", border: "none", borderRadius: 8, padding: "0.7rem", fontSize: "0.97rem", fontWeight: 700, cursor: "pointer" }}>
                Update and Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
