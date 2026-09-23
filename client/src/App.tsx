import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import type { ComponentType } from "react";
import { Redirect, Route, Switch } from "wouter";
import { Waves } from "lucide-react";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { SessionProvider, useSession } from "./lib/session";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Dive from "./pages/Dive";

function Splash() {
  return (
    <div className="splash" role="status" aria-label="Loading">
      <span className="brand-mark"><Waves size={20} /></span>
    </div>
  );
}

function Protected({ component: C }: { component: ComponentType }) {
  const { status } = useSession();
  if (status === "loading") return <Splash />;
  if (status === "anon") return <Redirect to="/login" />;
  return <C />;
}

function LoginRoute() {
  const { status } = useSession();
  if (status === "loading") return <Splash />;
  if (status === "authed") return <Redirect to="/" />;
  return <Login />;
}

const DashboardRoute = () => <Protected component={Dashboard} />;
const DiveRoute = () => <Protected component={Dive} />;

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginRoute} />
      <Route path="/" component={DashboardRoute} />
      <Route path="/dive" component={DiveRoute} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <SessionProvider>
            <Toaster position="top-center" />
            <Router />
          </SessionProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
