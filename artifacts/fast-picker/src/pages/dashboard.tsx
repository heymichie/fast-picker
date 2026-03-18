import { useState, useEffect } from "react";
import { useGetAdminSetup } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Loader2, UserPlus, Users, BarChart2, LayoutGrid, ShieldCheck, LogOut, UserCircle, ClipboardList } from "lucide-react";
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
      isAdmin: boolean;
    };
  } catch {
    return null;
  }
}

const ALL_MENU_ITEMS = [
  {
    label: "Create New Account",
    icon: UserPlus,
    description: "Add new pickers, supervisors or admin users to the system",
    path: "/create-account",
    requiredPerms: ["Create New Accounts", "Create Order picker accounts"],
  },
  {
    label: "Manage Accounts",
    icon: Users,
    description: "View, edit and deactivate existing user accounts",
    path: "/manage-accounts",
    requiredPerms: ["Manage Accounts", "Manage Order Picker Accounts"],
  },
  {
    label: "Reports",
    icon: BarChart2,
    description: "View picking performance, order history and analytics",
    path: "/reports",
    requiredPerms: ["View Orders", "View Order Picker Performance", "Spool Reports"],
  },
  {
    label: "Setup Store Layout",
    icon: LayoutGrid,
    description: "Configure aisles, sections and product locations in store",
    path: "/store-layout",
    requiredPerms: ["Setup branch layout", "View branch layout"],
  },
  {
    label: "Pick Orders",
    icon: ClipboardList,
    description: "View and action assigned picking orders for your branch",
    path: "/pick-orders",
    requiredPerms: ["Pick Orders"],
  },
  {
    label: "User Rights",
    icon: ShieldCheck,
    description: "Manage role permissions and access controls for all users",
    path: "/user-rights",
    requiredPerms: ["Assign Account Rights"],
  },
];

const DEFAULT_ROLE_PERMS: Record<string, string[]> = {
  "Order Picker": [
    "View branch layout",
    "View Orders",
    "Pick Orders",
    "Spool Reports",
  ],
  "Merchandiser": [
    "View branch layout",
    "View Orders",
    "Spool Reports",
  ],
  "Store Supervisor": [
    "Create Order picker accounts",
    "Manage Order Picker Accounts",
    "View Orders",
    "View Order Picker Performance",
    "Spool Reports",
    "View branch layout",
  ],
  "Store Manager": [
    "Create New Accounts",
    "Create Order picker accounts",
    "Manage Accounts",
    "Manage Order Picker Accounts",
    "View Orders",
    "View Order Picker Performance",
    "Spool Reports",
    "Setup branch layout",
    "View branch layout",
    "Assign Account Rights",
  ],
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: setupStatus, isLoading } = useGetAdminSetup();
  const user = getStoredUser();

  const [userRights, setUserRights] = useState<Record<string, string[]> | null>(null);

  useEffect(() => {
    fetch("/api/user-rights")
      .then((r) => r.json())
      .then((data) => setUserRights(data.permissions ?? {}))
      .catch(() => setUserRights({}));
  }, []);

  if (!isLoading && setupStatus && !setupStatus.isSetup) {
    setLocation("/setup");
    return null;
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f4" }}>
        <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite", color: "#555" }} />
      </div>
    );
  }

  // Determine which menu items to show
  const visibleItems = ALL_MENU_ITEMS.filter((item) => {
    if (!user) return true; // not logged in, show all
    if (user.isAdmin) return true; // system admins always see everything
    if (!userRights) return true; // rights not loaded yet, show all
    // Use DB-configured rights if set, otherwise fall back to built-in defaults
    const dbPerms: string[] | undefined = userRights[user.designation];
    const rolePerms: string[] = (dbPerms && dbPerms.length > 0)
      ? dbPerms
      : (DEFAULT_ROLE_PERMS[user.designation] ?? []);
    return item.requiredPerms.some((p) => rolePerms.includes(p));
  });

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "#f2f2f0" }}>

      {/* Top header */}
      <header
        style={{
          background: "#111",
          padding: "0 2.5rem",
          height: 72,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}images/fast-picker-logo.png`}
          alt="Fast Picker"
          style={{ height: 48, objectFit: "contain" }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {user && (
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
              <div
                style={{
                  width: 36, height: 36, borderRadius: "50%", background: "#333",
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <UserCircle style={{ width: 22, height: 22, color: "#bbb" }} />
              </div>
              <div style={{ lineHeight: 1.25 }}>
                <div style={{ color: "#fff", fontSize: "0.88rem", fontWeight: 600 }}>
                  {user.forenames} {user.surname}
                </div>
                <div style={{ color: "#888", fontSize: "0.72rem" }}>{user.designation}</div>
              </div>
            </div>
          )}

          {setupStatus?.organisationName && (
            <span style={{ color: "#555", fontSize: "0.8rem", borderLeft: "1px solid #333", paddingLeft: "1.25rem" }}>
              {setupStatus.organisationName}
            </span>
          )}

          <LiveClock color="#aaa" size="sm" />

          <button
            onClick={() => { localStorage.removeItem("fp_user"); setLocation("/login"); }}
            style={{
              background: "none", border: "1px solid #444", borderRadius: 8, color: "#ccc",
              padding: "0.4rem 1rem", fontSize: "0.85rem", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <LogOut style={{ width: 14, height: 14 }} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main content */}
      <main style={{ flex: 1, padding: "2.5rem 3rem" }}>
        <div style={{ marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 700, color: "#111", margin: 0 }}>
            {user?.isAdmin ? "Administrator" : (user?.designation ?? "User")} Dashboard
          </h1>
          <p style={{ color: "#777", marginTop: "0.4rem", fontSize: "0.9rem" }}>
            Select an option below to manage your Fast Picker system.
          </p>
        </div>

        {visibleItems.length === 0 ? (
          <div style={{ padding: "3rem 0", color: "#999", fontSize: "0.95rem" }}>
            No menu options are currently assigned to your role. Please contact your administrator.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {visibleItems.map(({ label, icon: Icon, description, path }) => (
              <button
                key={label}
                onClick={() => setLocation(path)}
                style={{
                  background: "#fff", border: "1.5px solid #e0e0e0", borderRadius: 16,
                  padding: "2rem 1.75rem", textAlign: "left", cursor: "pointer",
                  transition: "box-shadow 0.15s, transform 0.15s",
                  display: "flex", flexDirection: "column", gap: "0.85rem",
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                  (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    width: 48, height: 48, background: "#111", borderRadius: 12,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Icon style={{ width: 24, height: 24, color: "#fff" }} />
                </div>
                <div>
                  <h2 style={{ fontSize: "1.05rem", fontWeight: 700, color: "#111", margin: "0 0 0.3rem 0" }}>
                    {label}
                  </h2>
                  <p style={{ fontSize: "0.82rem", color: "#777", margin: 0, lineHeight: 1.5 }}>
                    {description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
