import { useState, useEffect, useRef } from "react";
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

export default function SetupStoreLayout() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [floorPlanSrc, setFloorPlanSrc] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const isAdmin = user?.isAdmin === true;

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

  // Load saved floor plan when branch changes
  useEffect(() => {
    if (!selectedBranch) { setFloorPlanSrc(null); return; }
    fetch(`/api/store-layout?branchCode=${encodeURIComponent(selectedBranch)}`)
      .then((r) => r.json())
      .then((d) => setFloorPlanSrc(d.floorPlanImage ?? null))
      .catch(() => setFloorPlanSrc(null));
  }, [selectedBranch]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      // Compress if large by drawing on a canvas
      const img = new Image();
      img.onload = () => {
        const MAX_W = 1200;
        const scale = img.width > MAX_W ? MAX_W / img.width : 1;
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const compressed = canvas.toDataURL("image/jpeg", 0.75);
        setFloorPlanSrc(compressed);
        setSaveMsg("");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
    // Reset file input so same file can be re-selected
    e.target.value = "";
  }

  async function handleSave() {
    if (!selectedBranch) { alert("Please select a branch code first."); return; }
    if (!floorPlanSrc) { alert("Please upload a floor plan image first."); return; }

    setIsSaving(true);
    setSaveMsg("");
    try {
      const resp = await fetch("/api/store-layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branchCode: selectedBranch, floorPlanImage: floorPlanSrc }),
      });
      if (!resp.ok) throw new Error("Save failed");
      setSaveMsg("Floor plan saved successfully.");
    } catch {
      setSaveMsg("Save failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
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
    transition: "background 0.15s",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        display: "flex",
        flexDirection: "column",
        color: "#fff",
      }}
    >
      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0.75rem 1.5rem",
          gap: "1rem",
        }}
      >
        <button
          onClick={() => setLocation("/dashboard")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
          }}
          title="Go to Dashboard"
        >
          <img
            src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
            alt="Fast Picker"
            style={{ height: 56, objectFit: "contain" }}
          />
        </button>
        <h1
          style={{
            fontSize: "2.2rem",
            fontWeight: 700,
            color: "#fff",
            margin: 0,
            flex: 1,
            lineHeight: 1,
          }}
        >
          Account: {user ? `${user.forenames} ${user.surname}` : "User"}
        </h1>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
          }}
        >
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("fp_user");
              setLocation("/login");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              letterSpacing: "0.08em",
              padding: 0,
              textTransform: "uppercase",
            }}
          >
            LOGOUT
          </button>
          <LiveClock color="#ccc" size="sm" />
        </div>
      </header>

      {/* Breadcrumb */}
      <div
        style={{
          padding: "0.25rem 1.5rem 0.75rem",
          fontSize: "0.82rem",
          color: "#bbb",
        }}
      >
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          style={{
            background: "none",
            border: "none",
            color: "#bbb",
            cursor: "pointer",
            padding: 0,
            fontSize: "0.82rem",
          }}
        >
          Home
        </button>
        {"/Setup Shop Layout"}
      </div>

      {/* Branch Code row */}
      <div style={{ padding: "0 1.5rem", maxWidth: 720 }}>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <div
            style={{
              background: "#555",
              color: "#fff",
              fontWeight: 700,
              fontSize: "0.97rem",
              padding: "0.55rem 1rem",
              whiteSpace: "nowrap",
              minWidth: 140,
              display: "flex",
              alignItems: "center",
            }}
          >
            Branch Code
          </div>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            style={selectStyle}
            disabled={!isAdmin && branches.length <= 1}
          >
            <option value="">Select branch code</option>
            {branches.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Floor plan preview area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "2rem 1.5rem 1rem",
        }}
      >
        <div
          style={{
            width: "min(520px, 90vw)",
            aspectRatio: "4/3",
            background: "#a0a0a0",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            position: "relative",
          }}
        >
          {floorPlanSrc ? (
            <img
              src={floorPlanSrc}
              alt="Floor plan"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          ) : (
            <span
              style={{
                color: "#fff",
                fontSize: "1.05rem",
                fontWeight: 500,
                textAlign: "center",
                padding: "1rem",
              }}
            >
              Uploaded floor plan compressed image
            </span>
          )}
        </div>

        {saveMsg && (
          <p
            style={{
              marginTop: "0.75rem",
              color: saveMsg.includes("success") ? "#6ddd6d" : "#ff7070",
              fontSize: "0.9rem",
            }}
          >
            {saveMsg}
          </p>
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: "1.5rem",
          padding: "1.5rem 1.5rem 2.5rem",
          justifyContent: "center",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          style={btnStyle}
          onClick={() => fileInputRef.current?.click()}
        >
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
          style={btnStyle}
          onClick={() => {
            if (!selectedBranch) { alert("Please select a branch code first."); return; }
            setLocation(`/setup-rail-ids?branch=${encodeURIComponent(selectedBranch)}`);
          }}
        >
          Setup Rail IDs
        </button>
      </div>
    </div>
  );
}
