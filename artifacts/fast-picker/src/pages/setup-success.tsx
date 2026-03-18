import { useLocation } from "wouter";

export default function SetupSuccess() {
  const [, setLocation] = useLocation();

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
        background: "#1a1a1a",
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
          filter: "brightness(0.55)",
        }}
      />

      {/* Dark overlay for depth */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.35)",
        }}
      />

      {/* Centred black card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "#000",
          borderRadius: 24,
          padding: "3rem 4rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          maxWidth: 560,
          width: "90%",
        }}
      >
        {/* Logo */}
        <img
          src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
          alt="Fast Picker - Mishka Technologies"
          style={{
            width: 200,
            objectFit: "contain",
            marginBottom: "1.5rem",
          }}
        />

        {/* SUCCESS! */}
        <h1
          style={{
            color: "#fff",
            fontSize: "clamp(3rem, 8vw, 5.5rem)",
            fontWeight: 900,
            letterSpacing: "0.05em",
            margin: "0 0 1.25rem 0",
            lineHeight: 1,
            textAlign: "center",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
        >
          SUCCESS!
        </h1>

        {/* Proceed link */}
        <button
          onClick={() => setLocation("/login")}
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: "1.15rem",
            fontStyle: "italic",
            fontWeight: 700,
            cursor: "pointer",
            textDecoration: "none",
            letterSpacing: "0.02em",
            padding: "0.25rem 0",
            fontFamily: "Georgia, serif",
          }}
        >
          Proceed to Login Page
        </button>
      </div>
    </div>
  );
}
