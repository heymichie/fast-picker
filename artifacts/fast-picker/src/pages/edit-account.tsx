import { useState, useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2 } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("fp_user");
    if (!raw) return null;
    return JSON.parse(raw) as {
      username: string; forenames: string; surname: string;
      designation: string; isAdmin?: boolean; branchCode?: string | null;
    };
  } catch { return null; }
}

const ALL_RIGHTS = ["Store Manager", "Store Supervisor", "Merchandiser", "Administrator", "Order Picker"] as const;
const STORE_MANAGER_RIGHTS = ["Store Supervisor", "Merchandiser", "Order Picker"] as const;

interface UserDetail {
  username: string;
  forenames: string;
  surname: string;
  employeeNumber: string | null;
  email: string | null;
  department: string | null;
  rights: string;
  branchCode: string;
  isActive: boolean;
}

export default function EditAccount() {
  const [, setLocation] = useLocation();
  const params = useParams<{ username: string }>();
  const targetUsername = params.username ?? "";

  const currentUser = getStoredUser();
  const isStoreManager = currentUser?.designation === "Store Manager";
  const isAdmin = !!(currentUser?.isAdmin || currentUser?.designation === "Administrator");
  const RIGHTS = isStoreManager ? [...STORE_MANAGER_RIGHTS] : [...ALL_RIGHTS];

  const [loadingUser, setLoadingUser] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [departments, setDepartments] = useState<string[]>([]);

  // Form state
  const [forenames, setForenames] = useState("");
  const [surname, setSurname] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [customDept, setCustomDept] = useState("");
  const [rights, setRights] = useState("");
  const [branchCode, setBranchCode] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Saved "applied" snapshot (Apply button locks in a local preview without hitting DB)
  const [applied, setApplied] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);

  // Save feedback
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load departments
  useEffect(() => {
    fetch("/api/store-layout/departments")
      .then((r) => r.json())
      .then((data: string[]) => setDepartments(Array.isArray(data) ? data : []))
      .catch(() => setDepartments([]));
  }, []);

  // Load user data
  useEffect(() => {
    if (!targetUsername) return;
    setLoadingUser(true);
    fetch(`/api/accounts/${encodeURIComponent(targetUsername)}`)
      .then((r) => {
        if (!r.ok) { setNotFound(true); setLoadingUser(false); return null; }
        return r.json();
      })
      .then((data: UserDetail | null) => {
        if (!data) return;
        setForenames(data.forenames);
        setSurname(data.surname);
        setEmployeeNumber(data.employeeNumber ?? "");
        setEmail(data.email ?? "");
        const dept = data.department ?? "";
        const knownDept = departments.includes(dept) || dept === "ALL" || dept === "";
        setDepartment(knownDept ? dept : "Other");
        setCustomDept(knownDept ? "" : dept);
        setRights(data.rights);
        setBranchCode(data.branchCode);
        setIsActive(data.isActive);
        setLoadingUser(false);
      })
      .catch(() => { setNotFound(true); setLoadingUser(false); });
  }, [targetUsername]);

  // Re-check department against loaded list
  useEffect(() => {
    if (!loadingUser && department === "" && departments.length > 0) return;
  }, [departments]);

  function validate(): string | null {
    if (!forenames.trim()) return "Fore Name(s) is required.";
    if (!surname.trim()) return "Surname is required.";
    if (!rights) return "User rights must be selected.";
    if (!branchCode.trim()) return "Branch Code is required.";
    if (department === "Other" && !customDept.trim()) return "Please enter a custom department name.";
    return null;
  }

  function handleApply() {
    setApplyError(null);
    const err = validate();
    if (err) { setApplyError(err); return; }
    setApplied(true);
  }

  async function handleSave(andNavigate: boolean) {
    setSaveError(null);
    const err = validate();
    if (err) { setSaveError(err); return; }

    setIsSaving(true);
    const effectiveDept = department === "Other" ? customDept.trim() : department;
    const effectiveBranch = rights === "Administrator" ? "ALL" : branchCode.trim();

    try {
      const res = await fetch(`/api/accounts/${encodeURIComponent(targetUsername)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forenames: forenames.trim(),
          surname: surname.trim(),
          employeeNumber: employeeNumber.trim() || null,
          email: email.trim() || null,
          department: effectiveDept || null,
          rights,
          branchCode: effectiveBranch,
          isActive,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setSaveError(body.error ?? "Failed to save changes.");
        return;
      }
      setSaveSuccess(true);
      setApplied(false);
      if (andNavigate) {
        setTimeout(() => setLocation("/manage-accounts"), 800);
      }
    } catch {
      setSaveError("Unable to connect. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────
  const cellStyle = (light: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderBottom: "1px solid #999",
    background: light ? "#e8e8e8" : "#d8d8d8",
    verticalAlign: "top",
    color: "#111",
    fontSize: "0.95rem",
  });

  const inputStyle: React.CSSProperties = {
    background: "transparent",
    border: "none",
    borderBottom: "1.5px solid #555",
    outline: "none",
    width: "100%",
    fontSize: "0.95rem",
    color: "#111",
    padding: "2px 0",
  };

  const btnBase: React.CSSProperties = {
    padding: "0.6rem 2.2rem",
    borderRadius: 7,
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
    border: "1.5px solid",
    minWidth: 120,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    transition: "opacity 0.15s",
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      {/* Header */}
      <header style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.5rem", gap: "1rem" }}>
        <button onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", flexShrink: 0 }}>
          <img src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`} alt="Fast Picker" style={{ height: 56, objectFit: "contain" }} />
        </button>
        <h1 style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", margin: 0, flex: 1, lineHeight: 1 }}>
          Account: {currentUser ? `${currentUser.forenames} ${currentUser.surname}` : "User"}
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
        {" / "}
        <button type="button" onClick={() => setLocation("/manage-accounts")}
          style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 0, fontSize: "0.82rem" }}>Manage Account</button>
        {` / Edit: ${targetUsername}`}
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: "0 1.5rem 2rem" }}>
        {loadingUser ? (
          <div style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
            <Loader2 style={{ width: 32, height: 32, color: "#888", animation: "spin 1s linear infinite" }} />
          </div>
        ) : notFound ? (
          <div style={{ paddingTop: "3rem", color: "#f66" }}>
            <p>User "{targetUsername}" not found or is an administrator account (not editable here).</p>
            <button onClick={() => setLocation("/manage-accounts")}
              style={{ ...btnBase, background: "#fff", color: "#333", borderColor: "#999", marginTop: 16 }}>
              Back to Manage Accounts
            </button>
          </div>
        ) : (
          <>
            {/* Applied indicator */}
            {applied && !saveSuccess && (
              <div style={{ marginBottom: 14, padding: "0.55rem 1rem", background: "rgba(42,106,212,0.12)", border: "1px solid #2a6ad4", borderRadius: 7, fontSize: "0.85rem", color: "#7aaeff" }}>
                ✔ Changes applied locally — click <strong>Save</strong> to commit to the database.
              </div>
            )}
            {saveSuccess && (
              <div style={{ marginBottom: 14, padding: "0.55rem 1rem", background: "rgba(30,150,80,0.12)", border: "1px solid #2a8a50", borderRadius: 7, fontSize: "0.85rem", color: "#6edc9a" }}>
                ✔ Changes saved successfully.
              </div>
            )}

            <table style={{ width: "100%", maxWidth: 820, borderCollapse: "collapse", border: "1.5px solid #888" }}>
              <colgroup>
                <col style={{ width: "36%" }} />
                <col style={{ width: "64%" }} />
              </colgroup>
              <tbody>

                {/* Username — read-only */}
                <tr>
                  <td style={cellStyle(true)}>
                    Username
                    <div style={{ fontSize: "0.72rem", color: "#555", marginTop: 3, fontStyle: "italic" }}>Cannot be changed</div>
                  </td>
                  <td style={cellStyle(true)}>
                    <span style={{ fontWeight: 700, color: "#111" }}>{targetUsername}</span>
                  </td>
                </tr>

                {/* Fore Name(s) */}
                <tr>
                  <td style={cellStyle(false)}>Fore Name(s)</td>
                  <td style={cellStyle(false)}>
                    <input style={inputStyle} type="text" value={forenames}
                      onChange={(e) => { setForenames(e.target.value); setApplied(false); setSaveSuccess(false); }}
                      placeholder="Enter fore name(s)" />
                  </td>
                </tr>

                {/* Surname */}
                <tr>
                  <td style={cellStyle(true)}>Surname</td>
                  <td style={cellStyle(true)}>
                    <input style={inputStyle} type="text" value={surname}
                      onChange={(e) => { setSurname(e.target.value); setApplied(false); setSaveSuccess(false); }}
                      placeholder="Enter surname" />
                  </td>
                </tr>

                {/* Employee Number */}
                <tr>
                  <td style={cellStyle(false)}>Employee Number</td>
                  <td style={cellStyle(false)}>
                    <input style={inputStyle} type="text" value={employeeNumber}
                      onChange={(e) => setEmployeeNumber(e.target.value)}
                      placeholder="" />
                  </td>
                </tr>

                {/* Staff email address */}
                <tr>
                  <td style={cellStyle(true)}>Staff email address</td>
                  <td style={cellStyle(true)}>
                    <input style={inputStyle} type="email" value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="" />
                  </td>
                </tr>

                {/* Department */}
                <tr>
                  <td style={cellStyle(false)}>Department</td>
                  <td style={cellStyle(false)}>
                    <select value={department}
                      onChange={(e) => { setDepartment(e.target.value); if (e.target.value !== "Other") setCustomDept(""); }}
                      style={{ ...inputStyle, appearance: "auto", WebkitAppearance: "auto", cursor: "pointer", paddingBottom: "2px" }}>
                      <option value="">— None —</option>
                      <option value="ALL">ALL</option>
                      {departments.map((d) => <option key={d} value={d}>{d}</option>)}
                      <option value="Other">Other (type below)</option>
                    </select>
                    {department === "Other" && (
                      <input type="text" value={customDept}
                        onChange={(e) => setCustomDept(e.target.value)}
                        placeholder="Enter department name"
                        style={{ ...inputStyle, marginTop: 8 }} autoFocus />
                    )}
                  </td>
                </tr>

                {/* Rights */}
                <tr>
                  <td style={cellStyle(true)}>Rights</td>
                  <td style={{ ...cellStyle(true) }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {RIGHTS.map((r) => (
                        <label key={r} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "#111" }}>
                          <input type="radio" name="rights" value={r} checked={rights === r}
                            onChange={() => { setRights(r); setApplied(false); setSaveSuccess(false); }}
                            style={{ accentColor: "#333", width: 15, height: 15 }} />
                          {r}
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>

                {/* Branch Code — editable only for admins */}
                <tr>
                  <td style={cellStyle(false)}>Branch Code</td>
                  <td style={cellStyle(false)}>
                    {isAdmin ? (
                      <input style={inputStyle} type="text" value={rights === "Administrator" ? "ALL" : branchCode}
                        onChange={(e) => setBranchCode(e.target.value)}
                        disabled={rights === "Administrator"}
                        placeholder="e.g. JHB001" />
                    ) : (
                      <span style={{ color: "#111" }}>{branchCode}</span>
                    )}
                  </td>
                </tr>

                {/* Account Status */}
                <tr>
                  <td style={cellStyle(true)}>Account Status</td>
                  <td style={cellStyle(true)}>
                    <div style={{ display: "flex", gap: 16 }}>
                      {[{ val: true, label: "Active" }, { val: false, label: "Inactive" }].map(({ val, label }) => (
                        <label key={label} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", color: "#111" }}>
                          <input type="radio" name="isActive" checked={isActive === val}
                            onChange={() => { setIsActive(val); setApplied(false); setSaveSuccess(false); }}
                            style={{ accentColor: "#333", width: 15, height: 15 }} />
                          <span style={{ color: val ? "#1a7a1a" : "#cc0000", fontWeight: 600 }}>{label}</span>
                        </label>
                      ))}
                    </div>
                  </td>
                </tr>

              </tbody>
            </table>

            {/* Error messages */}
            {(applyError || saveError) && (
              <p style={{ color: "#f66", fontSize: "0.85rem", marginTop: 12, maxWidth: 820 }}>
                {applyError || saveError}
              </p>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: 24, flexWrap: "wrap" }}>

              {/* Apply */}
              <button type="button" onClick={handleApply} disabled={isSaving}
                style={{ ...btnBase, background: "#2a6ad4", color: "#fff", borderColor: "#2a6ad4", opacity: isSaving ? 0.5 : 1 }}>
                Apply
              </button>

              {/* Save (and stay) */}
              <button type="button" onClick={() => handleSave(false)} disabled={isSaving}
                style={{ ...btnBase, background: "#fff", color: "#2a6ad4", borderColor: "#2a6ad4", opacity: isSaving ? 0.5 : 1 }}>
                {isSaving ? <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Saving…</> : "Save"}
              </button>

              {/* Cancel */}
              <button type="button" onClick={() => setLocation("/manage-accounts")} disabled={isSaving}
                style={{ ...btnBase, background: "transparent", color: "#aaa", borderColor: "#666", opacity: isSaving ? 0.5 : 1 }}>
                Cancel
              </button>

            </div>
          </>
        )}
      </div>
    </div>
  );
}
