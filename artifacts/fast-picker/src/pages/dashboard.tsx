import { useGetAdminSetup } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { LogOut, Package, Users, Settings, Activity, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: setupStatus, isLoading } = useGetAdminSetup();

  // Protect route
  if (!isLoading && setupStatus && !setupStatus.isSetup) {
    setLocation("/setup");
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-primary text-primary-foreground flex flex-col">
        <div className="p-6 border-b border-white/10 flex items-center gap-3">
          <Package className="h-6 w-6" />
          <span className="font-display font-bold text-lg tracking-wider">FAST PICKER</span>
        </div>
        <div className="px-6 py-4 border-b border-white/10">
          <p className="text-xs text-primary-foreground/60 uppercase tracking-widest font-semibold mb-1">Organization</p>
          <p className="text-sm font-medium truncate">{setupStatus?.organisationName || "Loading..."}</p>
        </div>
        <nav className="flex-1 py-6 flex flex-col gap-2 px-4">
          <Button variant="ghost" className="justify-start gap-3 w-full bg-white/10 text-white hover:bg-white/20 hover:text-white">
            <Activity className="h-4 w-4" /> Dashboard
          </Button>
          <Button variant="ghost" className="justify-start gap-3 w-full text-primary-foreground/70 hover:bg-white/5 hover:text-white">
            <Package className="h-4 w-4" /> Orders
          </Button>
          <Button variant="ghost" className="justify-start gap-3 w-full text-primary-foreground/70 hover:bg-white/5 hover:text-white">
            <Users className="h-4 w-4" /> Team
          </Button>
          <Button variant="ghost" className="justify-start gap-3 w-full text-primary-foreground/70 hover:bg-white/5 hover:text-white">
            <Settings className="h-4 w-4" /> Settings
          </Button>
        </nav>
        <div className="p-4 border-t border-white/10">
          <Button variant="ghost" className="justify-start gap-3 w-full text-primary-foreground/70 hover:bg-white/5 hover:text-white">
            <LogOut className="h-4 w-4" /> Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <header className="mb-8">
          <h1 className="text-3xl text-foreground font-display">Welcome back</h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's what's happening with your store today.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[
            { label: "Pending Orders", value: "24" },
            { label: "Picked Today", value: "156" },
            { label: "Active Pickers", value: "8" },
          ].map((stat, i) => (
            <div key={i} className="bg-card rounded-xl p-6 shadow-sm border border-border/50">
              <h3 className="text-sm font-medium text-muted-foreground">{stat.label}</h3>
              <p className="text-4xl font-display mt-2">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-xl shadow-sm border border-border/50 overflow-hidden">
          <div className="p-6 border-b border-border/50">
            <h2 className="text-lg font-semibold">Recent Activity</h2>
          </div>
          <div className="p-6 text-center text-muted-foreground py-12">
            <Activity className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Your dashboard is ready. Start adding orders to see activity.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
