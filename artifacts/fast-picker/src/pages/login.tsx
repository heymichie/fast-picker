import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const [apiError, setApiError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setApiError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json();
        setApiError(body.error || "Invalid username or password");
        return;
      }
      const body = await res.json();
      localStorage.setItem("fp_user", JSON.stringify({
        username: body.username,
        forenames: body.forenames,
        surname: body.surname,
        designation: body.designation,
      }));
      setLocation("/dashboard");
    } catch {
      setApiError("Unable to connect. Please try again.");
    }
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
        background: "#e8e8e0",
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
          filter: "brightness(0.9)",
        }}
      />

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
            minHeight: 360,
            position: "relative",
            zIndex: 2,
          }}
        >
          {/* Logo */}
          <img
            src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
            alt="Fast Picker - Mishka Technologies"
            style={{
              width: "85%",
              objectFit: "contain",
            }}
          />

          {/* Hello Welcome */}
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

        {/* Right white card — overlaps slightly with left card */}
        <div
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(12px)",
            borderRadius: 24,
            padding: "2.5rem 2.25rem",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            width: 300,
            marginLeft: -24,
            position: "relative",
            zIndex: 1,
          }}
        >
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>

            {/* Username */}
            <div>
              <input
                {...register("username")}
                type="text"
                placeholder="Username"
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: 10,
                  border: errors.username ? "1.5px solid #e00" : "1.5px solid #ccc",
                  background: "#fff",
                  fontSize: "1rem",
                  color: "#111",
                  outline: "none",
                  boxSizing: "border-box",
                  textAlign: "center",
                }}
              />
              {errors.username && (
                <p style={{ color: "#c00", fontSize: "0.72rem", marginTop: 3 }}>{errors.username.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <input
                {...register("password")}
                type="password"
                placeholder="Password"
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: 10,
                  border: errors.password ? "1.5px solid #e00" : "1.5px solid #ccc",
                  background: "#fff",
                  fontSize: "1rem",
                  color: "#111",
                  outline: "none",
                  boxSizing: "border-box",
                  textAlign: "center",
                }}
              />
              {errors.password && (
                <p style={{ color: "#c00", fontSize: "0.72rem", marginTop: 3 }}>{errors.password.message}</p>
              )}
            </div>

            {/* Forgot Password */}
            <div style={{ textAlign: "right" }}>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  color: "#555",
                  padding: 0,
                  marginTop: -4,
                }}
              >
                Forgot Password
              </button>
            </div>

            {apiError && (
              <p style={{ color: "#c00", fontSize: "0.78rem", textAlign: "center", margin: 0 }}>{apiError}</p>
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
                <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Logging in...</>
              ) : (
                "Login"
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
