import { useLocation } from "wouter";
import { ClipboardList } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("fp_user");
    if (!raw) return null;
    return JSON.parse(raw) as { username: string; forenames: string; surname: string; designation: string };
  } catch {
    return null;
  }
}

export default function PickOrders() {
  const [, setLocation] = useLocation();
  const user = getStoredUser();

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column", color: "#fff" }}>

      <header style={{ display: "flex", alignItems: "center", padding: "0.75rem 1.5rem", gap: "1rem" }}>
        <img
          src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
          alt="Fast Picker"
          style={{ height: 56, objectFit: "contain", flexShrink: 0 }}
        />
        <h1 style={{ fontSize: "2.2rem", fontWeight: 700, color: "#fff", margin: 0, flex: 1, lineHeight: 1 }}>
          Account: {user ? `${user.forenames} ${user.surname}` : "(username)"}
        </h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <button
            type="button"
            onClick={() => { localStorage.removeItem("fp_user"); setLocation("/login"); }}
            style={{
              background: "none", border: "none", color: "#fff",
              fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
              letterSpacing: "0.08em", padding: 0, textTransform: "uppercase",
            }}
          >
            LOGOUT
          </button>
          <LiveClock color="#ccc" size="sm" />
        </div>
      </header>

      <div style={{ padding: "0.25rem 1.5rem 0.75rem", fontSize: "0.82rem", color: "#bbb" }}>
        <button
          type="button"
          onClick={() => setLocation("/dashboard")}
          style={{ background: "none", border: "none", color: "#bbb", cursor: "pointer", padding: 0, fontSize: "0.82rem" }}
        >
          Home
        </button>
        {" / Pick Orders"}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1.5rem", padding: "3rem" }}>
        <div style={{
          width: 72, height: 72, background: "#222", borderRadius: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <ClipboardList style={{ width: 36, height: 36, color: "#fff" }} />
        </div>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#fff", margin: 0 }}>Pick Orders</h2>
        <p style={{ color: "#888", fontSize: "0.95rem", margin: 0, textAlign: "center", maxWidth: 400 }}>
          This section will display assigned picking orders for your branch. Coming soon.
        </p>
      </div>
    </div>
  );
}
