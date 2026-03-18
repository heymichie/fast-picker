import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";

function generateUserId() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let id = "USR-";
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem("fp_user");
    if (!raw) return null;
    return JSON.parse(raw) as { username: string; forenames: string; surname: string; designation: string };
  } catch {
    return null;
  }
}

const ALL_RIGHTS = ["Store Manager", "Store Supervisor", "Merchandiser", "Administrator", "Order Picker"] as const;
const STORE_MANAGER_RIGHTS = ["Store Supervisor", "Merchandiser", "Order Picker"] as const;
const BRANCH_CODES = ["501", "511", "502"] as const;

export default function CreateAccount() {
  const [, setLocation] = useLocation();
  const [userId] = useState(generateUserId);
  const [username, setUsername] = useState("");
  const [forenames, setForenames] = useState("");
  const [surname, setSurname] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [email, setEmail] = useState("");
  const [rights, setRights] = useState<string>("");
  const [branchCode, setBranchCode] = useState<string>("");
  const [otherBranch, setOtherBranch] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const currentUser = getStoredUser();
  const createdByName = currentUser ? `${currentUser.forenames} ${currentUser.surname}` : "System";

  const isStoreManager = currentUser?.designation === "Store Manager";
  const RIGHTS = isStoreManager ? STORE_MANAGER_RIGHTS : ALL_RIGHTS;
  const isAdminRole = rights === "Administrator";
  const effectiveBranch = isAdminRole ? "ALL" : (branchCode === "Other" ? otherBranch : branchCode);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setSuccessMsg(null);

    if (!username.trim() || !forenames.trim() || !surname.trim() || !rights || !effectiveBranch) {
      setApiError("Please fill in all required fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          forenames: forenames.trim(),
          surname: surname.trim(),
          employeeNumber: employeeNumber.trim() || null,
          email: email.trim() || null,
          rights,
          branchCode: effectiveBranch,
          createdBy: createdByName,
        }),
      });
      if (!res.ok) {
        const body = await res.json();
        setApiError(body.error || "Failed to create account");
        return;
      }
      const body = await res.json();
      setSuccessMsg(`Account created! Default password: ${body.defaultPassword ?? "Welcome1"} — give this to the user.`);
      setTimeout(() => setLocation("/dashboard"), 4000);
    } catch {
      setApiError("Unable to connect. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const cellStyle = (light: boolean): React.CSSProperties => ({
    padding: "10px 14px",
    borderBottom: "1px solid #999",
    background: light ? "#e8e8e8" : "#d8d8d8",
    verticalAlign: "top",
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

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      {/* Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          padding: "0.75rem 1.5rem",
          gap: "1rem",
          borderBottom: "none",
        }}
      >
        {/* Logo */}
        <img
          src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
          alt="Fast Picker"
          style={{ height: 56, objectFit: "contain", flexShrink: 0 }}
        />

        {/* Title */}
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
          Account: ({username || "username"})
        </h1>

        {/* Right: logout + clock */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button
            type="button"
            onClick={() => { localStorage.removeItem("fp_user"); setLocation("/login"); }}
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
      <div style={{ padding: "0.25rem 1.5rem 0.75rem", fontSize: "0.82rem", color: "#bbb" }}>
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 0, fontSize: "0.82rem" }}
        >
          Home
        </button>
        {" / Create New Account"}
      </div>

      {/* Form area */}
      <form onSubmit={handleSubmit} style={{ flex: 1, padding: "0 1.5rem 2rem" }}>
        <table
          style={{
            width: "100%",
            maxWidth: 820,
            borderCollapse: "collapse",
            border: "1.5px solid #888",
            fontSize: "0.95rem",
            color: "#111",
          }}
        >
          <colgroup>
            <col style={{ width: "36%" }} />
            <col style={{ width: "64%" }} />
          </colgroup>
          <tbody>
            {/* User ID */}
            <tr>
              <td style={cellStyle(true)}>User ID</td>
              <td style={cellStyle(true)}>
                <span style={{ fontWeight: 700, textDecoration: "underline", color: "#111" }}>
                  {userId}
                </span>
              </td>
            </tr>

            {/* Username */}
            <tr>
              <td style={cellStyle(false)}>Username</td>
              <td style={cellStyle(false)}>
                <input
                  style={inputStyle}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder=""
                />
              </td>
            </tr>

            {/* Fore Name(s) */}
            <tr>
              <td style={cellStyle(true)}>Fore Name(s)</td>
              <td style={cellStyle(true)}>
                <input
                  style={inputStyle}
                  type="text"
                  value={forenames}
                  onChange={(e) => setForenames(e.target.value)}
                  placeholder=""
                />
              </td>
            </tr>

            {/* Surname */}
            <tr>
              <td style={cellStyle(false)}>Surname</td>
              <td style={cellStyle(false)}>
                <input
                  style={inputStyle}
                  type="text"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  placeholder=""
                />
              </td>
            </tr>

            {/* Employee Number */}
            <tr>
              <td style={cellStyle(true)}>Employee Number</td>
              <td style={cellStyle(true)}>
                <input
                  style={inputStyle}
                  type="text"
                  value={employeeNumber}
                  onChange={(e) => setEmployeeNumber(e.target.value)}
                  placeholder=""
                />
              </td>
            </tr>

            {/* Staff email address */}
            <tr>
              <td style={cellStyle(false)}>Staff email address</td>
              <td style={cellStyle(false)}>
                <input
                  style={inputStyle}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder=""
                />
              </td>
            </tr>

            {/* Rights */}
            <tr>
              <td style={cellStyle(true)}>Rights</td>
              <td style={cellStyle(true)}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {RIGHTS.map((r) => (
                    <label key={r} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "#111" }}>
                      <input
                        type="radio"
                        name="rights"
                        value={r}
                        checked={rights === r}
                        onChange={() => {
                          setRights(r);
                          if (r === "Administrator") setBranchCode("ALL");
                          else if (branchCode === "ALL") setBranchCode("");
                        }}
                        style={{ accentColor: "#333", width: 15, height: 15 }}
                      />
                      {r}
                    </label>
                  ))}
                </div>
              </td>
            </tr>

            {/* Store Branch Code */}
            <tr style={{ opacity: isAdminRole ? 0.38 : 1, transition: "opacity 0.2s" }}>
              <td style={cellStyle(false)}>
                Store Branch Code
                {isAdminRole && (
                  <div style={{ fontSize: "0.72rem", color: "#555", marginTop: 3, fontStyle: "italic" }}>
                    N/A — Administrators access all branches
                  </div>
                )}
              </td>
              <td style={cellStyle(false)}>
                {isAdminRole ? (
                  <span style={{ fontWeight: 600, color: "#444", fontSize: "0.95rem" }}>ALL</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {BRANCH_CODES.map((code) => (
                      <label key={code} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "#111" }}>
                        <input
                          type="radio"
                          name="branchCode"
                          value={code}
                          checked={branchCode === code}
                          onChange={() => setBranchCode(code)}
                          style={{ accentColor: "#333", width: 15, height: 15 }}
                        />
                        {code}
                      </label>
                    ))}
                    <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", color: "#111" }}>
                      <input
                        type="radio"
                        name="branchCode"
                        value="Other"
                        checked={branchCode === "Other"}
                        onChange={() => setBranchCode("Other")}
                        style={{ accentColor: "#333", width: 15, height: 15 }}
                      />
                      Other
                      {branchCode === "Other" && (
                        <input
                          type="text"
                          value={otherBranch}
                          onChange={(e) => setOtherBranch(e.target.value)}
                          placeholder="Enter code..."
                          style={{
                            ...inputStyle,
                            width: 140,
                            borderBottom: "1.5px solid #555",
                            marginLeft: 4,
                          }}
                        />
                      )}
                    </label>
                  </div>
                )}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Feedback messages */}
        {apiError && (
          <p style={{ color: "#f66", fontSize: "0.85rem", marginTop: 12 }}>{apiError}</p>
        )}
        {successMsg && (
          <p style={{ color: "#6f6", fontSize: "0.85rem", marginTop: 12 }}>{successMsg}</p>
        )}

        {/* Active / Submit button */}
        <div style={{ display: "flex", justifyContent: "center", marginTop: 28 }}>
          <button
            type="submit"
            disabled={isSubmitting}
            style={{
              background: "#fff",
              color: "#4a7adf",
              border: "1.5px solid #ccc",
              borderRadius: 8,
              padding: "0.65rem 4rem",
              fontSize: "1rem",
              fontWeight: 500,
              cursor: isSubmitting ? "not-allowed" : "pointer",
              opacity: isSubmitting ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              letterSpacing: "0.01em",
              minWidth: 220,
              justifyContent: "center",
            }}
          >
            {isSubmitting ? (
              <><Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> Saving...</>
            ) : (
              "Active"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
