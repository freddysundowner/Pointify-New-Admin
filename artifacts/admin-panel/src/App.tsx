import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/lib/auth";
import { MobileHeaderProvider } from "@/lib/mobile-header";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Shell } from "@/components/layout/Shell";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Statistics from "@/pages/statistics";
import Users from "@/pages/users";
import UserShops from "@/pages/user-shops";
import Shops from "@/pages/shops";
import Categories from "@/pages/categories";
import Partners from "@/pages/partners";
import PartnerDetail from "@/pages/partner-detail";
import Leads from "@/pages/leads";
import Products from "@/pages/products";
import Attendants from "@/pages/attendants";
import Sales from "@/pages/sales";
import Purchases from "@/pages/purchases";
import Packages from "@/pages/packages";
import Subscriptions from "@/pages/subscriptions";
import SMS from "@/pages/sms";
import AiLogs from "@/pages/ai-logs";
import Settings from "@/pages/settings";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Redirect to="/login" />;
  return (
    <Shell>
      <Component />
    </Shell>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/"><ProtectedRoute component={Dashboard} /></Route>
      <Route path="/statistics"><ProtectedRoute component={Statistics} /></Route>
      <Route path="/users"><ProtectedRoute component={Users} /></Route>
      <Route path="/users/:id/shops"><ProtectedRoute component={UserShops} /></Route>
      <Route path="/shops"><ProtectedRoute component={Shops} /></Route>
      <Route path="/categories"><ProtectedRoute component={Categories} /></Route>
      <Route path="/partners"><ProtectedRoute component={Partners} /></Route>
      <Route path="/partners/:id"><ProtectedRoute component={PartnerDetail} /></Route>
      <Route path="/leads"><ProtectedRoute component={Leads} /></Route>
      <Route path="/products"><ProtectedRoute component={Products} /></Route>
      <Route path="/attendants"><ProtectedRoute component={Attendants} /></Route>
      <Route path="/sales"><ProtectedRoute component={Sales} /></Route>
      <Route path="/purchases"><ProtectedRoute component={Purchases} /></Route>
      <Route path="/packages"><ProtectedRoute component={Packages} /></Route>
      <Route path="/subscriptions"><ProtectedRoute component={Subscriptions} /></Route>
      <Route path="/sms"><ProtectedRoute component={SMS} /></Route>
      <Route path="/ai-logs"><ProtectedRoute component={AiLogs} /></Route>
      <Route path="/settings"><ProtectedRoute component={Settings} /></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ErrorBoundary>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthProvider>
              <MobileHeaderProvider>
                <Router />
              </MobileHeaderProvider>
            </AuthProvider>
          </WouterRouter>
        </ErrorBoundary>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
