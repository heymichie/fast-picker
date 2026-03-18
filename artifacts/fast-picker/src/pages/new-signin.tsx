import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Loader2 } from "lucide-react";
import { LiveClock } from "@/components/LiveClock";

export default function NewSignIn() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const prefillUsername = params.get("username") || "";

  const [username, setUsername] = useState(prefillUsername);
  const [newPassword, setNewPassword] = useState("");
  const [retypePassword, setRetypePassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim()) { setError("Username is required."); return; }
    if (newPassword.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPassword !== retypePassword) { setError("Passwords do not match."); return; }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/accounts/set-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), newPassword }),
      });
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to set password.");
        return;
      }
      setLocation("/user-setup-success");
    } catch {
      setError("Unable to connect. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.85rem 1rem",
    borderRadius: 10,
    border: "1.5px solid #ccc",
    background: "#fff",
    fontSize: "1rem",
    color: "#111",
    outline: "none",
    boxSizing: "border-box",
    textAlign: "center",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
        background: "#2a1a0a",
      }}
    >
      {/* Background store image */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url('${import.meta.env.BASE_URL}images/clothing-store.jpg')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "brightness(0.75) saturate(0.9)",
        }}
      />

      {/* Clock overlay — top right */}
      <div style={{ position: "absolute", top: 20, right: 24, zIndex: 10 }}>
        <LiveClock color="#fff" size="sm" />
      </div>

      {/* Cards container */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "stretch",
        }}
      >
        {/* Left black card */}
        <div
          style={{
            background: "#000",
            borderRadius: 24,
            padding: "2.5rem 2.5rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            width: 280,
            minHeight: 380,
            position: "relative",
            zIndex: 2,
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
            alt="Fast Picker - Mishka Technologies"
            style={{ width: "85%", objectFit: "contain" }}
          />
          <p
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "2.4rem",
              color: "#fff",
              fontWeight: 400,
              lineHeight: 1.2,
              margin: 0,
              textAlign: "center",
            }}
          >
            Hello,<br />Welcome!
          </p>
        </div>

        {/* Right white card */}
        <div
          style={{
            background: "rgba(255,255,255,0.92)",
            backdropFilter: "blur(12px)",
            borderRadius: 24,
            padding: "2.25rem 2.25rem 1.75rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 310,
            marginLeft: -24,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Title */}
          <h2
            style={{
              fontSize: "1.9rem",
              fontWeight: 700,
              color: "#111",
              margin: "0 0 1.25rem 0",
              textAlign: "center",
            }}
          >
            New Sign in
          </h2>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {/* Username */}
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={inputStyle}
            />

            {/* New Password */}
            <input
              type="password"
              placeholder="Type New Password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              style={inputStyle}
            />

            {/* Retype Password */}
            <input
              type="password"
              placeholder="Retype Password"
              value={retypePassword}
              onChange={(e) => setRetypePassword(e.target.value)}
              style={inputStyle}
            />

            {error && (
              <p style={{ color: "#c00", fontSize: "0.78rem", textAlign: "center", margin: 0 }}>{error}</p>
            )}

            {/* Login button */}
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "0.85rem",
                fontSize: "1rem",
                fontWeight: 500,
                cursor: isSubmitting ? "not-allowed" : "pointer",
                opacity: isSubmitting ? 0.7 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 4,
              }}
            >
              {isSubmitting ? (
                <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Saving...</>
              ) : "Login"}
            </button>

            {/* Administrator Login link */}
            <div style={{ textAlign: "center", marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setLocation("/login")}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: "#333",
                  padding: 0,
                }}
              >
                Administrator Login
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
