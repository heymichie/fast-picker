import { useState, useEffect, useRef, useCallback } from "react";
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
  dept: string;
  category: string;
  colour: string;
  description: string;
  productCode: string;
}

interface Rail {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  department: string;
  category: string;
  colour: string;
  description: string;
  products?: ProductEntry[];
}

interface PendingRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const selectStyle: React.CSSProperties = {
  appearance: "none",
  WebkitAppearance: "none",
  background:
    "#d4d4d4 url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23333' strokeWidth='2' fill='none' strokeLinecap='round'/%3E%3C/svg%3E\") no-repeat right 14px center",
  backgroundSize: "12px",
  border: "none",
  padding: "0.5rem 2.5rem 0.5rem 0.85rem",
  fontSize: "0.97rem",
  color: "#333",
  cursor: "pointer",
  outline: "none",
  borderRadius: 0,
  flex: 1,
  width: "100%",
};

// ── Canvas drawing helpers ─────────────────────────────────────────────
function drawLabel(ctx: CanvasRenderingContext2D, rx: number, ry: number, rw: number, railId: string) {
  const boldPart = "Rail ID: ";
  const idPart = railId;
  const fontSize = 11;
  const padding = 6;
  const labelH = fontSize + padding * 2;

  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  const boldW = ctx.measureText(boldPart).width;
  ctx.font = `italic ${fontSize}px Arial, sans-serif`;
  const idW = ctx.measureText(idPart).width;

  const labelW = Math.min(boldW + idW + padding * 2, Math.max(rw, 60));
  const lx = rx;
  const ly = ry;

  ctx.fillStyle = "#daeeff";
  ctx.fillRect(lx, ly, labelW, labelH);
  ctx.strokeStyle = "#4a9eda";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(lx, ly, labelW, labelH);

  const textY = ly + padding + fontSize - 2;
  ctx.fillStyle = "#1a2a3a";
  ctx.font = `bold ${fontSize}px Arial, sans-serif`;
  ctx.fillText(boldPart, lx + padding, textY);
  ctx.font = `italic ${fontSize}px Arial, sans-serif`;
  ctx.fillText(idPart, lx + padding + boldW, textY);
}

function redrawCanvas(
  canvas: HTMLCanvasElement,
  rails: Rail[],
  drawing: { sx: number; sy: number; cx: number; cy: number } | null,
  pending: PendingRect | null,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const W = canvas.width;
  const H = canvas.height;

  for (const rail of rails) {
    const rx = rail.x * W;
    const ry = rail.y * H;
    const rw = rail.w * W;
    const rh = rail.h * H;

    ctx.fillStyle = "rgba(74, 158, 218, 0.15)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#4a9eda";
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(rx, ry, rw, rh);
    drawLabel(ctx, rx, ry, rw, rail.id);
  }

  // Pending rect (awaiting form input) shown with orange dashes
  if (pending) {
    const rx = pending.x * W;
    const ry = pending.y * H;
    const rw = pending.w * W;
    const rh = pending.h * H;
    ctx.fillStyle = "rgba(255, 180, 50, 0.10)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#f0a020";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }

  // Live drawing preview (blue dashes while dragging)
  if (drawing) {
    const rx = Math.min(drawing.sx, drawing.cx);
    const ry = Math.min(drawing.sy, drawing.cy);
    const rw = Math.abs(drawing.cx - drawing.sx);
    const rh = Math.abs(drawing.cy - drawing.sy);
    ctx.fillStyle = "rgba(74, 158, 218, 0.10)";
    ctx.fillRect(rx, ry, rw, rh);
    ctx.strokeStyle = "#4a9eda";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(rx, ry, rw, rh);
    ctx.setLineDash([]);
  }
}

// ── Rail ID generator ──────────────────────────────────────────────────
function generateRailId(dept: string, cat: string, colour: string, existing: Rail[]) {
  const code = (s: string) =>
    s.trim().replace(/\s+/g, "").slice(0, 3).toUpperCase() || "XXX";
  const prefix = `${code(dept)}-${code(cat)}-${code(colour)}`;
  const samePrefix = existing.filter((r) => r.id.startsWith(prefix + "-")).length;
  return `${prefix}-${String(samePrefix + 1).padStart(3, "0")}`;
}

// ── Component ──────────────────────────────────────────────────────────
export default function SetupStoreLayout() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [floorName, setFloorName] = useState("Ground Floor");
  const [existingFloors, setExistingFloors] = useState<string[]>([]);
  const [floorPlanSrc, setFloorPlanSrc] = useState<string | null>(null);
  const [rails, setRails] = useState<Rail[]>([]);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  // Pending rect waiting for form input
  const [pendingRect, setPendingRect] = useState<PendingRect | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formProducts, setFormProducts] = useState<ProductEntry[]>([{ dept: "", category: "", colour: "", description: "", productCode: "" }]);
  const [editingRailId, setEditingRailId] = useState<string | null>(null);

  // Hover state for cursor change + "Double-click to edit" label
  const [hoveredRail, setHoveredRail] = useState<Rail | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const drawingRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const isAdmin = user?.isAdmin === true;

  // ── Canvas resize sync ─────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    function syncSize() {
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    }
    syncSize();
    const ro = new ResizeObserver(syncSize);
    ro.observe(container);
    return () => ro.disconnect();
  }, []);

  // ── Redraw on state changes ────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redrawCanvas(canvas, rails, drawingRef.current, pendingRect);
  }, [rails, isDrawMode, pendingRect]);

  // ── Load branches ──────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/accounts/branches")
      .then((r) => r.json())
      .then((data: string[]) => {
        if (isAdmin) {
          setBranches(data);
        } else if (user?.branchCode && user.branchCode !== "ALL") {
          const mine = user.branchCode;
          setBranches([mine]);
          setSelectedBranch(mine);
        }
      })
      .catch(() => {
        if (!isAdmin && user?.branchCode && user.branchCode !== "ALL") {
          setBranches([user.branchCode]);
          setSelectedBranch(user.branchCode);
        }
      });
  }, []);

  // ── Fetch list of existing floors whenever branch changes ─────────
  useEffect(() => {
    if (!selectedBranch) {
      setExistingFloors([]);
      setFloorName("Ground Floor");
      setFloorPlanSrc(null);
      setRails([]);
      setPendingRect(null);
      setShowForm(false);
      return;
    }
    fetch(`/api/store-layout/floors?branchCode=${encodeURIComponent(selectedBranch)}`)
      .then((r) => r.json())
      .then((names: string[]) => setExistingFloors(names))
      .catch(() => setExistingFloors([]));
  }, [selectedBranch]);

  // ── Load floor plan when branch + floorName are both set ──────────
  useEffect(() => {
    if (!selectedBranch || !floorName.trim()) {
      setFloorPlanSrc(null);
      setRails([]);
      return;
    }
    fetch(
      `/api/store-layout?branchCode=${encodeURIComponent(selectedBranch)}&floorName=${encodeURIComponent(floorName.trim())}`,
    )
      .then((r) => r.json())
      .then((d) => {
        setFloorPlanSrc(d.floorPlanImage ?? null);
        setRails(Array.isArray(d.railsData) ? d.railsData : []);
      })
      .catch(() => {
        setFloorPlanSrc(null);
        setRails([]);
      });
  }, [selectedBranch, floorName]);

  // ── Canvas interaction helpers ─────────────────────────────────────
  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawMode || showForm) return;
      const { x, y } = getCanvasPos(e);
      drawingRef.current = { sx: x, sy: y, cx: x, cy: y };
    },
    [isDrawMode, showForm],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const { x, y } = getCanvasPos(e);

      // While actively drawing, update the preview rect
      if (isDrawMode && drawingRef.current && !showForm) {
        drawingRef.current = { ...drawingRef.current, cx: x, cy: y };
        const canvas = canvasRef.current;
        if (canvas) redrawCanvas(canvas, rails, drawingRef.current, pendingRect);
        setHoveredRail(null);
        return;
      }

      // Hover detection over rail labels — shows "Double-click to edit" label near cursor
      if (!isDrawMode && !showForm) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const W = canvas.width;
        const H = canvas.height;
        const LABEL_H = 23;
        const canvasRect = canvas.getBoundingClientRect();
        let found: Rail | null = null;
        for (const rail of rails) {
          const rx = rail.x * W;
          const ry = rail.y * H;
          const rw = rail.w * W;
          if (x >= rx && x <= rx + rw && y >= ry && y <= ry + LABEL_H) {
            found = rail;
            break;
          }
        }
        setHoveredRail(found);
        if (found) {
          // Container-relative position so the overlay div can be positioned absolutely
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (containerRect) {
            setHoverPos({
              x: e.clientX - containerRect.left,
              y: e.clientY - containerRect.top,
            });
          }
        }
      }
    },
    [isDrawMode, rails, pendingRect, showForm],
  );

  // Double-click on a rail label opens the edit form
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (isDrawMode || showForm) return;
      const { x, y } = getCanvasPos(e);
      const canvas = canvasRef.current;
      if (!canvas) return;
      const W = canvas.width;
      const H = canvas.height;
      const LABEL_H = 23;
      for (const rail of rails) {
        const rx = rail.x * W;
        const ry = rail.y * H;
        const rw = rail.w * W;
        if (x >= rx && x <= rx + rw && y >= ry && y <= ry + LABEL_H) {
          handleEditRail(rail);
          return;
        }
      }
    },
    [isDrawMode, showForm, rails],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawMode || !drawingRef.current || showForm) return;
      const { x, y } = getCanvasPos(e);
      const d = drawingRef.current;
      drawingRef.current = null;

      const canvas = canvasRef.current;
      if (!canvas) return;

      const W = canvas.width;
      const H = canvas.height;
      const rw = Math.abs(x - d.sx);
      const rh = Math.abs(y - d.sy);

      if (rw < 10 || rh < 10) {
        redrawCanvas(canvas, rails, null, pendingRect);
        return;
      }

      const newPending: PendingRect = {
        x: Math.min(d.sx, x) / W,
        y: Math.min(d.sy, y) / H,
        w: rw / W,
        h: rh / H,
      };

      setPendingRect(newPending);
      setFormProducts([{ dept: "", category: "", colour: "", description: "", productCode: "" }]);
      setShowForm(true);
    },
    [isDrawMode, rails, pendingRect, showForm],
  );

  function handleEditRail(rail: Rail) {
    setHoveredRail(null);
    // Pre-populate form from the rail's saved products (fall back to flat fields for older data)
    if (rail.products && rail.products.length > 0) {
      setFormProducts(rail.products.map((p) => ({
        productCode: p.productCode ?? "",
        dept: p.dept ?? "",
        category: p.category ?? "",
        colour: p.colour ?? "",
        description: p.description ?? "",
      })));
    } else {
      setFormProducts([{
        productCode: "",
        dept: rail.department ?? "",
        category: rail.category ?? "",
        colour: rail.colour ?? "",
        description: rail.description ?? "",
      }]);
    }
    setEditingRailId(rail.id);
    setPendingRect({ x: rail.x, y: rail.y, w: rail.w, h: rail.h });
    setShowForm(true);
  }

  function updateProduct(i: number, field: keyof ProductEntry, value: string) {
    setFormProducts((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  function addProduct() {
    setFormProducts((prev) => [...prev, { dept: "", category: "", colour: "", description: "", productCode: "" }]);
  }

  function removeProduct(i: number) {
    setFormProducts((prev) => prev.filter((_, idx) => idx !== i));
  }

  // ── Form save: generate Rail ID and add rail ───────────────────────
  function handleFormSave() {
    for (let i = 0; i < formProducts.length; i++) {
      const p = formProducts[i];
      const label = formProducts.length > 1 ? ` (Product ${i + 1})` : "";
      if (!p.productCode.trim()) { alert(`Please enter a product code${label}.`); return; }
      if (!p.dept.trim()) { alert(`Please enter a product department${label}.`); return; }
      if (!p.category.trim()) { alert(`Please enter a product category${label}.`); return; }
      if (!p.colour.trim()) { alert(`Please enter a colour${label}.`); return; }
    }
    if (!pendingRect) return;

    const first = formProducts[0];
    // Keep the same Rail ID when editing; generate a new one when creating
    const newId = editingRailId ?? generateRailId(first.dept, first.category, first.colour, rails.filter((r) => r.id !== editingRailId));
    const newRail: Rail = {
      id: newId,
      x: pendingRect.x,
      y: pendingRect.y,
      w: pendingRect.w,
      h: pendingRect.h,
      department: formProducts.map((p) => p.dept.trim()).join(" / "),
      category: formProducts.map((p) => p.category.trim()).join(" / "),
      colour: formProducts.map((p) => p.colour.trim()).join(" / "),
      description: formProducts.map((p) => p.description.trim()).filter(Boolean).join(" / "),
      products: formProducts.map((p) => ({ dept: p.dept.trim(), category: p.category.trim(), colour: p.colour.trim(), description: p.description.trim(), productCode: p.productCode.trim() })),
    };

    const updated = editingRailId
      ? rails.map((r) => r.id === editingRailId ? newRail : r)
      : [...rails, newRail];
    setRails(updated);
    setPendingRect(null);
    setShowForm(false);
    setEditingRailId(null);

    const canvas = canvasRef.current;
    if (canvas) redrawCanvas(canvas, updated, null, null);
  }

  function handleFormCancel() {
    setPendingRect(null);
    setShowForm(false);
    setEditingRailId(null);
    drawingRef.current = null;
    const canvas = canvasRef.current;
    if (canvas) redrawCanvas(canvas, rails, null, null);
  }

  // ── File upload ────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1200;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const offscreen = document.createElement("canvas");
        offscreen.width = Math.round(img.width * scale);
        offscreen.height = Math.round(img.height * scale);
        offscreen.getContext("2d")?.drawImage(img, 0, 0, offscreen.width, offscreen.height);
        setFloorPlanSrc(offscreen.toDataURL("image/jpeg", 0.75));
        setSaveMsg("");
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // ── Save to DB ─────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedBranch) { alert("Please select a branch code first."); return; }
    if (!floorPlanSrc) { alert("Please upload a floor plan image first."); return; }
    if (!floorName.trim()) { alert("Please enter a floor plan name."); return; }
    setIsSaving(true);
    setSaveMsg("");
    try {
      const resp = await fetch("/api/store-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchCode: selectedBranch, floorName: floorName.trim(), floorPlanImage: floorPlanSrc, railsData: rails }),
      });
      if (!resp.ok) throw new Error();
      // Refresh the existing floors list after saving
      fetch(`/api/store-layout/floors?branchCode=${encodeURIComponent(selectedBranch)}`)
        .then((r) => r.json())
        .then((names: string[]) => setExistingFloors(names))
        .catch(() => {});
      setSaveMsg("Floor plan and rail IDs saved successfully.");
    } catch {
      setSaveMsg("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Toggle draw mode ───────────────────────────────────────────────
  function toggleDrawMode() {
    if (!selectedBranch) { alert("Please select a branch code first."); return; }
    if (!floorPlanSrc) { alert("Please upload a floor plan before setting up rail IDs."); return; }
    setIsDrawMode((prev) => !prev);
    drawingRef.current = null;
  }

  // ── Print / Download helpers ──────────────────────────────────────
  async function getCompositeDataUrl(): Promise<string | null> {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const W = canvas.width || 620;
    const H = canvas.height || Math.round(W * 3 / 4);
    const offscreen = document.createElement("canvas");
    offscreen.width = W; offscreen.height = H;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return null;
    if (floorPlanSrc) {
      const img = new Image();
      img.src = floorPlanSrc;
      await new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); });
      ctx.drawImage(img, 0, 0, W, H);
    } else {
      ctx.fillStyle = "#a0a0a0"; ctx.fillRect(0, 0, W, H);
    }
    ctx.drawImage(canvas, 0, 0);
    return offscreen.toDataURL("image/png");
  }

  function buildRailTableHtml(): string {
    const rowsHtml = rails.map((rail) => {
      const products = rail.products?.length
        ? rail.products
        : [{ productCode: "", dept: rail.department, category: rail.category, colour: rail.colour, description: rail.description }];
      return products.map((p, pi) => `<tr>
        ${pi === 0 ? `<td rowspan="${products.length}" style="vertical-align:middle;font-weight:700;font-family:monospace;font-size:11px;color:#1a2a3a;">${rail.id}</td>` : ""}
        <td style="font-family:monospace;font-size:11px;">${p.productCode || "—"}</td>
        <td>${p.dept || "—"}</td><td>${p.category || "—"}</td>
        <td>${p.colour || "—"}</td><td>${p.description || "—"}</td>
      </tr>`).join("");
    }).join("");
    const thS = `text-align:left;padding:7px 10px;background:#4a9eda;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.05em;`;
    return `<table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead><tr>
        <th style="${thS}">Rail ID</th><th style="${thS}">Product Code</th>
        <th style="${thS}">Department</th><th style="${thS}">Category</th>
        <th style="${thS}">Colour</th><th style="${thS}">Description</th>
      </tr></thead><tbody>${rowsHtml}</tbody></table>`;
  }

  async function printFloorPlan() {
    const dataUrl = await getCompositeDataUrl();
    if (!dataUrl) return;
    const title = `Floor Plan — ${selectedBranch} / ${floorName}`;
    const win = window.open("", "_blank"); if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{margin:0;padding:20px;background:#fff;font-family:Arial,sans-serif;}
      h2{font-size:15px;color:#333;margin:0 0 10px;}p{font-size:11px;color:#888;margin:0 0 12px;}
      img{max-width:100%;border:1px solid #ddd;border-radius:6px;}
      @media print{@page{margin:1.5cm;}body{padding:0;}}
    </style></head><body>
      <h2>${title}</h2>
      <p>Printed ${new Date().toLocaleDateString("en-ZA", { day:"2-digit", month:"long", year:"numeric" })}</p>
      <img src="${dataUrl}" /></body></html>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 600);
  }

  function printRailInfo() {
    if (!rails.length) return;
    const title = `Rail Information — ${selectedBranch} / ${floorName}`;
    const win = window.open("", "_blank"); if (!win) return;
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{margin:0;padding:20px;font-family:Arial,sans-serif;background:#fff;color:#222;}
      h2{font-size:15px;color:#333;margin:0 0 6px;}p{font-size:11px;color:#888;margin:0 0 14px;}
      td,th{padding:7px 10px;border-bottom:1px solid #e8e8e8;vertical-align:top;}
      tr:nth-child(even) td{background:#f6faff;}
      @media print{@page{margin:1.5cm;size:landscape;}body{padding:0;}}
    </style></head><body>
      <h2>${title}</h2>
      <p>${rails.length} rail${rails.length !== 1 ? "s" : ""} · Printed ${new Date().toLocaleDateString("en-ZA", { day:"2-digit", month:"long", year:"numeric" })}</p>
      ${buildRailTableHtml()}</body></html>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 600);
  }

  async function printBoth() {
    const dataUrl = await getCompositeDataUrl();
    const title = `Store Layout — ${selectedBranch} / ${floorName}`;
    const win = window.open("", "_blank"); if (!win) return;
    const imgSec = dataUrl
      ? `<h3 style="font-size:13px;color:#333;margin:0 0 8px;">Floor Plan</h3><img src="${dataUrl}" style="max-width:100%;border:1px solid #ddd;border-radius:6px;" />`
      : "";
    win.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>
      body{margin:0;padding:20px;font-family:Arial,sans-serif;background:#fff;color:#222;}
      h2{font-size:15px;margin:0 0 6px;}h3{font-size:13px;margin:22px 0 8px;}
      p{font-size:11px;color:#888;margin:0 0 14px;}
      td,th{padding:7px 10px;border-bottom:1px solid #e8e8e8;vertical-align:top;}
      tr:nth-child(even) td{background:#f6faff;}
      @media print{@page{margin:1.5cm;}body{padding:0;}.pb{page-break-before:always;}}
    </style></head><body>
      <h2>${title}</h2>
      <p>Printed ${new Date().toLocaleDateString("en-ZA", { day:"2-digit", month:"long", year:"numeric" })}</p>
      ${imgSec}
      ${rails.length > 0 ? `<div class="pb"><h3>Rail Information</h3><p>${rails.length} rail${rails.length !== 1 ? "s" : ""}</p>${buildRailTableHtml()}</div>` : ""}
    </body></html>`);
    win.document.close(); win.focus(); setTimeout(() => win.print(), 600);
  }

  async function downloadFloorPlan() {
    const dataUrl = await getCompositeDataUrl();
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `FloorPlan_${selectedBranch}_${floorName}.png`.replace(/\s+/g, "_");
    a.click();
  }

  function downloadRailInfo() {
    if (!rails.length) return;
    const rows = [["Rail ID", "Product Code", "Department", "Category", "Colour", "Description"]];
    for (const rail of rails) {
      const products = rail.products?.length
        ? rail.products
        : [{ productCode: "", dept: rail.department, category: rail.category, colour: rail.colour, description: rail.description }];
      for (const p of products) {
        rows.push([rail.id, p.productCode || "", p.dept || "", p.category || "", p.colour || "", p.description || ""]);
      }
    }
    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RailInfo_${selectedBranch}_${floorName}.csv`.replace(/\s+/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  }

  const hasContent = !!(floorPlanSrc || rails.length > 0);

  const btnStyle: React.CSSProperties = {
    background: "#fff",
    color: "#111",
    border: "none",
    borderRadius: 10,
    padding: "0.85rem 0",
    fontSize: "1.05rem",
    fontWeight: 600,
    cursor: "pointer",
    flex: 1,
    minWidth: 160,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#2a2a2a",
    border: "1px solid #444",
    borderRadius: 6,
    color: "#fff",
    padding: "0.5rem 0.75rem",
    fontSize: "0.95rem",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    color: "#bbb",
    marginBottom: "0.3rem",
    display: "block",
    fontWeight: 600,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      {/* ── Header ───────────────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.5rem", gap: "1rem" }}>
        <button
          onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}
          title="Go to Dashboard"
        >
          <img src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`} alt="Fast Picker" style={{ height: 56, objectFit: "contain" }} />
        </button>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", margin: 0, flex: 1, lineHeight: 1 }}>
          Account: {user ? `${user.forenames} ${user.surname}` : "User"}
        </h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button
            type="button"
            onClick={() => { localStorage.removeItem("fp_user"); setLocation("/login"); }}
            style={{ background: "none", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", letterSpacing: "0.08em", padding: 0, textTransform: "uppercase" }}
          >
            LOGOUT
          </button>
          <LiveClock color="#ccc" size="sm" />
        </div>
      </header>

      {/* ── Breadcrumb ───────────────────────────────────────────────── */}
      <div style={{ padding: "0.25rem 1.5rem 0.75rem", fontSize: "0.82rem", color: "#bbb" }}>
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 0, fontSize: "0.82rem" }}
        >
          Home
        </button>
        {"/Setup Shop Layout"}
      </div>

      {/* ── Branch Code ──────────────────────────────────────────────── */}
      <div style={{ padding: "0 1.5rem", maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ background: "#555", color: "#fff", fontWeight: 700, fontSize: "0.97rem", padding: "0.55rem 1rem", whiteSpace: "nowrap", minWidth: 140, display: "flex", alignItems: "center" }}>
            Branch Code
          </div>
          <select
            value={selectedBranch}
            onChange={(e) => { setSelectedBranch(e.target.value); setFloorName("Ground Floor"); setIsDrawMode(false); setPendingRect(null); setShowForm(false); setSaveMsg(""); }}
            style={selectStyle}
            disabled={!isAdmin && branches.length <= 1}
          >
            <option value="">Select branch code</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* ── Floor Plan Name row ──────────────────────────────────────── */}
      <div style={{ padding: "0.5rem 1.5rem 0", maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ background: "#555", color: "#fff", fontWeight: 700, fontSize: "0.97rem", padding: "0.55rem 1rem", whiteSpace: "nowrap", minWidth: 140, display: "flex", alignItems: "center" }}>
            Floor Plan Name
          </div>
          <input
            type="text"
            value={floorName}
            onChange={(e) => { setFloorName(e.target.value); setIsDrawMode(false); setSaveMsg(""); }}
            placeholder="e.g. Ground Floor"
            style={{
              flex: 1,
              background: "#d4d4d4",
              border: "none",
              padding: "0.5rem 0.85rem",
              fontSize: "0.97rem",
              color: "#222",
              outline: "none",
              minWidth: 0,
            }}
          />
        </div>
        {/* Existing floors for this branch as quick-select chips */}
        {existingFloors.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.45rem" }}>
            <span style={{ fontSize: "0.78rem", color: "#888", lineHeight: "1.8" }}>Saved floors:</span>
            {existingFloors.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => { setFloorName(f); setIsDrawMode(false); setSaveMsg(""); }}
                style={{
                  background: floorName === f ? "#4a9eda" : "#2a2a2a",
                  color: floorName === f ? "#fff" : "#ccc",
                  border: `1px solid ${floorName === f ? "#4a9eda" : "#444"}`,
                  borderRadius: 20,
                  padding: "0.15rem 0.7rem",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                  lineHeight: "1.6",
                }}
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Draw mode hint ────────────────────────────────────────────── */}
      {isDrawMode && !showForm && (
        <div style={{ textAlign: "center", padding: "0.5rem 1.5rem 0", fontSize: "0.85rem", color: "#4a9eda", fontStyle: "italic" }}>
          Draw mode active — click and drag on the floor plan to mark a rail section.
        </div>
      )}

      {/* ── Floor plan + canvas overlay ───────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem 1.5rem 0.5rem" }}>
        <div
          ref={containerRef}
          style={{ width: "min(620px, 92vw)", aspectRatio: "4/3", background: "#a0a0a0", position: "relative", overflow: "hidden" }}
        >
          {floorPlanSrc ? (
            <img src={floorPlanSrc} alt="Floor plan" style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }} />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 500, textAlign: "center", padding: "1rem" }}>
                Uploaded floor plan compressed image
              </span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              cursor: isDrawMode && !showForm ? "crosshair" : hoveredRail ? "pointer" : "default",
              pointerEvents: "all",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onDoubleClick={handleDoubleClick}
            onMouseLeave={(e) => {
              setHoveredRail(null);
              if (drawingRef.current) handleMouseUp(e as React.MouseEvent<HTMLCanvasElement>);
            }}
          />

          {/* "Double-click to edit" cursor label */}
          {hoveredRail && !showForm && !isDrawMode && (
            <div
              style={{
                position: "absolute",
                left: hoverPos.x + 14,
                top: hoverPos.y + 18,
                background: "rgba(20,30,48,0.92)",
                border: "1px solid #4a9eda",
                borderRadius: 5,
                padding: "0.18rem 0.55rem",
                fontSize: "0.74rem",
                color: "#aad4f5",
                fontWeight: 600,
                pointerEvents: "none",
                whiteSpace: "nowrap",
                zIndex: 100,
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
              }}
            >
              Double-click to edit
            </div>
          )}
        </div>

        {rails.length > 0 && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "#4a9eda" }}>
            {rails.length} rail{rails.length !== 1 ? "s" : ""} marked
            {" · "}
            <span style={{ color: "#666" }}>Double-click a Rail ID label to edit</span>
            {" · "}
            <button
              type="button"
              onClick={() => { setRails([]); const c = canvasRef.current; if (c) redrawCanvas(c, [], null, null); }}
              style={{ background: "none", border: "none", color: "#ff7070", cursor: "pointer", fontSize: "0.82rem", padding: 0 }}
            >
              Clear all
            </button>
          </p>
        )}

        {saveMsg && (
          <p style={{ marginTop: "0.5rem", color: saveMsg.includes("success") ? "#6ddd6d" : "#ff7070", fontSize: "0.9rem" }}>
            {saveMsg}
          </p>
        )}
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

      {/* ── Print / Download row ──────────────────────────────────────── */}
      {hasContent && selectedBranch && (
        <div style={{ display: "flex", gap: "0.6rem", padding: "0 1.5rem 0.25rem", justifyContent: "center", flexWrap: "wrap" }}>
          {floorPlanSrc && (
            <>
              <button type="button" onClick={printFloorPlan}
                style={{ background: "rgba(74,158,218,0.15)", border: "1px solid #4a9eda", color: "#4a9eda", padding: "0.32rem 0.85rem", borderRadius: 7, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                🖨 Print Floor Plan
              </button>
              <button type="button" onClick={downloadFloorPlan}
                style={{ background: "rgba(74,158,218,0.08)", border: "1px solid #4a9eda", color: "#4a9eda", padding: "0.32rem 0.85rem", borderRadius: 7, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                ⬇ Download Floor Plan
              </button>
            </>
          )}
          {rails.length > 0 && (
            <>
              <button type="button" onClick={printRailInfo}
                style={{ background: "rgba(74,158,218,0.15)", border: "1px solid #4a9eda", color: "#4a9eda", padding: "0.32rem 0.85rem", borderRadius: 7, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                🖨 Print Rail Info
              </button>
              <button type="button" onClick={downloadRailInfo}
                style={{ background: "rgba(74,158,218,0.08)", border: "1px solid #4a9eda", color: "#4a9eda", padding: "0.32rem 0.85rem", borderRadius: 7, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                ⬇ Download Rail CSV
              </button>
            </>
          )}
          {floorPlanSrc && rails.length > 0 && (
            <button type="button" onClick={printBoth}
              style={{ background: "#4a9eda", border: "none", color: "#fff", padding: "0.32rem 0.85rem", borderRadius: 7, fontSize: "0.8rem", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
              🖨 Print Both
            </button>
          )}
        </div>
      )}

      {/* ── Action buttons ────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: "1.5rem", padding: "1.25rem 1.5rem 2.5rem", justifyContent: "center", flexWrap: "wrap" }}>
        <button type="button" style={btnStyle} onClick={() => fileInputRef.current?.click()}>
          Upload Floor Plan
        </button>
        <button
          type="button"
          style={{ ...btnStyle, opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer" }}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          style={{ ...btnStyle, background: isDrawMode ? "#4a9eda" : "#fff", color: isDrawMode ? "#fff" : "#111", outline: isDrawMode ? "2px solid #fff" : "none" }}
          onClick={toggleDrawMode}
        >
          {isDrawMode ? "Exit Rail Setup" : "Setup Rail IDs"}
        </button>
      </div>

      {/* ── Rail detail popup form ─────────────────────────────────────── */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #444",
              borderRadius: 12,
              padding: "2rem",
              width: "min(420px, 92vw)",
              display: "flex",
              flexDirection: "column",
              gap: "1.1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #333", paddingBottom: "0.75rem" }}>
              <h2 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 700, color: "#fff" }}>
                {editingRailId ? `Edit Rail — ${editingRailId}` : "Rail Details"}
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: "0.82rem", color: "#999" }}>
              {editingRailId
                ? "Update the product details below. The Rail ID will remain unchanged."
                : "Fill in the details for each product on this rail. The Rail ID is generated from the first product when you save."}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "55vh", overflowY: "auto", paddingRight: "0.25rem" }}>
              {formProducts.map((p, i) => (
                <div
                  key={i}
                  style={{
                    background: "#111",
                    border: "1px solid #333",
                    borderRadius: 10,
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {formProducts.length > 1 ? `Product ${i + 1}` : "Product"}
                    </span>
                    {formProducts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(i)}
                        title="Remove this product"
                        style={{ background: "#3a1a1a", border: "1px solid #662222", color: "#ff7070", borderRadius: 6, padding: "0.2rem 0.55rem", fontSize: "0.78rem", fontWeight: 600, cursor: "pointer" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label style={labelStyle}>Product Code *</label>
                    <input
                      type="text"
                      value={p.productCode}
                      onChange={(e) => updateProduct(i, "productCode", e.target.value)}
                      placeholder="e.g. MSW-SHT-001"
                      style={inputStyle}
                      autoFocus={i === 0}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Department *</label>
                    <input
                      type="text"
                      value={p.dept}
                      onChange={(e) => updateProduct(i, "dept", e.target.value)}
                      placeholder="e.g. Menswear"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Category *</label>
                    <input
                      type="text"
                      value={p.category}
                      onChange={(e) => updateProduct(i, "category", e.target.value)}
                      placeholder="e.g. Shirts"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Colour *</label>
                    <input
                      type="text"
                      value={p.colour}
                      onChange={(e) => updateProduct(i, "colour", e.target.value)}
                      placeholder="e.g. Navy Blue"
                      style={inputStyle}
                    />
                  </div>

                  <div>
                    <label style={labelStyle}>Short Description</label>
                    <input
                      type="text"
                      value={p.description}
                      onChange={(e) => updateProduct(i, "description", e.target.value)}
                      placeholder="e.g. Formal long-sleeve shirts"
                      style={inputStyle}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addProduct}
              style={{ background: "transparent", border: "1px dashed #555", color: "#ccc", borderRadius: 8, padding: "0.6rem 1rem", fontSize: "0.9rem", fontWeight: 600, cursor: "pointer", textAlign: "center" }}
            >
              + Add another product
            </button>

            <div style={{ display: "flex", gap: "1rem", marginTop: "0.25rem" }}>
              <button
                type="button"
                onClick={handleFormCancel}
                style={{ flex: 1, background: "#333", color: "#fff", border: "none", borderRadius: 8, padding: "0.7rem", fontSize: "0.97rem", fontWeight: 600, cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleFormSave}
                style={{ flex: 1, background: "#fff", color: "#111", border: "none", borderRadius: 8, padding: "0.7rem", fontSize: "0.97rem", fontWeight: 700, cursor: "pointer" }}
              >
                {editingRailId ? "Update and Save" : "Save & Generate Rail ID"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
