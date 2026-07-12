import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { ApiError } from "@workspace/api-client-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Shell } from "@/components/layout/Shell";
import NotFound from "@/pages/not-found";

// Placeholder imports for pages
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Shops from "@/pages/shops";
import Users from "@/pages/users";
import Leads from "@/pages/leads";
import SubPartners from "@/pages/sub-partners";
import Transactions from "@/pages/transactions";
import Withdraw from "@/pages/withdraw";
import Profile from "@/pages/profile";

// Stale/forged session tokens fail verification on the proxy and come back as
// 401. When that happens, clear the stored session and bounce to /login so the
// partner can re-authenticate instead of staring at a broken page.
function handleAuthError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    localStorage.removeItem("pointify_partner_token");
    localStorage.removeItem("pointify_partner_userdata");
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const loginPath = `${base}/login`;
    if (window.location.pathname !== loginPath) {
      window.location.assign(loginPath);
    }
  }
}

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handleAuthError }),
  mutationCache: new MutationCache({ onError: handleAuthError }),
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Redirect to="/login" />;
  }

  return (
    <Shell>
      <Component />
    </Shell>
  );
}

function GuestRoute({ component: Component }: { component: React.ComponentType<any> }) {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Redirect to="/" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login">
        <GuestRoute component={Login} />
      </Route>
      <Route path="/register">
        <GuestRoute component={Register} />
      </Route>
      
      <Route path="/">
        <ProtectedRoute component={Dashboard} />
      </Route>
      <Route path="/shops">
        <ProtectedRoute component={Shops} />
      </Route>
      <Route path="/users">
        <ProtectedRoute component={Users} />
      </Route>
      <Route path="/leads">
        <ProtectedRoute component={Leads} />
      </Route>
      <Route path="/team">
        <ProtectedRoute component={SubPartners} />
      </Route>
      <Route path="/transactions">
        <ProtectedRoute component={Transactions} />
      </Route>
      <Route path="/withdraw">
        <ProtectedRoute component={Withdraw} />
      </Route>
      <Route path="/profile">
        <ProtectedRoute component={Profile} />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AuthProvider>
            <Router />
          </AuthProvider>
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
