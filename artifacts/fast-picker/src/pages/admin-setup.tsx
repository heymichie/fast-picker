import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { 
  useCreateAdminSetup, 
  useGetAdminSetup,
  type CreateAdminSetupRequest
} from "@workspace/api-client-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Form validation schema
const setupSchema = z.object({
  organisationTradingName: z.string().min(1, "Trading name is required"),
  administratorForenames: z.string().min(1, "Forename is required"),
  surname: z.string().min(1, "Surname is required"),
  designation: z.string().min(1, "Designation is required"),
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  retypePassword: z.string().min(6, "Please retype your password"),
  productCode: z.string().min(1, "Product code is required"),
}).refine((data) => data.password === data.retypePassword, {
  message: "Passwords do not match",
  path: ["retypePassword"],
});

type SetupFormValues = z.infer<typeof setupSchema>;

export default function AdminSetup() {
  const [, setLocation] = useLocation();
  const [setupComplete, setSetupComplete] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Check if already setup
  const { data: setupStatus, isLoading: isCheckingSetup } = useGetAdminSetup();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SetupFormValues>({
    resolver: zodResolver(setupSchema),
    mode: "onBlur"
  });

  const createSetup = useCreateAdminSetup();

  // Redirect if already setup
  useEffect(() => {
    if (setupStatus?.isSetup && !setupComplete) {
      setLocation("/dashboard");
    }
  }, [setupStatus, setLocation, setupComplete]);

  const onSubmit = async (data: SetupFormValues) => {
    setApiError(null);
    try {
      // The hook expects the variables in a `data` property
      await createSetup.mutateAsync({ data });
      setSetupComplete(true);
      // Brief pause to show success state before redirect
      setTimeout(() => {
        setLocation("/dashboard");
      }, 2000);
    } catch (err: any) {
      // Handle the error type properly
      const errorMsg = err?.response?.data?.error || err.message || "An unexpected error occurred during setup.";
      setApiError(errorMsg);
    }
  };

  if (isCheckingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If already setup, render nothing while useEffect redirects
  if (setupStatus?.isSetup && !setupComplete) return null;

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-white overflow-hidden">
      
      {/* Left Panel - Branding (Dark) */}
      <div className="w-full lg:w-5/12 bg-[#050505] text-white flex flex-col relative overflow-hidden min-h-[30vh] lg:min-h-screen">
        {/* Abstract Background Texture */}
        <div 
          className="absolute inset-0 opacity-40 mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage: `url('${import.meta.env.BASE_URL}images/dark-apparel-bg.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-black/80 via-transparent to-black/90 pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full p-10 md:p-16 lg:p-20 justify-between">
          
          {/* Top Brand Area */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col"
          >
            {/* Minimal Clothes Hanger SVG */}
            <svg 
              width="48" height="48" viewBox="0 0 24 24" 
              fill="none" stroke="currentColor" strokeWidth="1.5" 
              strokeLinecap="round" strokeLinejoin="round" 
              className="mb-6 opacity-90"
            >
              <path d="M12 2v4M8.5 7.5A3.5 3.5 0 1 1 12 4v4m0 0L3 18h18L12 8Z" />
            </svg>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tighter mb-2">
              FAST PICKER
            </h1>
            <p className="font-sans text-sm md:text-base tracking-[0.2em] text-white/60 uppercase font-medium">
              Mishka Technologies
            </p>
          </motion.div>

          {/* Bottom Greeting */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
            className="mt-16 lg:mt-0"
          >
            <h2 className="font-serif italic text-4xl md:text-5xl lg:text-6xl text-white/90 font-light tracking-wide">
              Hello,<br />Welcome!
            </h2>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Setup Form (Light) */}
      <div className="w-full lg:w-7/12 flex flex-col items-center justify-center p-6 sm:p-10 md:p-16 bg-white relative">
        
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-2xl"
        >
          {setupComplete ? (
            <div className="flex flex-col items-center text-center space-y-6 py-12">
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }} 
                transition={{ type: "spring", stiffness: 200, damping: 20 }}
              >
                <CheckCircle2 className="h-24 w-24 text-green-500 mx-auto" />
              </motion.div>
              <div>
                <h2 className="text-3xl font-display font-bold text-foreground mb-3">Setup Complete</h2>
                <p className="text-muted-foreground text-lg">Your administrator account has been created. Redirecting to dashboard...</p>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-10">
                <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight">
                  Administrator Setup
                </h2>
                <p className="text-muted-foreground mt-2">
                  Configure the primary account for your organisation.
                </p>
              </div>

              {apiError && (
                <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg flex items-start gap-3 text-destructive">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{apiError}</p>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-1">
                
                {/* Custom Table-like Form Rows */}
                <div className="border-t border-border/60">
                  <FormRow 
                    label="Organisation Trading Name" 
                    error={errors.organisationTradingName?.message}
                  >
                    <input 
                      {...register("organisationTradingName")}
                      className={cn(
                        "form-table-input", 
                        errors.organisationTradingName && "ring-1 ring-destructive/50 bg-destructive/5"
                      )}
                      placeholder="Enter trading name"
                    />
                  </FormRow>

                  <FormRow label="Organisational ID">
                    <input 
                      disabled
                      className="form-table-input italic text-muted-foreground"
                      placeholder="Auto generated"
                    />
                  </FormRow>

                  <FormRow 
                    label="Administrator's Forename(s)"
                    error={errors.administratorForenames?.message}
                  >
                    <input 
                      {...register("administratorForenames")}
                      className={cn(
                        "form-table-input", 
                        errors.administratorForenames && "ring-1 ring-destructive/50 bg-destructive/5"
                      )}
                      placeholder="First name(s)"
                    />
                  </FormRow>

                  <FormRow 
                    label="Surname"
                    error={errors.surname?.message}
                  >
                    <input 
                      {...register("surname")}
                      className={cn(
                        "form-table-input", 
                        errors.surname && "ring-1 ring-destructive/50 bg-destructive/5"
                      )}
                      placeholder="Last name"
                    />
                  </FormRow>

                  <FormRow 
                    label="Designation"
                    error={errors.designation?.message}
                  >
                    <input 
                      {...register("designation")}
                      className={cn(
                        "form-table-input", 
                        errors.designation && "ring-1 ring-destructive/50 bg-destructive/5"
                      )}
                      placeholder="e.g. Store Manager"
                    />
                  </FormRow>

                  <FormRow 
                    label="Username"
                    error={errors.username?.message}
                  >
                    <input 
                      {...register("username")}
                      className={cn(
                        "form-table-input", 
                        errors.username && "ring-1 ring-destructive/50 bg-destructive/5"
                      )}
                      placeholder="Choose a username"
                    />
                  </FormRow>

                  <FormRow 
                    label="Password"
                    error={errors.password?.message}
                  >
                    <input 
                      type="password"
                      {...register("password")}
                      className={cn(
                        "form-table-input", 
                        errors.password && "ring-1 ring-destructive/50 bg-destructive/5"
                      )}
                      placeholder="••••••••"
                    />
                  </FormRow>

                  <FormRow 
                    label="Retype Password"
                    error={errors.retypePassword?.message}
                  >
                    <input 
                      type="password"
                      {...register("retypePassword")}
                      className={cn(
                        "form-table-input", 
                        errors.retypePassword && "ring-1 ring-destructive/50 bg-destructive/5"
                      )}
                      placeholder="••••••••"
                    />
                  </FormRow>

                  <FormRow 
                    label="Product Code"
                    error={errors.productCode?.message}
                  >
                    <input 
                      {...register("productCode")}
                      className={cn(
                        "form-table-input", 
                        errors.productCode && "ring-1 ring-destructive/50 bg-destructive/5"
                      )}
                      placeholder="Enter license/product code"
                    />
                  </FormRow>
                </div>

                <div className="pt-10 flex justify-center">
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full sm:w-64 h-14 text-base font-semibold tracking-wide shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300"
                  >
                    {isSubmitting ? (
                      <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Activating...</>
                    ) : (
                      "Activate"
                    )}
                  </Button>
                </div>
              </form>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

// Helper component for the table-style rows
function FormRow({ 
  label, 
  error, 
  children 
}: { 
  label: string; 
  error?: string; 
  children: React.ReactNode 
}) {
  return (
    <div className="form-table-row relative group">
      <div className="form-table-label flex flex-col md:justify-center h-full">
        <label className="leading-tight">{label}</label>
        {error && (
          <span className="text-xs text-destructive mt-1 md:absolute md:-bottom-2 md:left-[240px] md:translate-y-full block">
            {error}
          </span>
        )}
      </div>
      <div className="mt-1 md:mt-0 relative">
        {children}
      </div>
    </div>
  );
}
