import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import AdminSetup from "@/pages/admin-setup";
import SetupSuccess from "@/pages/setup-success";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CreateAccount from "@/pages/create-account";
import NewSignIn from "@/pages/new-signin";
import UserSetupSuccess from "@/pages/user-setup-success";
import UserRights from "@/pages/user-rights";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={AdminSetup} />
      <Route path="/setup" component={AdminSetup} />
      <Route path="/setup-success" component={SetupSuccess} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/create-account" component={CreateAccount} />
      <Route path="/new-signin" component={NewSignIn} />
      <Route path="/user-setup-success" component={UserSetupSuccess} />
      <Route path="/user-rights" component={UserRights} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
