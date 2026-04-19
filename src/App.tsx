import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from "@/components/ProtectedRoute";
import ErrorBoundary from "@/components/ErrorBoundary";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import MainLayout from "./components/MainLayout";
import DashboardLayout from "./components/DashboardLayout";
import QuickSearch from "./components/QuickSearch";
import HeartLogo from "./components/HeartLogo";

// Lazy-loaded routes
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const MyProjects = lazy(() => import("./pages/MyProjects"));
const NewProject = lazy(() => import("./pages/NewProject"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const ProjectRevision = lazy(() => import("./pages/ProjectRevision"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Examples = lazy(() => import("./pages/Examples"));
const Settings = lazy(() => import("./pages/Settings"));
const ChromeExtension = lazy(() => import("./pages/ChromeExtension"));
const Billing = lazy(() => import("./pages/Billing"));
const SharedProject = lazy(() => import("./pages/SharedProject"));
const Help = lazy(() => import("./pages/Help"));
const Admin = lazy(() => import("./pages/Admin"));
const AcceptInvite = lazy(() => import("./pages/AcceptInvite"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="flex flex-col items-center text-center">
      <HeartLogo animated className="h-14 w-14" />
      <p className="mt-4 font-heading text-xl tracking-[0.05em] text-primary">Lovplan</p>
      <div className="mt-4 h-0.5 w-32 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-8 animate-[loading-bar_1.2s_ease-in-out_infinite] rounded-full bg-primary" />
      </div>
    </div>
  </div>
);

const App = () => (
  <ErrorBoundary>
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <BrowserRouter>
            <AuthProvider>
              {/* Skip to content */}
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-button focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none"
              >
                Skip to content
              </a>
              <QuickSearch />
              <RouteErrorBoundary>
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                  {/* Public layout with navbar */}
                  <Route element={<MainLayout />}>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
                    <Route path="/signup" element={<PublicOnlyRoute><Signup /></PublicOnlyRoute>} />
                    <Route path="/forgot-password" element={<PublicOnlyRoute><ForgotPassword /></PublicOnlyRoute>} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/pricing" element={<Pricing />} />
                    <Route path="/examples" element={<Examples />} />
                    <Route path="/share/:id" element={<SharedProject />} />
                    <Route path="/help" element={<Help />} />
                  </Route>

                  {/* Dashboard layout with sidebar */}
                  <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/dashboard/new" element={<NewProject />} />
                    <Route path="/dashboard/projects" element={<MyProjects />} />
                    <Route path="/dashboard/extension" element={<ChromeExtension />} />
                    <Route path="/dashboard/billing" element={<Billing />} />
                    <Route path="/dashboard/settings" element={<Settings />} />
                    <Route path="/project/:id" element={<ProjectDetail />} />
                    <Route path="/project/:id/revise" element={<ProjectRevision />} />
                    <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                    <Route path="/invite/:token" element={<AcceptInvite />} />
                  </Route>

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </RouteErrorBoundary>
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  </ErrorBoundary>
);

export default App;
