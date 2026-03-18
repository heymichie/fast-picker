import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  useCreateAdminSetup,
  useGetAdminSetup,
} from "@workspace/api-client-react";

const setupSchema = z.object({
  organisationTradingName: z.string().min(1, "Required"),
  administratorForenames: z.string().min(1, "Required"),
  surname: z.string().min(1, "Required"),
  designation: z.string().min(1, "Required"),
  username: z.string().min(3, "Min 3 characters"),
  password: z.string().min(6, "Min 6 characters"),
  retypePassword: z.string().min(6, "Required"),
  productCode: z.string().min(1, "Required"),
}).refine((d) => d.password === d.retypePassword, {
  message: "Passwords do not match",
  path: ["retypePassword"],
});

type SetupFormValues = z.infer<typeof setupSchema>;

export default function AdminSetup() {
  const [, setLocation] = useLocation();
  const [setupComplete, setSetupComplete] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const { data: setupStatus, isLoading: isCheckingSetup } = useGetAdminSetup();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    mode: "onBlur",
  });

  const createSetup = useCreateAdminSetup();

  useEffect(() => {
    if (setupStatus?.isSetup && !setupComplete) {
      setLocation("/dashboard");
    }
  }, [setupStatus, setLocation, setupComplete]);

  const onSubmit = async (data: SetupFormValues) => {
    setApiError(null);
    try {
      await createSetup.mutateAsync({ data });
      setSetupComplete(true);
      setTimeout(() => setLocation("/setup-success"), 300);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err.message || "An unexpected error occurred.";
      setApiError(msg);
    }
  };

  if (isCheckingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "#111" }}>
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    );
  }

  if (setupStatus?.isSetup && !setupComplete) return null;

  return (
    <div
      className="min-h-screen w-full flex items-stretch relative"
    >
      {/* Left dark panel with clothing background */}
      <div
        className="flex flex-col items-center justify-between py-12 px-10 relative overflow-hidden"
        style={{
          width: "42%",
          minWidth: 280,
          background: "#0a0a0a",
        }}
      >
        {/* Clothing background image visible through dark overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url('${import.meta.env.BASE_URL}images/clothing-store.jpg')`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.4,
          }}
        />
        {/* Dark overlay to ensure readability */}
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.65)" }} />
        {/* Logo area - centered vertically in upper portion */}
        <div className="flex-1 flex flex-col items-center justify-center" style={{ position: "relative", zIndex: 1 }}>
          <img
            src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
            alt="Fast Picker - Mishka Technologies"
            style={{ width: "75%", maxWidth: 300, objectFit: "contain" }}
          />
        </div>

        {/* Hello Welcome */}
        <div className="w-full text-left" style={{ position: "relative", zIndex: 1 }}>
          <p
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontSize: "clamp(2rem, 5vw, 3.5rem)",
              color: "#fff",
              fontWeight: 400,
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Hello,<br />Welcome!
          </p>
        </div>
      </div>

      {/* Right white form panel */}
      <div
        className="flex flex-col items-center justify-center"
        style={{
          flex: 1,
          background: "#ffffff",
          padding: "2.5rem 2.5rem",
        }}
      >
        {setupComplete ? (
          <div className="flex flex-col items-center text-center space-y-6 py-12">
            <CheckCircle2 className="h-20 w-20 text-green-600" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Setup Complete</h2>
              <p className="text-gray-500">Redirecting to dashboard...</p>
            </div>
          </div>
        ) : (
          <div className="w-full" style={{ maxWidth: 560 }}>
            <h1
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: "clamp(1.6rem, 3vw, 2.2rem)",
                fontWeight: 400,
                color: "#111",
                marginBottom: "1.25rem",
                textAlign: "center",
              }}
            >
              Administrator Setup
            </h1>

            {apiError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded flex items-start gap-2 text-red-700 text-sm">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                {apiError}
              </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "2px solid #fff",
                  fontSize: "0.88rem",
                  background: "#000",
                }}
              >
                <tbody>
                  <TableRow label="Organisation Trading Name" error={errors.organisationTradingName?.message} isHeader>
                    <TableInput {...register("organisationTradingName")} type="text" />
                  </TableRow>

                  <TableRow label="Organisational ID">
                    <span style={{ color: "#888", fontStyle: "normal", padding: "0 0.6rem" }}>Auto generated</span>
                  </TableRow>

                  <TableRow label="Administrator's Forename(s)" error={errors.administratorForenames?.message}>
                    <TableInput {...register("administratorForenames")} type="text" />
                  </TableRow>

                  <TableRow label="Surname" error={errors.surname?.message}>
                    <TableInput {...register("surname")} type="text" />
                  </TableRow>

                  <TableRow label="Designation" error={errors.designation?.message}>
                    <TableInput {...register("designation")} type="text" />
                  </TableRow>

                  <TableRow label="Username" error={errors.username?.message}>
                    <TableInput {...register("username")} type="text" />
                  </TableRow>

                  <TableRow label="Password" error={errors.password?.message}>
                    <TableInput {...register("password")} type="password" />
                  </TableRow>

                  <TableRow label="Retype Password" error={errors.retypePassword?.message}>
                    <TableInput {...register("retypePassword")} type="password" />
                  </TableRow>

                  <TableRow label="Product Code" error={errors.productCode?.message}>
                    <TableInput {...register("productCode")} type="text" />
                  </TableRow>
                </tbody>
              </table>

              <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "center" }}>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    background: "#111",
                    color: "#fff",
                    border: "none",
                    borderRadius: 4,
                    padding: "0.85rem 0",
                    width: "70%",
                    fontSize: "1rem",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    opacity: isSubmitting ? 0.7 : 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                  }}
                >
                  {isSubmitting ? (
                    <><Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> Activating...</>
                  ) : (
                    "Activate"
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

function TableRow({
  label,
  error,
  isHeader,
  children,
}: {
  label: string;
  error?: string;
  isHeader?: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td
        style={{
          border: "1px solid #fff",
          padding: "0.6rem 0.75rem",
          width: "46%",
          fontWeight: isHeader ? 700 : 400,
          verticalAlign: "middle",
          background: "#000",
          color: "#fff",
          lineHeight: 1.4,
        }}
      >
        {label}
        {error && (
          <div style={{ color: "#f87171", fontSize: "0.7rem", marginTop: 2, fontWeight: 400 }}>
            {error}
          </div>
        )}
      </td>
      <td
        style={{
          border: "1px solid #fff",
          padding: 0,
          background: "#000",
          verticalAlign: "middle",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", minHeight: 38, padding: "0.2rem 0" }}>
          {children}
        </div>
      </td>
    </tr>
  );
}

function TableInput({ type = "text", ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      {...props}
      style={{
        background: "transparent",
        border: "none",
        outline: "none",
        color: "#fff",
        width: "100%",
        padding: "0.35rem 0.6rem",
        fontSize: "0.88rem",
      }}
    />
  );
}
