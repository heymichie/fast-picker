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

interface Rail {
  id: string;
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

export default function SetupStoreLayout() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [floorPlanSrc, setFloorPlanSrc] = useState<string | null>(null);
  const [rails, setRails] = useState<Rail[]>([]);
  const [isDrawMode, setIsDrawMode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const drawingRef = useRef<{ sx: number; sy: number; cx: number; cy: number } | null>(null);
  const railCountRef = useRef(0);
  const isAdmin = user?.isAdmin === true;

  function nextRailId(existingRails: Rail[]) {
    const used = new Set(existingRails.map((r) => r.id));
    let n = existingRails.length + 1;
    let candidate = `RL-${String(n).padStart(3, "0")}`;
    while (used.has(candidate)) {
      n += 1;
      candidate = `RL-${String(n).padStart(3, "0")}`;
    }
    railCountRef.current = n;
    return candidate;
  }

  // Sync canvas size to its container
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

  // Redraw whenever rails or isDrawMode changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    redrawCanvas(canvas, rails, drawingRef.current);
  }, [rails, isDrawMode]);

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

  // Load saved floor plan + rails when branch changes
  useEffect(() => {
    if (!selectedBranch) {
      setFloorPlanSrc(null);
      setRails([]);
      railCountRef.current = 0;
      return;
    }
    fetch(`/api/store-layout?branchCode=${encodeURIComponent(selectedBranch)}`)
      .then((r) => r.json())
      .then((d) => {
        setFloorPlanSrc(d.floorPlanImage ?? null);
        const loaded: Rail[] = Array.isArray(d.railsData) ? d.railsData : [];
        setRails(loaded);
        railCountRef.current = loaded.length;
      })
      .catch(() => {
        setFloorPlanSrc(null);
        setRails([]);
        railCountRef.current = 0;
      });
  }, [selectedBranch]);

  // ── Canvas mouse handlers ──────────────────────────────────────────
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
      if (!isDrawMode) return;
      const { x, y } = getCanvasPos(e);
      drawingRef.current = { sx: x, sy: y, cx: x, cy: y };
    },
    [isDrawMode],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawMode || !drawingRef.current) return;
      const { x, y } = getCanvasPos(e);
      drawingRef.current = { ...drawingRef.current, cx: x, cy: y };
      const canvas = canvasRef.current;
      if (canvas) redrawCanvas(canvas, rails, drawingRef.current);
    },
    [isDrawMode, rails],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawMode || !drawingRef.current) return;
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
        redrawCanvas(canvas, rails, null);
        return;
      }

      const newRail: Rail = {
        id: nextRailId(rails),
        x: Math.min(d.sx, x) / W,
        y: Math.min(d.sy, y) / H,
        w: rw / W,
        h: rh / H,
      };

      setRails((prev) => {
        const updated = [...prev, newRail];
        redrawCanvas(canvas, updated, null);
        return updated;
      });
    },
    [isDrawMode, rails],
  );

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

  // ── Save ───────────────────────────────────────────────────────────
  async function handleSave() {
    if (!selectedBranch) { alert("Please select a branch code first."); return; }
    if (!floorPlanSrc) { alert("Please upload a floor plan image first."); return; }
    setIsSaving(true);
    setSaveMsg("");
    try {
      const resp = await fetch("/api/store-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchCode: selectedBranch, floorPlanImage: floorPlanSrc, railsData: rails }),
      });
      if (!resp.ok) throw new Error("Save failed");
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
    transition: "background 0.15s, color 0.15s",
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
            style={{ background: "none", border: "none", color: "#fff", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", letterSpacing: "0.08em", padding: 0, textTransform: "uppercase" }}
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
        {"/Setup Shop Layout"}
      </div>

      {/* Branch Code row */}
      <div style={{ padding: "0 1.5rem", maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div style={{ background: "#555", color: "#fff", fontWeight: 700, fontSize: "0.97rem", padding: "0.55rem 1rem", whiteSpace: "nowrap", minWidth: 140, display: "flex", alignItems: "center" }}>
            Branch Code
          </div>
          <select
            value={selectedBranch}
            onChange={(e) => { setSelectedBranch(e.target.value); setIsDrawMode(false); }}
            style={selectStyle}
            disabled={!isAdmin && branches.length <= 1}
          >
            <option value="">Select branch code</option>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
      </div>

      {/* Draw mode hint */}
      {isDrawMode && (
        <div style={{ textAlign: "center", padding: "0.5rem 1.5rem 0", fontSize: "0.85rem", color: "#4a9eda", fontStyle: "italic" }}>
          Draw mode active — click and drag on the floor plan to mark a rail section. Click "Setup Rail IDs" again to exit.
        </div>
      )}

      {/* Floor plan area with canvas overlay */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem 1.5rem 0.5rem" }}>
        <div
          ref={containerRef}
          style={{ width: "min(620px, 92vw)", aspectRatio: "4/3", background: "#a0a0a0", position: "relative", overflow: "hidden" }}
        >
          {floorPlanSrc ? (
            <img
              src={floorPlanSrc}
              alt="Floor plan"
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
            />
          ) : (
            <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontSize: "1.05rem", fontWeight: 500, textAlign: "center", padding: "1rem" }}>
                Uploaded floor plan compressed image
              </span>
            </div>
          )}

          {/* Canvas overlay — always present, only interactive in draw mode */}
          <canvas
            ref={canvasRef}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              cursor: isDrawMode ? "crosshair" : "default",
              pointerEvents: isDrawMode ? "all" : "none",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={(e) => {
              if (drawingRef.current) handleMouseUp(e as React.MouseEvent<HTMLCanvasElement>);
            }}
          />
        </div>

        {/* Rail count indicator */}
        {rails.length > 0 && (
          <p style={{ margin: "0.5rem 0 0", fontSize: "0.82rem", color: "#4a9eda" }}>
            {rails.length} rail{rails.length !== 1 ? "s" : ""} marked
            {" · "}
            <button
              type="button"
              onClick={() => { setRails([]); railCountRef.current = 0; }}
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

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />

      {/* Action buttons */}
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
          style={{
            ...btnStyle,
            background: isDrawMode ? "#4a9eda" : "#fff",
            color: isDrawMode ? "#fff" : "#111",
            outline: isDrawMode ? "2px solid #fff" : "none",
          }}
          onClick={toggleDrawMode}
        >
          {isDrawMode ? "Exit Rail Setup" : "Setup Rail IDs"}
        </button>
      </div>
    </div>
  );
}
